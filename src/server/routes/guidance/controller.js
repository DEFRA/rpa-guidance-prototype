import { statusCodes } from '#/server/common/constants/status-codes.js'

import { renderMarkdown } from '#/common/markdown.js'
import { sampleGuidanceMarkdown } from './mock-guidance-markdown.js'
import { mockAnalysisData } from './mock-analysis-data.js'
import { severityRank, isMustFix, formatSection } from './shared.js'
import {
  getFixedIssues,
  setFixedIssue,
  clearFixedIssues
} from './fixed-issues.js'

// Session keys for the one document moving through the journey.
const MARKDOWN_KEY = 'guidanceMarkdown'
const FILENAME_KEY = 'guidanceFilename'
const PROGRESS_KEY = 'guidanceProgress'
const FLASH_KEY = 'guidanceFlash'

// Namespaces the pre-publish check's "fixed" and "ready" state.
const CHECK_ID = 'guidance'
const CHECK_BASE = '/guidance/check'
const HUB = '/guidance/task-list'

// The make-the-guidance phases from the service blueprint, shown as a task-list
// hub. The journey is told from the designer's point of view: they draft the
// guidance, then hand it off to other people (an approver, then the Model
// Office team). Those handoffs are represented as statuses the designer sees,
// not as separate users logging in.
const PHASES = [
  { id: 'need', name: 'Understand the policy', href: '/guidance/need' },
  { id: 'draft', name: 'Draft the guidance', href: '/guidance/upload' },
  { id: 'review', name: 'Review and approve', href: '/guidance/review' },
  {
    id: 'readiness',
    name: 'Readiness testing (Model Office)',
    href: '/guidance/test'
  },
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
  'awaiting-review': { text: 'Awaiting review', classes: 'govuk-tag--grey' },
  amends: { text: 'Sent back for amends', classes: 'govuk-tag--orange' },
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

// ── Pre-publish worklist helpers (shared with the publishing check) ─────────
function buildTaskItems(findings, fixedIssues, wantMustFix) {
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
      status: fixedIssues.has(index)
        ? { text: 'Fixed' }
        : {
            tag: wantMustFix
              ? { text: 'Must fix', classes: 'govuk-tag--red' }
              : { text: 'Optional', classes: 'govuk-tag--grey' }
          }
    }))
}

function countBlockersRemaining(findings, fixedIssues) {
  return findings.filter(
    (finding, index) => isMustFix(finding.severity) && !fixedIssues.has(index)
  ).length
}

// ── Start ──────────────────────────────────────────────────────────────────
export const getStartController = {
  handler(request, h) {
    // Each run starts from a clean slate.
    request.yar?.clear?.(MARKDOWN_KEY)
    request.yar?.clear?.(FILENAME_KEY)
    request.yar?.clear?.(PROGRESS_KEY)
    request.yar?.clear?.(FLASH_KEY)
    clearFixedIssues(request, CHECK_ID)

    return h.view('guidance/start', {
      pageTitle: 'Make and publish guidance'
    })
  }
}

// ── The hub: the five phases as a task list ─────────────────────────────────
export const getTaskListController = {
  handler(request, h) {
    return h.view('guidance/task-list', {
      pageTitle: 'Make and publish guidance',
      backHref: '/',
      items: buildHubItems(request),
      flash: takeFlash(request)
    })
  }
}

// ── Phase 1: understand the policy ──────────────────────────────────────────
export const getNeedController = {
  handler(request, h) {
    return h.view('guidance/need', {
      pageTitle: 'Understand the policy',
      phase: phaseMeta('need'),
      backHref: HUB
    })
  }
}

export const postNeedController = {
  handler(request, h) {
    setPhaseStatus(request, 'need', 'done')
    return h.redirect(HUB)
  }
}

// ── Phase 2: draft, upload the Word document ────────────────────────────────
function renderUpload(h, errorMessage) {
  return h.view('guidance/upload', {
    pageTitle: (errorMessage ? 'Error: ' : '') + 'Upload the guidance document',
    phase: phaseMeta('draft'),
    backHref: HUB,
    errorMessage
  })
}

export const getUploadController = {
  handler(request, h) {
    return renderUpload(h)
  }
}

export const postUploadController = {
  handler(request, h) {
    const file = request.payload?.file
    const filename = file?.hapi?.filename?.trim()

    // The prototype does not keep the file, so drain the stream to let the
    // request finish cleanly.
    if (file && typeof file.resume === 'function') {
      file.resume()
    }

    if (!filename) {
      return renderUpload(h, 'Select a Word document to upload')
    }
    if (!/\.docx$/i.test(filename)) {
      return renderUpload(
        h,
        'The selected file must be a Word document (.docx)'
      )
    }

    request.yar?.set(FILENAME_KEY, filename)
    // A new document starts again from the freshly converted sample.
    request.yar?.clear?.(MARKDOWN_KEY)

    return h.redirect('/guidance/converted')
  }
}

// ── Phase 2: conversion confirmation (stubbed) ──────────────────────────────
export const getConvertedController = {
  handler(request, h) {
    const filename = request.yar?.get(FILENAME_KEY)
    if (!filename) {
      return h.redirect('/guidance/upload')
    }

    return h.view('guidance/converted', {
      pageTitle: 'Your document has been converted',
      phase: phaseMeta('draft'),
      backHref: '/guidance/upload',
      filename
    })
  }
}

// ── Phase 2: edit the markdown ──────────────────────────────────────────────
function renderEdit(h, markdown) {
  return h.view('guidance/edit', {
    pageTitle: 'Edit the guidance',
    phase: phaseMeta('draft'),
    backHref: '/guidance/converted',
    markdown,
    previewHtml: renderMarkdown(markdown)
  })
}

export const getEditController = {
  handler(request, h) {
    return renderEdit(h, currentMarkdown(request))
  }
}

export const postEditController = {
  handler(request, h) {
    const markdown = request.payload?.markdown ?? ''
    request.yar?.set(MARKDOWN_KEY, markdown)

    if (request.payload?.action === 'continue') {
      setPhaseStatus(request, 'draft', 'done')
      return h.redirect(HUB)
    }
    return renderEdit(h, markdown)
  }
}

// ── Phase 3: review and approve (a handoff to the approver) ─────────────────
export const getReviewController = {
  handler(request, h) {
    return h.view('guidance/review', {
      pageTitle: 'Review and approve the guidance',
      phase: phaseMeta('review'),
      backHref: HUB,
      status: getProgress(request).review,
      guideHtml: renderMarkdown(currentMarkdown(request))
    })
  }
}

export const postReviewController = {
  handler(request, h) {
    const action = request.payload?.action

    if (action === 'send') {
      setPhaseStatus(request, 'review', 'awaiting-review')
      return h.redirect('/guidance/review')
    }
    if (action === 'approve') {
      setPhaseStatus(request, 'review', 'done')
      setFlash(request, 'The approver approved the guidance.', true)
      return h.redirect(HUB)
    }
    if (action === 'amends') {
      setPhaseStatus(request, 'review', 'amends')
      return h.redirect('/guidance/review')
    }
    return h.redirect('/guidance/review')
  }
}

// ── Phase 4: readiness testing (a handoff to the Model Office team) ──────────
export const getTestController = {
  handler(request, h) {
    return h.view('guidance/test', {
      pageTitle: 'Readiness testing',
      phase: phaseMeta('readiness'),
      backHref: HUB,
      status: getProgress(request).readiness
    })
  }
}

export const postTestController = {
  handler(request, h) {
    const action = request.payload?.action

    if (action === 'send') {
      setPhaseStatus(request, 'readiness', 'awaiting-readiness')
      return h.redirect('/guidance/test')
    }
    if (action === 'pass') {
      setPhaseStatus(request, 'readiness', 'done')
      setFlash(request, 'The Model Office team passed the guidance.', true)
      return h.redirect(HUB)
    }
    if (action === 'issues') {
      setPhaseStatus(request, 'readiness', 'issues')
      return h.redirect('/guidance/test')
    }
    return h.redirect('/guidance/test')
  }
}

// ── Phase 5: the AI pre-publish check (the worklist) ────────────────────────
export const getCheckController = {
  handler(request, h) {
    const result = mockAnalysisData
    const findings = result.findings ?? []
    const fixedIssues = getFixedIssues(request, CHECK_ID)
    const remaining = countBlockersRemaining(findings, fixedIssues)
    const state = remaining > 0 ? 'blocked' : 'cleared'

    return h.view('guidance/check', {
      pageTitle: 'Pre-publish check',
      phase: phaseMeta('publish'),
      backHref: HUB,
      state,
      remaining,
      mustFixItems: buildTaskItems(findings, fixedIssues, true),
      considerItems: buildTaskItems(findings, fixedIssues, false)
    })
  }
}

export const getCheckIssueController = {
  handler(request, h) {
    const result = mockAnalysisData
    const index = Number(request.params.index)
    const finding =
      Number.isInteger(index) && index >= 0
        ? result.findings?.[index]
        : undefined

    if (!finding) {
      return h
        .view('error/index', {
          pageTitle: 'Page not found',
          heading: statusCodes.notFound,
          message: 'Issue not found'
        })
        .code(statusCodes.notFound)
    }

    return h.view('guidance/check-issue', {
      pageTitle: finding.issue,
      phase: phaseMeta('publish'),
      backHref: CHECK_BASE,
      issueIndex: index,
      finding: {
        ...finding,
        sectionLabel: formatSection(finding.section),
        mustFix: isMustFix(finding.severity)
      },
      fixed: getFixedIssues(request, CHECK_ID).has(index)
    })
  }
}

export const postCheckIssueController = {
  handler(request, h) {
    const index = Number(request.params.index)
    const finding = mockAnalysisData.findings?.[index]

    if (!finding) {
      return h
        .view('error/index', {
          pageTitle: 'Page not found',
          heading: statusCodes.notFound,
          message: 'Issue not found'
        })
        .code(statusCodes.notFound)
    }

    setFixedIssue(request, CHECK_ID, index, request.payload?.fixed === 'true')
    return h.redirect(CHECK_BASE)
  }
}

export const getPublishConfirmController = {
  handler(request, h) {
    const remaining = countBlockersRemaining(
      mockAnalysisData.findings ?? [],
      getFixedIssues(request, CHECK_ID)
    )
    if (remaining > 0) {
      return h.redirect(CHECK_BASE)
    }

    return h.view('guidance/publish', {
      pageTitle: 'Ready to publish',
      phase: phaseMeta('publish'),
      backHref: CHECK_BASE
    })
  }
}

export const postPublishController = {
  handler(request, h) {
    const remaining = countBlockersRemaining(
      mockAnalysisData.findings ?? [],
      getFixedIssues(request, CHECK_ID)
    )
    if (remaining > 0) {
      return h.redirect(CHECK_BASE)
    }

    setPhaseStatus(request, 'publish', 'done')
    return h.redirect('/guidance/published')
  }
}

// A convenience for the worklist: mark every essential (must-fix) issue as
// fixed in one go, rather than opening each in turn.
export const postCheckFixAllController = {
  handler(request, h) {
    ;(mockAnalysisData.findings ?? []).forEach((finding, index) => {
      if (isMustFix(finding.severity)) {
        setFixedIssue(request, CHECK_ID, index, true)
      }
    })
    return h.redirect(CHECK_BASE)
  }
}

// ── Phase 5: published confirmation ─────────────────────────────────────────
export const getPublishedController = {
  handler(request, h) {
    return h.view('guidance/published', {
      pageTitle: 'Guidance published',
      reference: 'RPA-2026-0042'
    })
  }
}
