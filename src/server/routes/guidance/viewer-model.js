// Builds the generic render context handed to every viewer template.
//
// Whatever the presentation, a viewer gets the same shape: metadata, a full
// rendered body, structured sections, a contents list, and a server-driven step
// model. A template picks whichever it needs — bodyHtml for a single page,
// sections for an accordion or side-nav, step/steps for click-through. The
// harness never assumes how a doc is presented, so a designer can build a new
// viewer without touching this file. Stepping is tuned per doc through the
// `steps` frontmatter field (`single` or `section`), honouring "generic /
// per template".
//
// All rendering reuses the shared, sanitising Markdown pipeline in
// src/common/markdown.js and the section splitter in src/common/sections.js —
// there is no bespoke rendering here.

import {
  renderMarkdown,
  applyImages,
  addHeadingIds,
  slugify
} from '#/common/markdown.js'
import {
  splitIntoSections,
  joinSections,
  subHeadingsOf
} from '#/common/sections.js'

// This prototype has no uploaded screenshots, so image placeholders stay as
// placeholders (mirrors getPublishedGuide in controller.js).
const NO_IMAGES = {}

function render(markdown) {
  return addHeadingIds(applyImages(renderMarkdown(markdown), NO_IMAGES))
}

// The full body as a reader sees it: the document's own title becomes the page
// heading (rendered by the template from guide.title), so drop it here and
// promote the remaining headings one level. Same treatment as the published
// guide view (controller.js getPublishedGuide).
function bodyHtmlFrom(markdown) {
  const body = markdown
    .replace(/^\s*#[^\n]*\r?\n+/, '')
    .replace(/^#(#+)/gm, '$1')
  return render(body)
}

function enrichSection(section) {
  return {
    heading: section.heading,
    level: section.level,
    id: slugify(section.heading),
    html: render(section.body),
    subHeadings: subHeadingsOf(section.body)
  }
}

// Group the level-2+ sections into steps: each level-2 heading starts a step and
// its deeper sub-sections fold into it. A non-empty document intro (the text
// under the title, before the first heading) becomes the opening step.
function buildSteps(sections, lead, guideTitle, bodyHtml, mode) {
  if (mode === 'single') {
    return [{ title: guideTitle, level: 1, html: bodyHtml }]
  }

  const groups = []
  for (const section of sections.filter((s) => s.level >= 2)) {
    if (section.level <= 2 || groups.length === 0) {
      groups.push([section])
    } else {
      groups[groups.length - 1].push(section)
    }
  }

  const steps = groups.map((group) => {
    const [head, ...rest] = group
    // The step title is shown by the template, so render the group body without
    // the boundary heading but keep the sub-section headings.
    const markdown = [head.body, joinSections(rest)].filter(Boolean).join('\n\n')
    return { title: head.heading, level: head.level, html: render(markdown) }
  })

  if (lead) {
    steps.unshift({ title: guideTitle, level: 1, html: lead })
  }

  // A document with no headings at all still needs one step to show.
  return steps.length > 0
    ? steps
    : [{ title: guideTitle, level: 1, html: bodyHtml }]
}

/**
 * @param {object} doc      a document from viewer-content.js
 * @param {string} viewerId the viewer template id (for building step links)
 * @param {number} rawStep  the requested step from the query string
 */
function buildViewerModel(doc, viewerId, rawStep) {
  const guide = {
    id: doc.id,
    title: doc.title,
    type: doc.type,
    summary: doc.summary,
    ...doc.data
  }

  const bodyHtml = bodyHtmlFrom(doc.markdown)

  const rawSections = splitIntoSections(doc.markdown)
  const first = rawSections[0]
  const lead = first && first.level === 1 ? render(first.body) : ''
  const sections = rawSections
    .filter((s) => s.level >= 2)
    .map(enrichSection)

  const contents = sections.map((s) => ({
    text: s.heading,
    level: s.level,
    href: `#${s.id}`
  }))

  const mode = doc.data.steps === 'single' ? 'single' : 'section'
  const allSteps = buildSteps(sections, lead, guide.title, bodyHtml, mode)

  const totalSteps = allSteps.length
  const requested = Number.parseInt(rawStep, 10)
  const stepIndex = Number.isNaN(requested)
    ? 0
    : Math.min(Math.max(requested, 0), totalSteps - 1)

  // Steps stay within the same viewer, so Previous/Next point back at the open
  // route keeping the current viewer selected.
  const base = `/guidance/viewer/open/${doc.id}?viewer=${viewerId}`
  const steps = allSteps.map((s, index) => ({ ...s, index }))
  const step = {
    ...steps[stepIndex],
    stepIndex,
    totalSteps,
    isFirst: stepIndex === 0,
    isLast: stepIndex === totalSteps - 1,
    prevHref: `${base}&step=${stepIndex - 1}`,
    nextHref: `${base}&step=${stepIndex + 1}`
  }

  return {
    pageTitle: guide.title,
    page: 'guidance',
    viewerId,
    guide,
    lead,
    bodyHtml,
    sections,
    contents,
    steps,
    step
  }
}

export { buildViewerModel }
