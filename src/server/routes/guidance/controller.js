import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  renderMarkdown,
  applyImages,
  slugify,
  addHeadingIds
} from '#/common/markdown.js'
import { sampleGuidanceMarkdown } from './mock-guidance-markdown.js'
import { splitIntoSections, subHeadingsOf } from '#/common/sections.js'
import { mockAnalysisData } from './mock-analysis-data.js'
import { mockDocuments } from './mock-documents-data.js'
import { renderDiffHtml } from '#/common/diff.js'
import { isMustFix, formatSection, severityRank } from './shared.js'
import { listDocs, getDoc } from './viewer-content.js'
import {
  listViewers,
  getViewer,
  readViewerSource,
  saveViewer,
  deleteViewer
} from './viewer-registry.js'
import { buildViewerModel } from './viewer-model.js'

// Session keys for the one document moving through the journey.
const MARKDOWN_KEY = 'guidanceMarkdown'
const FILENAME_KEY = 'guidanceFilename'
const PROGRESS_KEY = 'guidanceProgress'
const FLASH_KEY = 'guidanceFlash'
const SECTIONS_KEY = 'guidanceSections'
// The phase-1 brief (scheme, audience, what is changing, the need), kept so
// reviewers see the context for the draft.
const NEED_KEY = 'guidanceNeed'
// Whether this run is creating a new guide or updating an existing one, and
// which guide is being updated.
const MODE_KEY = 'guidanceMode'
const EDIT_GUIDE_KEY = 'guidanceEditGuide'
// The published version of the guide being updated, kept so we can show a diff.
const BASELINE_KEY = 'guidanceBaseline'

const CHECK_BASE = '/guidance/check'
const HUB = '/guidance/task-list'

// The make-the-guidance phases from the service blueprint, shown as a task-list
// hub. The journey is told from the designer's point of view: they draft the
// guidance, then hand it off to other people (an approver, then the Model
// Office team). Those handoffs are represented as statuses the designer sees,
// not as separate users logging in.
const PHASES = [
  { id: 'need', name: 'Get the context', href: '/guidance/need' },
  { id: 'draft', name: 'Draft the guide', href: '/guidance/upload' },
  { id: 'review', name: 'Review and approve', href: '/guidance/review' },
  { id: 'readiness', name: 'Readiness testing', href: '/guidance/test' },
  { id: 'publish', name: 'Publish', href: CHECK_BASE }
]

function phaseMeta(id) {
  const index = PHASES.findIndex((p) => p.id === id)
  return { number: index + 1, name: PHASES[index].name }
}

function currentMarkdown(request) {
  return request.yar?.get(MARKDOWN_KEY) ?? sampleGuidanceMarkdown
}

// ── Progress state (drives the task-list statuses) ──────────────────────────
function getProgress(request) {
  return request.yar?.get(PROGRESS_KEY) ?? {}
}

function setPhaseStatus(request, id, status) {
  const progress = getProgress(request)
  progress[id] = status
  request.yar?.set(PROGRESS_KEY, progress)
}

function setFlash(request, text, success = false) {
  request.yar?.set(FLASH_KEY, { text, success })
}

function takeFlash(request) {
  const flash = request.yar?.get(FLASH_KEY)
  request.yar?.clear?.(FLASH_KEY)
  return flash
}

// Statuses other than "done" that still want a tag in the hub.
const STATUS_TAGS = {
  'awaiting-approval': {
    text: 'With the subject matter expert',
    classes: 'govuk-tag--grey'
  },
  'amends-sme': { text: 'Sent back for amends', classes: 'govuk-tag--orange' },
  'awaiting-readiness': {
    text: 'With the Model Office team',
    classes: 'govuk-tag--grey'
  },
  issues: { text: 'Issues found', classes: 'govuk-tag--orange' }
}

function buildHubItems(request) {
  const progress = getProgress(request)
  let previousDone = true

  return PHASES.map((phase) => {
    const status = progress[phase.id]
    const done = status === 'done'
    const item = { title: { text: phase.name } }

    if (done) {
      item.href = phase.href
      item.status = { text: 'Completed' }
    } else if (!previousDone) {
      item.status = {
        text: 'Cannot start yet',
        classes: 'govuk-task-list__status--cannot-start-yet'
      }
    } else {
      item.href = phase.href
      item.status = {
        tag: STATUS_TAGS[status] ?? {
          text: 'To do',
          classes: 'govuk-tag--blue'
        }
      }
    }

    previousDone = done
    return item
  })
}

// ── Pre-publish worklist helpers ─────────────────────────────────────────────
// The AI readiness check finds issues, each with a suggested rewrite. For each,
// the author approves the rewrite or rejects it; both resolve the issue. The
// decision is kept per session, keyed by the issue's index in the findings.
const DECISIONS_KEY = 'guidancePublishDecisions'

function getDecisions(request) {
  return request.yar?.get(DECISIONS_KEY) ?? {}
}

function setDecision(request, index, decision) {
  const decisions = getDecisions(request)
  decisions[index] = decision
  request.yar?.set(DECISIONS_KEY, decisions)
}

function issueStatusTag(decision, wantMustFix) {
  if (decision === 'approved') {
    return { tag: { text: 'Approved', classes: 'govuk-tag--green' } }
  }
  if (decision === 'rejected') {
    return { tag: { text: 'Rejected', classes: 'govuk-tag--grey' } }
  }
  return {
    tag: wantMustFix
      ? { text: 'To review', classes: 'govuk-tag--red' }
      : { text: 'To review', classes: 'govuk-tag--blue' }
  }
}

function buildTaskItems(findings, decisions, wantMustFix) {
  return findings
    .map((finding, index) => ({ finding, index }))
    .filter(({ finding }) => isMustFix(finding.severity) === wantMustFix)
    .sort(
      (a, b) =>
        severityRank(a.finding.severity) - severityRank(b.finding.severity)
    )
    .map(({ finding, index }) => ({
      title: { text: finding.issue },
      hint: { text: formatSection(finding.section) },
      href: `${CHECK_BASE}/issues/${index}`,
      status: issueStatusTag(decisions[index], wantMustFix)
    }))
}

function countBlockersRemaining(findings, decisions) {
  return findings.filter(
    (finding, index) => isMustFix(finding.severity) && !decisions[index]
  ).length
}

// ── Start ──────────────────────────────────────────────────────────────────
function getStart(request, h) {
  // Each run starts from a clean slate.
  request.yar?.clear?.(MARKDOWN_KEY)
  request.yar?.clear?.(FILENAME_KEY)
  request.yar?.clear?.(PROGRESS_KEY)
  request.yar?.clear?.(FLASH_KEY)
  request.yar?.clear?.(SECTIONS_KEY)
  request.yar?.clear?.(MODE_KEY)
  request.yar?.clear?.(EDIT_GUIDE_KEY)
  request.yar?.clear?.(BASELINE_KEY)
  request.yar?.clear?.(NEED_KEY)
  request.yar?.clear?.(NEED_SOURCE_KEY)
  request.yar?.clear?.(BRIEFING_FILE_KEY)
  request.yar?.clear?.(NEED_DOCS_KEY)
  request.yar?.clear?.(DRAFT_DOCS_KEY)
  uploadedImages.clear()
  request.yar?.clear?.(DECISIONS_KEY)

  // Clear any previous run, then enter the make journey (the home page is a
  // separate hub in this service, so do not loop back to it).
  return h.redirect('/guidance/what')
}

// ── Choose: create a new guide, or update an existing one ───────────────────
function renderWhat(h, errorMessage) {
  return h
    .view('guidance/what', {
      pageTitle: (errorMessage ? 'Error: ' : '') + 'What do you want to do?',
      page: 'guidance',
      backHref: '/guidance/start',
      errorMessage
    })
    .code(statusCodes.ok)
}

function getWhat(request, h) {
  return renderWhat(h)
}

function startFresh(request) {
  request.yar?.clear?.(MARKDOWN_KEY)
  request.yar?.clear?.(SECTIONS_KEY)
  request.yar?.clear?.(PROGRESS_KEY)
  request.yar?.clear?.(BASELINE_KEY)
  request.yar?.clear?.(NEED_KEY)
  request.yar?.clear?.(NEED_SOURCE_KEY)
  request.yar?.clear?.(BRIEFING_FILE_KEY)
  request.yar?.clear?.(NEED_DOCS_KEY)
  request.yar?.clear?.(DRAFT_DOCS_KEY)
  uploadedImages.clear()
  request.yar?.clear?.(DECISIONS_KEY)
}

function postWhat(request, h) {
  const choice = request.payload?.choice
  if (choice === 'new') {
    startFresh(request)
    request.yar?.set(MODE_KEY, 'new')
    request.yar?.clear?.(EDIT_GUIDE_KEY)
    return h.redirect(HUB)
  }
  if (choice === 'existing') {
    return h.redirect('/guidance/library')
  }
  return renderWhat(
    h,
    'Select whether you are creating a new guide or updating an existing one'
  )
}

// ── The library: a case-management view of the guides the team authors ──────
// A finder / case-list page (the MOJ "case list" pattern): smart search across
// each guide's metadata AND the documents it was built from, status and scheme
// facets with counts, and a summary card per guide that layers its ingested
// context documents underneath. The guide authored in the make journey appears
// here as the user's own work in progress, so retrieval and authoring share one
// home.
// Three calm colours that signal a stage, not a rainbow: grey not started, blue
// in progress (review / testing / ready), green done. The tag text carries the
// detail.
const GUIDE_STATUS_TAGS = {
  draft: { text: 'Draft', classes: 'govuk-tag--grey' },
  'in-review': { text: 'In review', classes: 'govuk-tag--blue' },
  testing: { text: 'Testing', classes: 'govuk-tag--blue' },
  ready: { text: 'Ready', classes: 'govuk-tag--blue' },
  published: { text: 'Published', classes: 'govuk-tag--green' }
}

// The primary action label for a guide depends on its state. Every editable
// state offers an edit action; published offers a read-only view (with a
// separate Edit link for a new version).
const GUIDE_STATUS_ACTIONS = {
  draft: 'Continue editing',
  'in-review': 'Edit guide',
  testing: 'Edit guide',
  ready: 'Edit guide',
  published: 'View published guide'
}

const STATUS_FACETS = [
  { value: 'draft', text: 'Draft' },
  { value: 'in-review', text: 'In review' },
  { value: 'testing', text: 'Testing' },
  { value: 'ready', text: 'Ready' },
  { value: 'published', text: 'Published' }
]

// Workflow order for sorting by status: draft first, published last.
const STATUS_RANK = {
  draft: 0,
  'in-review': 1,
  testing: 2,
  ready: 3,
  published: 4
}

// Every column is sortable (MOJ sortable table). Each maps to an ascending and a
// descending sort key; the date column keeps the friendlier "updated" (newest
// first) and "oldest" names. Clicking a header toggles between the two.
const SORT_COLUMNS = {
  title: { asc: 'title', desc: 'title-desc' },
  scheme: { asc: 'scheme', desc: 'scheme-desc' },
  owner: { asc: 'owner', desc: 'owner-desc' },
  updated: { asc: 'oldest', desc: 'updated' },
  status: { asc: 'status', desc: 'status-desc' }
}

const VALID_SORTS = new Set(
  Object.values(SORT_COLUMNS).flatMap((c) => [c.asc, c.desc])
)

// Text columns fall back to title order so rows stay stable and sensibly grouped.
const byTitle = (a, b) => a.title.localeCompare(b.title)
const statusRank = (k) => STATUS_RANK[k] ?? 99

function compareGuides(sort) {
  switch (sort) {
    case 'title':
      return byTitle
    case 'title-desc':
      return (a, b) => byTitle(b, a)
    case 'scheme':
      return (a, b) => a.scheme.localeCompare(b.scheme) || byTitle(a, b)
    case 'scheme-desc':
      return (a, b) => b.scheme.localeCompare(a.scheme) || byTitle(a, b)
    case 'owner':
      return (a, b) => a.owner.localeCompare(b.owner) || byTitle(a, b)
    case 'owner-desc':
      return (a, b) => b.owner.localeCompare(a.owner) || byTitle(a, b)
    case 'status':
      return (a, b) =>
        statusRank(a.statusKey) - statusRank(b.statusKey) || byTitle(a, b)
    case 'status-desc':
      return (a, b) =>
        statusRank(b.statusKey) - statusRank(a.statusKey) || byTitle(a, b)
    case 'oldest':
      return (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)
    default:
      return (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  }
}

// View-model for a sortable column header: clicking toggles ascending ->
// descending -> ascending, and aria-sort reflects the current state.
function sortHeader(field, sort, urlFor) {
  const col = SORT_COLUMNS[field]
  if (sort === col.asc) {
    return { href: urlFor(col.desc), ariaSort: 'ascending' }
  }
  if (sort === col.desc) {
    return { href: urlFor(col.asc), ariaSort: 'descending' }
  }
  return { href: urlFor(col.asc), ariaSort: 'none' }
}

function formatGuideDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// View-model for one guide row, including the lower-cased text the smart search
// matches against: title, summary, scheme, owner, reference and , the layered
// part , the names of the documents the guide was built from.
function toLibraryRow(d) {
  const contextDocs = d.contextDocs ?? []
  return {
    id: d.id,
    title: d.title,
    scheme: d.scheme,
    statusKey: d.status,
    statusTag: GUIDE_STATUS_TAGS[d.status] ?? {
      text: d.status,
      classes: 'govuk-tag--grey'
    },
    owner: d.owner,
    updated: formatGuideDate(d.updatedAt ?? d.createdAt),
    updatedAt: d.updatedAt ?? d.createdAt,
    contextCount: contextDocs.length,
    // The row links to the guide's detail page (the expanded view); the edit
    // action lives there, behind the permission check.
    detailHref: '/guidance/library/' + d.id,
    searchText: [
      d.title,
      d.summary,
      d.scheme,
      d.owner,
      d.reference,
      contextDocs.map((c) => c.name).join(' ')
    ]
      .join(' ')
      .toLowerCase()
  }
}

const GUIDE_PAGE_SIZE = 20

// Build a library URL preserving the current search, facets and sort, for a
// given page (and any reduced set of facet values, for the "remove filter"
// links). Server-side state lives entirely in the query string.
function libraryUrl({ q, statusFilter, schemeFilter, sort, page }) {
  const params = new URLSearchParams()
  if (q) {
    params.set('q', q)
  }
  statusFilter.forEach((s) => params.append('status', s))
  schemeFilter.forEach((s) => params.append('scheme', s))
  if (sort && sort !== 'updated') {
    params.set('sort', sort)
  }
  if (page && page > 1) {
    params.set('page', String(page))
  }
  const qs = params.toString()
  return '/guidance/library' + (qs ? '?' + qs : '')
}

function getLibrary(request, h) {
  const q = (request.query?.q ?? '').trim()
  const statusFilter = [].concat(request.query?.status ?? []).filter(Boolean)
  const schemeFilter = [].concat(request.query?.scheme ?? []).filter(Boolean)
  const sort = VALID_SORTS.has(request.query?.sort)
    ? request.query.sort
    : 'updated'
  const requestedPage = Math.max(1, parseInt(request.query?.page, 10) || 1)

  const all = mockDocuments.map(toLibraryRow)
  const needle = q.toLowerCase()

  // Server-side, like a GOV.UK finder: hundreds of rows cannot be filtered and
  // paged in the browser. Search narrows the set the facets count against; the
  // facets and sort then produce the page.
  const searched = all.filter(
    (g) => needle === '' || g.searchText.includes(needle)
  )
  const filtered = searched
    .filter(
      (g) =>
        (statusFilter.length === 0 || statusFilter.includes(g.statusKey)) &&
        (schemeFilter.length === 0 || schemeFilter.includes(g.scheme))
    )
    .sort(compareGuides(sort))

  const totalMatches = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalMatches / GUIDE_PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const start = (currentPage - 1) * GUIDE_PAGE_SIZE
  const guides = filtered.slice(start, start + GUIDE_PAGE_SIZE)

  const statusFacets = STATUS_FACETS.map((f) => {
    const count = searched.filter((g) => g.statusKey === f.value).length
    return {
      value: f.value,
      text: f.text + ' (' + count + ')',
      checked: statusFilter.includes(f.value)
    }
  })
  const schemeFacets = [...new Set(all.map((g) => g.scheme))]
    .sort()
    .map((s) => {
      const count = searched.filter((g) => g.scheme === s).length
      return {
        value: s,
        text: s + ' (' + count + ')',
        checked: schemeFilter.includes(s)
      }
    })
  // Clickable, sortable column headers (MOJ sortable table): every column
  // toggles ascending / descending. Sorting is server-side so it holds across
  // the whole set, not just the rows on this page.
  const urlFor = (s) => libraryUrl({ q, statusFilter, schemeFilter, sort: s })
  const sortHeaders = {
    title: sortHeader('title', sort, urlFor),
    scheme: sortHeader('scheme', sort, urlFor),
    owner: sortHeader('owner', sort, urlFor),
    updated: sortHeader('updated', sort, urlFor),
    status: sortHeader('status', sort, urlFor)
  }

  // Selected-filter tags, each removable (MOJ "selected filters" panel).
  const selectedFilters = []
  statusFilter.forEach((value) => {
    const tag = STATUS_FACETS.find((f) => f.value === value)
    selectedFilters.push({
      label: 'Status: ' + (tag ? tag.text : value),
      href: libraryUrl({
        q,
        statusFilter: statusFilter.filter((s) => s !== value),
        schemeFilter,
        sort
      })
    })
  })
  schemeFilter.forEach((value) => {
    selectedFilters.push({
      label: 'Scheme: ' + value,
      href: libraryUrl({
        q,
        statusFilter,
        schemeFilter: schemeFilter.filter((s) => s !== value),
        sort
      })
    })
  })

  const pageHref = (n) =>
    libraryUrl({ q, statusFilter, schemeFilter, sort, page: n })
  const pagination =
    totalPages > 1
      ? {
          previous:
            currentPage > 1 ? { href: pageHref(currentPage - 1) } : undefined,
          next:
            currentPage < totalPages
              ? { href: pageHref(currentPage + 1) }
              : undefined,
          items: Array.from({ length: totalPages }, (_, i) => ({
            number: i + 1,
            href: pageHref(i + 1),
            current: i + 1 === currentPage
          }))
        }
      : null

  return h
    .view('guidance/library', {
      pageTitle: 'Guides',
      page: 'guidance',
      backHref: '/guidance/what',
      guides,
      total: all.length,
      totalMatches,
      rangeStart: totalMatches === 0 ? 0 : start + 1,
      rangeEnd: Math.min(start + GUIDE_PAGE_SIZE, totalMatches),
      isFiltered:
        q !== '' || statusFilter.length > 0 || schemeFilter.length > 0,
      q,
      statusFacets,
      schemeFacets,
      sortHeaders,
      selectedFilters,
      pagination,
      clearHref: '/guidance/library'
    })
    .code(statusCodes.ok)
}

// Open a guide for editing from the library: load it into the workspace and go
// to the editor. You can only edit your own guides , a permission check bounces
// anyone else back to the read-only detail page.
function openGuide(request, h) {
  const guide = mockDocuments.find((d) => d.id === request.params.id)
  if (!guide) {
    return h.redirect('/guidance/library')
  }
  if (guide.owner !== 'You') {
    return h.redirect('/guidance/library/' + guide.id)
  }
  request.yar?.set(EDIT_GUIDE_KEY, { id: guide.id, title: guide.title })
  request.yar?.set(BASELINE_KEY, sampleGuidanceMarkdown)
  request.yar?.set(MODE_KEY, 'edit')
  return h.redirect('/guidance/sections')
}

// The guide detail page: an expanded info card (summary, metadata and the
// documents it was built from), and where the edit action lives. Guides owned
// by someone else are view-only, with a request-access action.
function getGuideDetail(request, h) {
  const guide = mockDocuments.find((d) => d.id === request.params.id)
  if (!guide) {
    return h.redirect('/guidance/library')
  }
  return h
    .view('guidance/guide-detail', {
      pageTitle: guide.title,
      page: 'guidance',
      backHref: '/guidance/library',
      guide: {
        ...guide,
        statusTag: GUIDE_STATUS_TAGS[guide.status] ?? {
          text: guide.status,
          classes: 'govuk-tag--grey'
        },
        created: formatGuideDate(guide.createdAt),
        updated: formatGuideDate(guide.updatedAt ?? guide.createdAt),
        contextDocs: guide.contextDocs ?? [],
        // Read-only catalogue metadata, kept in a reveal so it does not repeat
        // the status and dates shown above. The id is the guide's own; the rest
        // are illustrative example values for the prototype.
        metadata: {
          id: guide.id,
          type: 'Process guide',
          tags: guide.scheme + ', eligibility, payments',
          section: 'Whole guide'
        }
      },
      editable: guide.owner === 'You',
      isPublished: guide.status === 'published',
      actionLabel: GUIDE_STATUS_ACTIONS[guide.status] ?? 'Edit guide',
      editHref: '/guidance/library/open/' + guide.id,
      publishedHref: '/guidance/published/' + guide.id,
      requestHref: '/guidance/library/' + guide.id + '/request-access',
      flash: takeFlash(request)
    })
    .code(statusCodes.ok)
}

// Simulated "request edit access" for a guide owned by someone else.
function postRequestAccess(request, h) {
  const guide = mockDocuments.find((d) => d.id === request.params.id)
  if (!guide) {
    return h.redirect('/guidance/library')
  }
  setFlash(
    request,
    'Edit access requested from ' +
      guide.owner +
      '. They will get an email to approve it.',
    true
  )
  return h.redirect('/guidance/library/' + guide.id)
}

// ── What has changed: the edit against the published version (red/green) ────
function getChanges(request, h) {
  const baseline = request.yar?.get(BASELINE_KEY)
  if (!baseline) {
    return h.redirect(HUB)
  }
  const diff = renderDiffHtml(baseline, currentMarkdown(request))
  return h
    .view('guidance/changes', {
      pageTitle: 'What has changed',
      page: 'guidance',
      phase: phaseMeta('review'),
      backHref: '/guidance/review',
      editGuide: request.yar?.get(EDIT_GUIDE_KEY),
      changed: diff.changed,
      diffHtml: diff.html
    })
    .code(statusCodes.ok)
}

// ── The published guide: the read-only view both journeys point at ──────────
// This is the one object the make side produces and the find-and-use side
// consumes. Author chrome is stripped: it is just the guide, as a caseworker
// or processor reads it on the Guidance Hub.
function getPublishedGuide(request, h) {
  const guide = mockDocuments.find((doc) => doc.id === request.params.id)
  const headingMatch = sampleGuidanceMarkdown.match(/^\s*#\s*(.+)/)
  const title =
    guide?.title ?? (headingMatch ? headingMatch[1].trim() : 'RPA guide')
  // Drop the document's own title (it becomes the page heading) and promote the
  // remaining headings one level so the sections sit correctly under the h1.
  const body = sampleGuidanceMarkdown
    .replace(/^\s*#[^\n]*\r?\n+/, '')
    .replace(/^#(#+)/gm, '$1')
  const guideHtml = applyImages(renderMarkdown(body), imagesObject())
  return h
    .view('guidance/published-guide', {
      pageTitle: title,
      page: 'guidance',
      guideTitle: title,
      guideHtml
    })
    .code(statusCodes.ok)
}

// ── Viewer prototyping harness ──────────────────────────────────────────────
// Lets designers try different guidance "viewer" presentations, switch between
// them for a given guide, and author new ones from the browser — without
// touching routing. Viewers live in ./viewers and content in ./content; both
// are auto-discovered. See viewers/README.md.
//
// The journey: gallery (choose a guide) -> open (view it, switch template in
// place) -> template manager (create/edit/delete templates). The chosen template
// renders as the whole page; the shared _viewer-layout injects the switcher.

// A starter template offered when creating a new Nunjucks viewer.
const NEW_VIEWER_SCAFFOLD = `{% extends "guidance/viewers/_viewer-layout.njk" %}

{% block viewer %}
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-two-thirds">
      <h1 class="govuk-heading-l">{{ guide.title }}</h1>
      <div class="app-rich-text">
        {{ bodyHtml | safe }}
      </div>
    </div>
  </div>
{% endblock %}
`

// The gallery: choose a guide to open in the viewer.
function getViewerGallery(request, h) {
  return h
    .view('guidance/viewer-gallery', {
      pageTitle: 'Guidance viewer prototypes',
      page: 'guidance',
      backHref: '/guidance/what',
      docs: listDocs()
    })
    .code(statusCodes.ok)
}

// Open a guide in a viewer. The chosen template renders as the whole page; the
// shared _viewer-layout injects a switcher so the reader can flip templates
// in place (each switch is a normal page navigation, ?viewer=…). The switcher
// data (viewers, currentViewer) is merged into the model so any template — even
// a standalone one — can surface it.
function getViewerOpen(request, h) {
  const doc = getDoc(request.params.docId)
  if (!doc) {
    return h.redirect('/guidance/viewer')
  }
  const viewers = listViewers()
  const requested = request.query.viewer
  const currentViewer =
    (getViewer(requested) && requested) ||
    (getViewer(doc.defaultViewer) && doc.defaultViewer) ||
    viewers[0]?.id
  // No templates exist yet — send the designer to create one.
  if (!currentViewer) {
    return h.redirect('/guidance/viewer/templates')
  }
  const model = buildViewerModel(doc, currentViewer, request.query.step)
  return h
    .view(`guidance/viewers/${getViewer(currentViewer).file}`, {
      ...model,
      viewers,
      currentViewer
    })
    .code(statusCodes.ok)
}

// ── Template manager: create/edit/delete viewer templates from the browser ───
function getTemplatesList(request, h) {
  const docs = listDocs()
  return h
    .view('guidance/viewer-templates', {
      pageTitle: 'Viewer templates',
      page: 'guidance',
      backHref: '/guidance/viewer',
      viewers: listViewers(),
      previewDocId: docs[0]?.id,
      saved: request.query.saved
    })
    .code(statusCodes.ok)
}

function renderEditor(h, options) {
  return h
    .view('guidance/viewer-template-editor', {
      page: 'guidance',
      backHref: '/guidance/viewer/templates',
      ...options
    })
    .code(options.errorMessage ? statusCodes.badRequest : statusCodes.ok)
}

function getTemplateNew(request, h) {
  return renderEditor(h, {
    pageTitle: 'Create a template',
    mode: 'new',
    values: { name: '', ext: 'njk', body: NEW_VIEWER_SCAFFOLD }
  })
}

function postTemplateNew(request, h) {
  const { name, ext, body } = request.payload ?? {}
  try {
    const saved = saveViewer({ name, ext, body })
    return h.redirect(`/guidance/viewer/templates?saved=${saved.id}`)
  } catch (error) {
    return renderEditor(h, {
      pageTitle: 'Create a template',
      mode: 'new',
      errorMessage: error.message,
      values: { name, ext: ext || 'njk', body }
    })
  }
}

function getTemplateEdit(request, h) {
  const viewer = readViewerSource(request.params.id)
  if (!viewer) {
    return h.redirect('/guidance/viewer/templates')
  }
  return renderEditor(h, {
    pageTitle: `Edit ${viewer.label}`,
    mode: 'edit',
    viewer,
    values: { name: viewer.id, ext: viewer.ext, body: viewer.source }
  })
}

function postTemplateEdit(request, h) {
  const viewer = getViewer(request.params.id)
  if (!viewer) {
    return h.redirect('/guidance/viewer/templates')
  }
  const { body } = request.payload ?? {}
  try {
    saveViewer({ id: viewer.id, ext: viewer.ext, body })
    return h.redirect(`/guidance/viewer/templates?saved=${viewer.id}`)
  } catch (error) {
    return renderEditor(h, {
      pageTitle: `Edit ${viewer.label}`,
      mode: 'edit',
      viewer,
      errorMessage: error.message,
      values: { name: viewer.id, ext: viewer.ext, body }
    })
  }
}

function postTemplateDelete(request, h) {
  deleteViewer(request.params.id)
  return h.redirect('/guidance/viewer/templates')
}

// ── The hub: the five phases as a task list ─────────────────────────────────
function getTaskList(request, h) {
  return h
    .view('guidance/task-list', {
      pageTitle: 'Make and publish guides',
      page: 'guidance',
      backHref: '/guidance/what',
      editGuide: request.yar?.get(EDIT_GUIDE_KEY),
      items: buildHubItems(request),
      flash: takeFlash(request)
    })
    .code(statusCodes.ok)
}

// ── Phase 1: identify the need ──────────────────────────────────────────────
// Phase 1's AI opportunity: ingest a briefing or operational document and let AI
// draft the need from it. The flow is: upload (skippable) -> AI reads it ->
// "check what we worked out" (a GOV.UK check-answers screen) -> confirm or
// correct -> saved. The skip/manual path lands on the same details form and
// converges on the same check screen. The AI is a future opportunity, so it is
// simulated: uploading any file produces a canned inference. AI drafts; the
// human owns and confirms; nothing is recorded until "Accept and continue".
const NEED_SOURCE_KEY = 'guidanceNeedSource'
const BRIEFING_FILE_KEY = 'guidanceBriefingFile'
// The list of context documents added on the upload screen (filenames only).
const NEED_DOCS_KEY = 'guidanceNeedDocs'

const SAMPLE_BRIEF = {
  type: 'new',
  scheme: 'Sustainable Farming Incentive (SFI)',
  audienceType: 'processing',
  change:
    'From the 2026 scheme year, parcels can be split or merged mid-agreement, and a tenure change can unlink a parcel from the SBI. Processors need a consistent way to investigate and relink them.',
  need: 'Work an "SFI parcel ID not linked to SBI in SITI Tenure" case: run the tenure and mapping checks in order, apply the right hold code, and follow the Operations Resolution route when a parcel was never linked.'
}

const NEED_TYPE_LABELS = {
  new: 'New guidance',
  change: 'An update to existing guidance',
  unsure: 'Not sure yet'
}

const NEED_AUDIENCE_LABELS = {
  customers: 'Customers and their agents',
  'contact-centre': 'Contact centre staff',
  processing: 'Processing and operational staff'
}

// Screen 1: add the context documents. "Add another" pattern inside the "Yes"
// reveal: add documents to a list, remove any, then continue. The prototype
// keeps no files, only their names.
function renderNeedUpload(h, errorMessage, values) {
  return h
    .view('guidance/need', {
      pageTitle: (errorMessage ? 'Error: ' : '') + 'Get the context',
      page: 'guidance',
      phase: phaseMeta('need'),
      backHref: HUB,
      errorMessage,
      values: values ?? {},
      docs: (values && values.docs) || []
    })
    .code(statusCodes.ok)
}

function getNeed(request, h) {
  // If the need is already recorded, go straight to the check screen to confirm
  // or edit it, rather than asking for the documents again.
  if (request.yar?.get(NEED_KEY)) {
    return h.redirect('/guidance/need/review')
  }
  const docs = request.yar?.get(NEED_DOCS_KEY) ?? []
  return renderNeedUpload(h, undefined, {
    hasDocument: docs.length ? 'yes' : undefined,
    docs
  })
}

// Add an uploaded file's name to a session list, validating its extension.
// Shared by the no-JS form post and the AJAX upload endpoint.
function addDoc(request, key, file, pattern, typeError) {
  const docs = request.yar?.get(key) ?? []
  const filename = file?.hapi?.filename?.trim()
  if (!filename) {
    return { docs, error: 'Select a document to add' }
  }
  if (!pattern.test(filename)) {
    return { docs, error: typeError }
  }
  docs.push(filename)
  request.yar?.set(key, docs)
  return { docs, filename }
}

const NEED_DOC_PATTERN = /\.(docx|pdf)$/i
const NEED_DOC_TYPE_ERROR =
  'Each document must be a Word document (.docx) or a PDF'

// The main form post for phase 1. With JavaScript, the MOJ component adds and
// deletes via the AJAX endpoints below, so this only runs Continue. Without
// JavaScript, the component falls back to a normal file input and submit, so
// this also handles add and delete.
function postNeedUpload(request, h) {
  const payload = request.payload ?? {}
  const file = payload.documents
  if (file && typeof file.resume === 'function') {
    file.resume()
  }

  // Delete a document (no-JS path).
  if (payload.delete !== undefined && payload.delete !== '') {
    const docs = request.yar?.get(NEED_DOCS_KEY) ?? []
    const index = docs.indexOf(payload.delete)
    if (index !== -1) {
      docs.splice(index, 1)
      request.yar?.set(NEED_DOCS_KEY, docs)
    }
    return renderNeedUpload(h, undefined, { hasDocument: 'yes', docs })
  }

  // Add a document (no-JS path).
  if (payload.action === 'add') {
    const result = addDoc(
      request,
      NEED_DOCS_KEY,
      file,
      NEED_DOC_PATTERN,
      NEED_DOC_TYPE_ERROR
    )
    return renderNeedUpload(h, result.error, {
      hasDocument: 'yes',
      docs: result.docs
    })
  }

  // Continue. "No" is a first-class choice, not a skip link.
  const choice = payload.hasDocument
  if (choice === 'no') {
    request.yar?.clear?.(NEED_DOCS_KEY)
    return h.redirect('/guidance/need/details')
  }
  if (choice !== 'yes') {
    return renderNeedUpload(h, 'Select whether you have documents to upload', {
      hasDocument: choice,
      docs: request.yar?.get(NEED_DOCS_KEY) ?? []
    })
  }
  // Forgiving: if a file is chosen but not yet uploaded, add it now.
  if (file?.hapi?.filename) {
    const result = addDoc(
      request,
      NEED_DOCS_KEY,
      file,
      NEED_DOC_PATTERN,
      NEED_DOC_TYPE_ERROR
    )
    if (result.error) {
      return renderNeedUpload(h, result.error, {
        hasDocument: 'yes',
        docs: result.docs
      })
    }
  }
  const docs = request.yar?.get(NEED_DOCS_KEY) ?? []
  if (!docs.length) {
    return renderNeedUpload(
      h,
      'Add a document, or choose to enter the details yourself',
      { hasDocument: 'yes', docs }
    )
  }
  // Simulate the AI reading the documents and drafting the need. It may spot this
  // is really an update to existing guidance, so check for duplication next.
  request.yar?.set(NEED_KEY, { ...SAMPLE_BRIEF })
  request.yar?.set(NEED_SOURCE_KEY, 'ai')
  request.yar?.set(
    BRIEFING_FILE_KEY,
    docs.length === 1 ? docs[0] : docs.length + ' documents'
  )
  return h.redirect('/guidance/need/existing')
}

// AJAX upload endpoint for the MOJ multi file upload component (phase 1). Stores
// the filename and returns the JSON shape the component expects.
function postNeedDocAdd(request, h) {
  const file = request.payload?.documents
  if (file && typeof file.resume === 'function') {
    file.resume()
  }
  const result = addDoc(
    request,
    NEED_DOCS_KEY,
    file,
    NEED_DOC_PATTERN,
    NEED_DOC_TYPE_ERROR
  )
  if (result.error) {
    return h.response({ error: { message: result.error } }).code(statusCodes.ok)
  }
  return h
    .response({
      success: {
        messageText: result.filename + ' uploaded',
        messageHtml: result.filename
      },
      file: { filename: result.filename, originalname: result.filename }
    })
    .code(statusCodes.ok)
}

// AJAX delete endpoint for the MOJ multi file upload component (phase 1).
function postNeedDocDelete(request, h) {
  const filename = request.payload?.delete
  const docs = request.yar?.get(NEED_DOCS_KEY) ?? []
  const index = docs.indexOf(filename)
  if (index !== -1) {
    docs.splice(index, 1)
    request.yar?.set(NEED_DOCS_KEY, docs)
  }
  return h.response({ success: true }).code(statusCodes.ok)
}

// Clear the recorded need to start phase 1 over from the upload screen.
function getNeedRestart(request, h) {
  request.yar?.clear?.(NEED_KEY)
  request.yar?.clear?.(NEED_SOURCE_KEY)
  request.yar?.clear?.(BRIEFING_FILE_KEY)
  request.yar?.clear?.(NEED_DOCS_KEY)
  return h.redirect('/guidance/need')
}

// The details form: the skip/manual target, and the "Change" target from review.
function renderNeedDetails(h, values) {
  return h
    .view('guidance/need-details', {
      pageTitle: 'Enter the details of the need',
      page: 'guidance',
      phase: phaseMeta('need'),
      backHref: '/guidance/need',
      values: values ?? {}
    })
    .code(statusCodes.ok)
}

function getNeedDetails(request, h) {
  return renderNeedDetails(h, request.yar?.get(NEED_KEY))
}

function postNeedDetails(request, h) {
  const payload = request.payload ?? {}
  request.yar?.set(NEED_KEY, {
    type: payload.type,
    scheme: (payload.scheme ?? '').trim(),
    audienceType: payload.audienceType,
    change: (payload.change ?? '').trim(),
    need: (payload.need ?? '').trim()
  })
  if (!request.yar?.get(NEED_SOURCE_KEY)) {
    request.yar?.set(NEED_SOURCE_KEY, 'manual')
  }
  return h.redirect('/guidance/need/review')
}

// Screen 2: check the need (GOV.UK check-answers), then confirm.
function needRow(key, value, anchor, hidden) {
  return {
    key: { text: key },
    value: { text: value },
    actions: {
      items: [
        {
          href: '/guidance/need/details#' + anchor,
          text: 'Change',
          visuallyHiddenText: hidden
        }
      ]
    }
  }
}

function getNeedReview(request, h) {
  const need = request.yar?.get(NEED_KEY)
  if (!need) {
    return h.redirect('/guidance/need')
  }
  const rows = [
    needRow(
      'Type of guidance',
      NEED_TYPE_LABELS[need.type] ?? 'Not set',
      'type',
      'type of guidance'
    ),
    needRow(
      'Scheme or service',
      need.scheme || 'Not set',
      'scheme',
      'scheme or service'
    ),
    needRow(
      'Who it is for',
      NEED_AUDIENCE_LABELS[need.audienceType] ?? 'Not set',
      'audienceType',
      'who it is for'
    ),
    needRow(
      'What is new or changing',
      need.change || 'Not set',
      'change',
      'what is new or changing'
    ),
    needRow(
      'What this audience needs to do',
      need.need || 'Not set',
      'need',
      'what this audience needs to do'
    )
  ]
  return h
    .view('guidance/need-review', {
      pageTitle: 'Check the need',
      page: 'guidance',
      phase: phaseMeta('need'),
      backHref: '/guidance/need',
      rows,
      fromAi: request.yar?.get(NEED_SOURCE_KEY) === 'ai',
      filename: request.yar?.get(BRIEFING_FILE_KEY)
    })
    .code(statusCodes.ok)
}

function postNeedReview(request, h) {
  if (!request.yar?.get(NEED_KEY)) {
    return h.redirect('/guidance/need')
  }
  setPhaseStatus(request, 'need', 'done')
  setFlash(request, 'You have given the context.', true)
  return h.redirect(HUB)
}

// The duplication check: after AI reads the document it may spot that this is
// really an update to existing guidance, not new. Catching it here keeps one
// source of truth and avoids duplicate guidance. Simulated with a canned match.
const DUPLICATE_MATCH = {
  id: 'sfi-actions-guide',
  title: 'Sustainable Farming Incentive actions guide'
}

// One update rarely affects just one guide. These are the guides this change is
// likely to touch, each with the section most affected and how likely it is to
// need updating (illustrative values).
const AFFECTED_GUIDE_ROWS = [
  { section: 'Eligibility', impact: 'High' },
  { section: 'How to apply', impact: 'High' },
  { section: 'Evidence you need to keep', impact: 'Medium' },
  { section: 'Payment rates', impact: 'Medium' },
  { section: 'Land and parcels', impact: 'Low' },
  { section: 'Key dates and deadlines', impact: 'Low' },
  { section: 'After you apply', impact: 'Low' }
]

// Rank order so the table always leads with the guides a change hits hardest.
const IMPACT_RANK = { High: 0, Medium: 1, Low: 2 }

function affectedGuides() {
  return mockDocuments
    .slice(0, 7)
    .map((doc, index) => {
      const row = AFFECTED_GUIDE_ROWS[index % AFFECTED_GUIDE_ROWS.length]
      return {
        title: doc.title,
        section: row.section,
        impact: row.impact,
        href: '/guidance/library/' + doc.id
      }
    })
    .sort((a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact])
}

function renderNeedExisting(h, errorMessage) {
  return h
    .view('guidance/need-existing', {
      pageTitle:
        (errorMessage ? 'Error: ' : '') + 'Check this is not already covered',
      page: 'guidance',
      phase: phaseMeta('need'),
      backHref: '/guidance/need',
      match: DUPLICATE_MATCH,
      affectedGuides: affectedGuides(),
      errorMessage
    })
    .code(statusCodes.ok)
}

function getNeedExisting(request, h) {
  // Only relevant on the AI path, after a document has been read.
  if (
    !request.yar?.get(NEED_KEY) ||
    request.yar?.get(NEED_SOURCE_KEY) !== 'ai'
  ) {
    return h.redirect('/guidance/need/review')
  }
  return renderNeedExisting(h)
}

function postNeedExisting(request, h) {
  // The affected guides are shown for awareness only. Continuing always proceeds
  // to make the guidance , a single forward step, not an update-or-new choice.
  request.yar?.set(MODE_KEY, 'new')
  request.yar?.clear?.(EDIT_GUIDE_KEY)
  request.yar?.clear?.(BASELINE_KEY)
  return h.redirect('/guidance/need/review')
}

// ── Phase 2: draft, upload the Word document ────────────────────────────────
// The draft documents added on the upload screen (filenames only).
const DRAFT_DOCS_KEY = 'guidanceDraftDocs'

function renderUpload(h, errorMessage, values) {
  return h
    .view('guidance/upload', {
      pageTitle: (errorMessage ? 'Error: ' : '') + 'Draft the guide',
      page: 'guidance',
      phase: phaseMeta('draft'),
      backHref: HUB,
      errorMessage,
      values: values ?? {},
      docs: (values && values.docs) || []
    })
    .code(statusCodes.ok)
}

function getUpload(request, h) {
  const docs = request.yar?.get(DRAFT_DOCS_KEY) ?? []
  return renderUpload(h, undefined, {
    startMethod: docs.length ? 'upload' : undefined,
    docs
  })
}

// "Add another" for the draft documents, plus a "start from a blank guide"
// branch that skips conversion and opens the editor on a starter template.
const DRAFT_DOC_PATTERN = /\.docx$/i
const DRAFT_DOC_TYPE_ERROR = 'Each document must be a Word document (.docx)'

// The main form post for phase 2. With JavaScript the MOJ component adds and
// deletes draft documents via the AJAX endpoints below, so this runs Continue
// (convert the uploads, or start from a blank guide). Without JavaScript it also
// handles add and delete.
function postUpload(request, h) {
  const payload = request.payload ?? {}
  const file = payload.documents
  if (file && typeof file.resume === 'function') {
    file.resume()
  }

  // Delete a document (no-JS path).
  if (payload.delete !== undefined && payload.delete !== '') {
    const docs = request.yar?.get(DRAFT_DOCS_KEY) ?? []
    const index = docs.indexOf(payload.delete)
    if (index !== -1) {
      docs.splice(index, 1)
      request.yar?.set(DRAFT_DOCS_KEY, docs)
    }
    return renderUpload(h, undefined, { startMethod: 'upload', docs })
  }

  // Add a document (no-JS path).
  if (payload.action === 'add') {
    const result = addDoc(
      request,
      DRAFT_DOCS_KEY,
      file,
      DRAFT_DOC_PATTERN,
      DRAFT_DOC_TYPE_ERROR
    )
    return renderUpload(h, result.error, {
      startMethod: 'upload',
      docs: result.docs
    })
  }

  // Continue: write the first draft with AI, or convert the uploaded documents.
  const method = payload.startMethod
  if (method === 'ai') {
    // Fill the editor with a ready-made draft, framed as written from the
    // ingested documents and the detected similar guidance.
    request.yar?.clear?.(DRAFT_DOCS_KEY)
    request.yar?.set(MARKDOWN_KEY, sampleGuidanceMarkdown)
    request.yar?.set(FILENAME_KEY, 'AI first draft')
    request.yar?.clear?.(SECTIONS_KEY)
    setFlash(
      request,
      'AI wrote a first draft from your briefing documents and similar guidance. Check every section and edit as needed.'
    )
    return h.redirect('/guidance/sections')
  }
  if (method !== 'upload') {
    return renderUpload(h, 'Select how you want to start your draft', {
      startMethod: method,
      docs: request.yar?.get(DRAFT_DOCS_KEY) ?? []
    })
  }
  // Forgiving: if a file is chosen but not yet uploaded, add it now.
  if (file?.hapi?.filename) {
    const result = addDoc(
      request,
      DRAFT_DOCS_KEY,
      file,
      DRAFT_DOC_PATTERN,
      DRAFT_DOC_TYPE_ERROR
    )
    if (result.error) {
      return renderUpload(h, result.error, {
        startMethod: 'upload',
        docs: result.docs
      })
    }
  }
  const docs = request.yar?.get(DRAFT_DOCS_KEY) ?? []
  if (!docs.length) {
    return renderUpload(h, 'Add a document, or start from a blank guide', {
      startMethod: 'upload',
      docs
    })
  }
  // Simulate converting the uploaded documents into editable sections.
  request.yar?.set(
    FILENAME_KEY,
    docs.length === 1 ? docs[0] : docs.length + ' documents'
  )
  request.yar?.clear?.(MARKDOWN_KEY)
  request.yar?.clear?.(SECTIONS_KEY)
  return h.redirect('/guidance/converted')
}

// AJAX upload endpoint for the MOJ multi file upload component (phase 2 draft).
function postDraftDocAdd(request, h) {
  const file = request.payload?.documents
  if (file && typeof file.resume === 'function') {
    file.resume()
  }
  const result = addDoc(
    request,
    DRAFT_DOCS_KEY,
    file,
    DRAFT_DOC_PATTERN,
    DRAFT_DOC_TYPE_ERROR
  )
  if (result.error) {
    return h.response({ error: { message: result.error } }).code(statusCodes.ok)
  }
  return h
    .response({
      success: {
        messageText: result.filename + ' uploaded',
        messageHtml: result.filename
      },
      file: { filename: result.filename, originalname: result.filename }
    })
    .code(statusCodes.ok)
}

// AJAX delete endpoint for the MOJ multi file upload component (phase 2 draft).
function postDraftDocDelete(request, h) {
  const filename = request.payload?.delete
  const docs = request.yar?.get(DRAFT_DOCS_KEY) ?? []
  const index = docs.indexOf(filename)
  if (index !== -1) {
    docs.splice(index, 1)
    request.yar?.set(DRAFT_DOCS_KEY, docs)
  }
  return h.response({ success: true }).code(statusCodes.ok)
}

// ── Phase 2: conversion confirmation (stubbed) ──────────────────────────────
function getConverted(request, h) {
  const filename = request.yar?.get(FILENAME_KEY)
  if (!filename) {
    return h.redirect('/guidance/upload')
  }

  return h
    .view('guidance/converted', {
      pageTitle: 'Your document has been converted',
      page: 'guidance',
      phase: phaseMeta('draft'),
      backHref: '/guidance/upload',
      filename
    })
    .code(statusCodes.ok)
}

// ── Phase 2: edit the guidance by section ───────────────────────────────────
// Real guidance is too long for one editor, and a well-sectioned guide is
// easier for the find-and-use assistant to search and cite. So the draft is
// split into sections from the document headings; the author confirms the
// structure and edits each section in turn.
function loadSections(request) {
  let sections = request.yar?.get(SECTIONS_KEY)
  if (!sections || sections.length === 0) {
    sections = splitIntoSections(currentMarkdown(request))
    request.yar?.set(SECTIONS_KEY, sections)
  }
  return sections
}

const SECTION_SNIPPET_LENGTH = 120

function snippetOf(body) {
  const text = (body ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // drop images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links to their text
    .replace(/[#*`>|]/g, '') // markdown punctuation and table pipes
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > SECTION_SNIPPET_LENGTH
    ? text.slice(0, SECTION_SNIPPET_LENGTH).trim() + '…'
    : text
}

function sectionList(sections) {
  return sections.map((section, index) => {
    const level = section.level || 2
    return {
      index,
      heading: section.heading || 'Untitled section',
      level,
      isTitle: level === 1,
      // Title and top sections sit flush; sub-sections indent one step.
      indent: Math.max(0, level - 2),
      snippet: snippetOf(section.body),
      // Deeper headings kept in the body, shown in the outline for orientation.
      subHeadings: subHeadingsOf(section.body).map((s) => ({
        text: s.text,
        indent: s.level - 2
      }))
    }
  })
}

// The split is automatic, so the author confirms it is right before editing the
// content, and can say plainly when it is not. The confirm screen shows the
// structure as a plain outline; the hub below shows the same sections with
// summaries and edit links.
function renderConfirmSections(request, h, errorMessage) {
  const sections = loadSections(request)
  return h
    .view('guidance/confirm-sections', {
      pageTitle: (errorMessage ? 'Error: ' : '') + 'Check the sections',
      page: 'guidance',
      phase: phaseMeta('draft'),
      backHref: '/guidance/converted',
      sections: sectionList(sections),
      errorMessage
    })
    .code(statusCodes.ok)
}

function getConfirmSections(request, h) {
  return renderConfirmSections(request, h)
}

function postConfirmSections(request, h) {
  const answer = request.payload?.structureOk
  if (answer !== 'yes' && answer !== 'no') {
    return renderConfirmSections(
      request,
      h,
      'Select whether the sections are right'
    )
  }
  if (answer === 'no') {
    setFlash(
      request,
      'Add, remove or edit the sections until they are right, then save.'
    )
  }
  return h.redirect('/guidance/sections')
}

// The contents nav lists the document's level 1-2 headings, with anchors that
// match the heading ids the preview renders (same slugify + collision counter).
function contentsFrom(sections) {
  const seen = new Map()
  return sections
    .filter((s) => s.heading && s.level <= 3)
    .map((s) => {
      let slug = slugify(s.heading) || 'section'
      const count = seen.get(slug) ?? 0
      seen.set(slug, count + 1)
      if (count > 0) {
        slug = slug + '-' + (count + 1)
      }
      return { text: s.heading, level: s.level, href: '#' + slug }
    })
}

// Phase 2: draft the whole guide on one screen. The body editor (one wide
// textarea with Write and Preview tabs and an inline formatting guide) copies
// GOV.UK's own editors (Whitehall, Content Publisher). A collapsible contents
// nav is added on top for navigating these very long RPA processing documents.
// One guide shown in three states , the original Word document, the converted
// markdown, and the published page , so people can see how a guide is made.
// Static example content.
const EXAMPLE_MARKDOWN = `## Check you are eligible

You can apply if you:

- manage at least 5 hectares of eligible land
- have management control of the land for the whole agreement period

## How to apply

1. Sign in to the Rural Payments service.
2. Select the actions you want to apply for.
3. Check your answers and submit your application.
`

const EXAMPLE_WORD_HTML = `<h2>Check you are eligible</h2>
<p>You can apply if you:</p>
<ul>
<li>manage at least 5 hectares of eligible land</li>
<li>have management control of the land for the whole agreement period</li>
</ul>
<h2>How to apply</h2>
<ol>
<li>Sign in to the Rural Payments service.</li>
<li>Select the actions you want to apply for.</li>
<li>Check your answers and submit your application.</li>
</ol>`

function getExample(request, h) {
  return h
    .view('guidance/example', {
      pageTitle: 'How a guide is made',
      page: 'guidance',
      backHref: '/guidance/converted',
      wordHtml: EXAMPLE_WORD_HTML,
      markdownText: EXAMPLE_MARKDOWN,
      publishedHtml: renderMarkdown(EXAMPLE_MARKDOWN)
    })
    .code(statusCodes.ok)
}

function getGuideEditor(request, h) {
  const markdown = currentMarkdown(request)
  return h
    .view('guidance/sections', {
      pageTitle: 'Draft the guide',
      page: 'guidance',
      phase: phaseMeta('draft'),
      backHref: '/guidance/converted',
      flash: takeFlash(request),
      body: markdown,
      contentsItems: contentsFrom(splitIntoSections(markdown)),
      fix: request.query?.fix ?? request.payload?.fix,
      previewHtml: addHeadingIds(
        applyImages(renderMarkdown(markdown), imagesObject())
      )
    })
    .code(statusCodes.ok)
}

function postGuideEditor(request, h) {
  const markdown = request.payload?.body ?? ''
  request.yar?.set(MARKDOWN_KEY, markdown)
  // The markdown is now the source of truth; sections are derived on read.
  request.yar?.clear?.(SECTIONS_KEY)

  if (request.payload?.action === 'preview') {
    return getGuideEditor(request, h)
  }
  // If we came here to fix a pre-publish issue, return to that issue.
  const fix = request.payload?.fix
  if (fix !== undefined && fix !== '') {
    return h.redirect(`/guidance/check/issues/${fix}?fixed-section=1`)
  }
  setPhaseStatus(request, 'draft', 'done')
  setFlash(request, 'Your draft has been saved.', true)
  return h.redirect(HUB)
}

// Screenshot data by filename. In this prototype images are not uploaded, so
// this stays empty and previews render labelled placeholders; the map is kept
// so the shared applyImages() call still works if real images are ever provided.
const uploadedImages = new Map()

function imagesObject() {
  return Object.fromEntries(uploadedImages)
}

// ── Phase 3: review and approve (a handoff to a subject matter expert) ──────
// Phase 3's AI opportunity: summarise the review comments into a clear,
// sectioned list of changes, so fragmented feedback becomes a worklist. Shown
// when the subject matter expert sends the guidance back for amends.
const REVIEW_AMENDS = {
  'amends-sme': {
    from: 'the subject matter expert',
    intro:
      'AI summarised the subject matter expert’s comments into the changes to make.',
    rows: [
      {
        key: { text: 'Mapping checks' },
        value: { text: 'Uses the wrong hold code. It should be HOLD972.' },
        actions: {
          items: [
            {
              href: '/guidance/sections',
              text: 'Fix',
              visuallyHiddenText: 'mapping checks'
            }
          ]
        }
      },
      {
        key: { text: 'Split and merge example' },
        value: { text: 'Add a step for re-linking the parcel to the SBI.' },
        actions: {
          items: [
            {
              href: '/guidance/sections',
              text: 'Fix',
              visuallyHiddenText: 'split and merge example'
            }
          ]
        }
      }
    ]
  }
}

// The review screen confirms-and-sends. The author has already drafted and
// previewed the guide in the editor, so it is not re-rendered here (that was
// duplicative and forced editing in two places).
function getReview(request, h) {
  const status = getProgress(request).review
  return h
    .view('guidance/review', {
      pageTitle: 'Review and approve the guidance',
      page: 'guidance',
      phase: phaseMeta('review'),
      backHref: HUB,
      status,
      amends: REVIEW_AMENDS[status],
      editGuide: request.yar?.get(EDIT_GUIDE_KEY)
    })
    .code(statusCodes.ok)
}

function postReview(request, h) {
  const action = request.payload?.action

  // Review and approve is a single handoff: the author sends the guide to a
  // subject matter expert (a policy, technical or operational specialist) who
  // reviews and approves it, simulated from the author's point of view.
  if (action === 'send') {
    setPhaseStatus(request, 'review', 'awaiting-approval')
    return h.redirect('/guidance/review')
  }
  if (action === 'approve') {
    setPhaseStatus(request, 'review', 'done')
    setFlash(request, 'Your guide is approved.', true)
    return h.redirect(HUB)
  }
  if (action === 'amends') {
    setPhaseStatus(request, 'review', 'amends-sme')
    return h.redirect('/guidance/review')
  }
  return h.redirect('/guidance/review')
}

// ── Phase 4: readiness testing (a handoff to the Model Office team) ──────────
// Two steps, copying GOV.UK's "Add another" + "Check answers" patterns: AI seeds
// a set of test scenarios from the guidance, the author reviews/edits/removes/
// adds them, then confirms and sends them to the Model Office team. Scenarios are
// plain Given/When/Then so a content designer can review them.
const TEST_SCENARIO_KEY = 'testScenarios'
const TEST_SCENARIO_SEED = [
  {
    title: 'A parcel was never linked to the SBI',
    body: 'Given a parcel that was never linked to the SBI, when the processor works the case, then they follow the Operations Resolution route, apply HOLD972, and do not close the case.'
  },
  {
    title: 'A mapping change splits a parcel across two agreements',
    body: 'Given a parcel split across two agreements, when the processor checks the guidance, then it says which agreement keeps the parcel and how to re-link it.'
  },
  {
    title: 'A parcel is in both a split and a merge',
    body: 'Given a parcel in both a split and a merge, when the processor follows the guidance, then it covers the combined case, not just a split or a merge on its own.'
  },
  {
    title: 'The tenure change happened after the claim was submitted',
    body: 'Given a tenure change after the claim was submitted, when the processor works it, then the guidance gives the hold code, or routes it for a policy decision.'
  }
]

function loadScenarios(request) {
  let list = request.yar?.get(TEST_SCENARIO_KEY)
  if (!list) {
    list = TEST_SCENARIO_SEED.map((scenario) => ({ ...scenario }))
    request.yar?.set(TEST_SCENARIO_KEY, list)
  }
  return list
}

function scenarioRows(list) {
  return list.map((scenario, index) => ({
    key: { text: scenario.title },
    value: { text: scenario.body },
    actions: {
      items: [
        {
          href: '/guidance/test/scenario/' + index,
          text: 'Change',
          visuallyHiddenText: scenario.title
        }
      ]
    }
  }))
}

function getTest(request, h) {
  const status = getProgress(request).readiness
  return h
    .view('guidance/test', {
      pageTitle: 'Readiness testing',
      page: 'guidance',
      phase: phaseMeta('readiness'),
      backHref: HUB,
      status,
      flash: takeFlash(request),
      scenarioRows: status ? null : scenarioRows(loadScenarios(request))
    })
    .code(statusCodes.ok)
}

// Step 1 helper: add or change a single scenario (the "Add another" sub-form).
function getScenarioForm(request, h) {
  const list = loadScenarios(request)
  const isNew = request.params.id === 'new'
  const index = Number(request.params.id)
  const scenario = isNew ? { title: '', body: '' } : list[index]
  if (!scenario) {
    return h.redirect('/guidance/test')
  }
  return h
    .view('guidance/test-scenario', {
      pageTitle: isNew ? 'Add a test scenario' : 'Change the test scenario',
      page: 'guidance',
      phase: phaseMeta('readiness'),
      backHref: '/guidance/test',
      isNew,
      index,
      title: scenario.title,
      body: scenario.body
    })
    .code(statusCodes.ok)
}

function postScenarioForm(request, h) {
  const list = loadScenarios(request)
  const isNew = request.params.id === 'new'
  const index = Number(request.params.id)

  if (request.payload?.action === 'remove' && !isNew && list[index]) {
    list.splice(index, 1)
    request.yar?.set(TEST_SCENARIO_KEY, list)
    return h.redirect('/guidance/test')
  }

  const scenario = {
    title: (request.payload?.title ?? '').trim(),
    body: (request.payload?.body ?? '').trim()
  }
  if (isNew) {
    list.push(scenario)
  } else if (list[index]) {
    list[index] = scenario
  }
  request.yar?.set(TEST_SCENARIO_KEY, list)
  return h.redirect('/guidance/test')
}

function postTest(request, h) {
  const action = request.payload?.action

  if (action === 'send') {
    setPhaseStatus(request, 'readiness', 'awaiting-readiness')
    return h.redirect('/guidance/test')
  }
  if (action === 'pass') {
    setPhaseStatus(request, 'readiness', 'done')
    setFlash(request, 'The Model Office team passed the guide.', true)
    return h.redirect(HUB)
  }
  if (action === 'issues') {
    setPhaseStatus(request, 'readiness', 'issues')
    return h.redirect('/guidance/test')
  }
  return h.redirect('/guidance/test')
}

// ── Phase 5: the AI pre-publish check (the worklist) ────────────────────────
function getCheck(request, h) {
  const findings = mockAnalysisData.findings ?? []
  const decisions = getDecisions(request)
  const remaining = countBlockersRemaining(findings, decisions)
  const mustFixItems = buildTaskItems(findings, decisions, true)

  return h
    .view('guidance/check', {
      pageTitle: 'Check before publishing',
      page: 'guidance',
      phase: phaseMeta('publish'),
      backHref: HUB,
      flash: takeFlash(request),
      state: remaining > 0 ? 'blocked' : 'cleared',
      remaining,
      reviewedCount: mustFixItems.length - remaining,
      mustFixTotal: mustFixItems.length,
      mustFixItems,
      considerItems: buildTaskItems(findings, decisions, false)
    })
    .code(statusCodes.ok)
}

function getCheckIssue(request, h) {
  const index = Number(request.params.index)
  const finding =
    Number.isInteger(index) && index >= 0
      ? mockAnalysisData.findings?.[index]
      : undefined

  if (!finding) {
    return h.redirect(CHECK_BASE)
  }

  return h
    .view('guidance/check-issue', {
      pageTitle: finding.issue,
      page: 'guidance',
      phase: phaseMeta('publish'),
      backHref: CHECK_BASE,
      issueIndex: index,
      finding: {
        ...finding,
        sectionLabel: formatSection(finding.section),
        mustFix: isMustFix(finding.severity)
      },
      decision: getDecisions(request)[index] ?? null
    })
    .code(statusCodes.ok)
}

function postCheckIssue(request, h) {
  const index = Number(request.params.index)
  const finding = mockAnalysisData.findings?.[index]

  if (!finding) {
    return h.redirect(CHECK_BASE)
  }

  const decision = request.payload?.decision
  if (decision === 'approved' || decision === 'rejected') {
    setDecision(request, index, decision)
  }
  return h.redirect(CHECK_BASE)
}

function getPublishConfirm(request, h) {
  const remaining = countBlockersRemaining(
    mockAnalysisData.findings ?? [],
    getDecisions(request)
  )
  if (remaining > 0) {
    return h.redirect(CHECK_BASE)
  }

  return h
    .view('guidance/publish', {
      pageTitle: 'Ready to publish',
      page: 'guidance',
      phase: phaseMeta('publish'),
      backHref: CHECK_BASE
    })
    .code(statusCodes.ok)
}

function postPublish(request, h) {
  const remaining = countBlockersRemaining(
    mockAnalysisData.findings ?? [],
    getDecisions(request)
  )
  if (remaining > 0) {
    return h.redirect(CHECK_BASE)
  }

  setPhaseStatus(request, 'publish', 'done')
  return h.redirect('/guidance/published')
}

// A convenience for the worklist: approve every essential (must-fix) suggestion
// in one go, rather than opening each in turn.
function postCheckFixAll(request, h) {
  ;(mockAnalysisData.findings ?? []).forEach((finding, index) => {
    if (isMustFix(finding.severity)) {
      setDecision(request, index, 'approved')
    }
  })
  return h.redirect(CHECK_BASE)
}

// ── Phase 5: published confirmation ─────────────────────────────────────────
function getPublished(request, h) {
  return h
    .view('guidance/published', {
      pageTitle: 'Guide published',
      page: 'guidance',
      reference: 'RPA-2026-0042'
    })
    .code(statusCodes.ok)
}

export const getStartController = { handler: getStart }
export const getWhatController = { handler: getWhat }
export const postWhatController = { handler: postWhat }
export const getLibraryController = { handler: getLibrary }
export const openGuideController = { handler: openGuide }
export const getGuideDetailController = { handler: getGuideDetail }
export const postRequestAccessController = { handler: postRequestAccess }
export const getChangesController = { handler: getChanges }
export const getPublishedGuideController = { handler: getPublishedGuide }
export const getViewerGalleryController = { handler: getViewerGallery }
export const getViewerOpenController = { handler: getViewerOpen }
export const getTemplatesListController = { handler: getTemplatesList }
export const getTemplateNewController = { handler: getTemplateNew }
export const postTemplateNewController = { handler: postTemplateNew }
export const getTemplateEditController = { handler: getTemplateEdit }
export const postTemplateEditController = { handler: postTemplateEdit }
export const postTemplateDeleteController = { handler: postTemplateDelete }
export const getTaskListController = { handler: getTaskList }
export const getNeedController = { handler: getNeed }
export const postNeedUploadController = { handler: postNeedUpload }
export const postNeedDocAddController = { handler: postNeedDocAdd }
export const postNeedDocDeleteController = { handler: postNeedDocDelete }
export const getNeedRestartController = { handler: getNeedRestart }
export const getNeedDetailsController = { handler: getNeedDetails }
export const postNeedDetailsController = { handler: postNeedDetails }
export const getNeedReviewController = { handler: getNeedReview }
export const postNeedReviewController = { handler: postNeedReview }
export const getNeedExistingController = { handler: getNeedExisting }
export const postNeedExistingController = { handler: postNeedExisting }
export const getUploadController = { handler: getUpload }
export const postUploadController = { handler: postUpload }
export const postDraftDocAddController = { handler: postDraftDocAdd }
export const postDraftDocDeleteController = { handler: postDraftDocDelete }
export const getConvertedController = { handler: getConverted }
export const getConfirmSectionsController = { handler: getConfirmSections }
export const postConfirmSectionsController = { handler: postConfirmSections }
export const getGuideEditorController = { handler: getGuideEditor }
export const getExampleController = { handler: getExample }
export const postGuideEditorController = { handler: postGuideEditor }
export const getReviewController = { handler: getReview }
export const postReviewController = { handler: postReview }
export const getTestController = { handler: getTest }
export const postTestController = { handler: postTest }
export const getScenarioFormController = { handler: getScenarioForm }
export const postScenarioFormController = { handler: postScenarioForm }
export const getCheckController = { handler: getCheck }
export const getCheckIssueController = { handler: getCheckIssue }
export const postCheckIssueController = { handler: postCheckIssue }
export const postCheckFixAllController = { handler: postCheckFixAll }
export const getPublishConfirmController = { handler: getPublishConfirm }
export const postPublishController = { handler: postPublish }
export const getPublishedController = { handler: getPublished }
