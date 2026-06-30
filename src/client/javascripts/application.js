import * as govukFrontend from 'govuk-frontend'
import { MultiFileUpload } from '@ministryofjustice/frontend/moj/components/multi-file-upload/multi-file-upload.mjs'

import {
  renderMarkdown,
  addHeadingIds,
  slugify
} from '../../common/markdown.js'

govukFrontend.initAll()
// MOJ multi file upload is not a govuk-frontend component, so initialise it
// separately. Config (upload and delete URLs) comes from data attributes.
govukFrontend.createAll(MultiFileUpload)

// Progressive enhancement: buttons that need JavaScript are hidden by default
// and revealed only when this script runs, so there are no broken controls
// without JavaScript.
const printButton = document.querySelector('[data-module="app-print-button"]')

if (printButton) {
  printButton.removeAttribute('hidden')
  printButton.addEventListener('click', () => {
    window.print()
  })
}

const COPY_FEEDBACK_MS = 2000
// After posting a question, the demand answer page is reloaded with the focus
// hash so keyboard and screen-reader users land on the new answer rather than
// the top of the page.
if (window.location.hash === '#latest-answer') {
  const latestAnswer = document.getElementById('latest-answer')
  if (latestAnswer) {
    latestAnswer.focus()
  }
}

const copyButton = document.querySelector('[data-module="app-copy-button"]')

if (copyButton) {
  copyButton.removeAttribute('hidden')
  copyButton.addEventListener('click', () => {
    const answer = document.querySelector(
      '.app-chat-message--assistant .app-chat-message__bubble'
    )
    if (answer && navigator.clipboard) {
      navigator.clipboard.writeText(answer.innerText)
      const original = copyButton.textContent
      copyButton.textContent = 'Copied'
      window.setTimeout(() => {
        copyButton.textContent = original
      }, COPY_FEEDBACK_MS)
    }
  })
}

// Live markdown preview on the editor's Write/Preview tabs: re-render the
// preview as the author types, so switching to Preview always shows the latest.
// This mirrors the in-place edit/preview toggle in Whitehall and Content Publisher.
const PREVIEW_DEBOUNCE_MS = 200
const editor = document.querySelector('[data-module="app-markdown-editor"]')

if (editor) {
  const input = editor.querySelector('textarea')
  const preview = editor.querySelector('[data-module="app-markdown-preview"]')

  if (input && preview) {
    let timer
    input.addEventListener('input', () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        // Heading ids are kept on the rendered preview so the contents links
        // still resolve after the author edits.
        preview.innerHTML = addHeadingIds(renderMarkdown(input.value))
      }, PREVIEW_DEBOUNCE_MS)
    })
  }
}

// Contents nav. Clicking a section, or free-scrolling one pane, remembers the
// section; switching tab jumps the other pane to it. Headings are matched by
// slug (the same slug the preview ids and the contents links use), so the jump
// cannot drift from the contents.
const guideContents = document.querySelector(
  '[data-module="app-guide-contents"]'
)

if (guideContents) {
  const guideTextarea = document.getElementById('body')
  const guidePreview = document.querySelector(
    '[data-module="app-markdown-preview"]'
  )
  let currentSlug = null

  const lineHeight = () =>
    parseFloat(window.getComputedStyle(guideTextarea).lineHeight) || 24

  const anchors = () => {
    const out = []
    if (!guideTextarea) {
      return out
    }
    const seen = new Map()
    const lines = guideTextarea.value.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,3})\s+(.*)$/)
      if (!match) {
        continue
      }
      let slug = slugify(match[2].trim()) || 'section'
      const count = seen.get(slug) ?? 0
      seen.set(slug, count + 1)
      if (count > 0) {
        slug = slug + '-' + (count + 1)
      }
      out.push({ slug, line: i })
    }
    return out
  }

  // Scroll the textarea so the heading sits near the top. Set scrollTop directly
  // (no caret move, which would make the browser re-scroll to the caret).
  const scrollWriteTo = (slug) => {
    if (!guideTextarea) {
      return
    }
    const anchor = anchors().find((a) => a.slug === slug)
    if (anchor) {
      guideTextarea.scrollTop = Math.max(0, (anchor.line - 1) * lineHeight())
    }
  }

  // Scroll within the preview container only, not the whole page.
  const scrollPreviewTo = (slug) => {
    if (!guidePreview) {
      return
    }
    const target = guidePreview.querySelector('#' + window.CSS.escape(slug))
    if (target) {
      guidePreview.scrollTop +=
        target.getBoundingClientRect().top -
        guidePreview.getBoundingClientRect().top
    }
  }

  const topSlugOfWrite = () => {
    const list = anchors()
    if (!list.length) {
      return null
    }
    const topLine = guideTextarea.scrollTop / lineHeight()
    let slug = list[0].slug
    for (const anchor of list) {
      if (anchor.line <= topLine + 1) {
        slug = anchor.slug
      } else {
        break
      }
    }
    return slug
  }

  const topSlugOfPreview = () => {
    if (!guidePreview) {
      return null
    }
    const headings = guidePreview.querySelectorAll('h2[id], h3[id], h4[id]')
    const top = guidePreview.getBoundingClientRect().top
    let slug = headings.length ? headings[0].id : null
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top - top <= 2) {
        slug = heading.id
      } else {
        break
      }
    }
    return slug
  }

  guideContents.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (!link) {
      return
    }
    event.preventDefault()
    currentSlug = link.hash.slice(1)
    scrollWriteTo(currentSlug)
    scrollPreviewTo(currentSlug)
  })

  // Free-scrolling either pane updates the remembered section (throttled).
  let pending = false
  const track = (topSlug) => () => {
    if (pending) {
      return
    }
    pending = true
    window.requestAnimationFrame(() => {
      pending = false
      const slug = topSlug()
      if (slug) {
        currentSlug = slug
      }
    })
  }
  if (guideTextarea) {
    guideTextarea.addEventListener('scroll', track(topSlugOfWrite))
  }
  if (guidePreview) {
    guidePreview.addEventListener('scroll', track(topSlugOfPreview))
  }

  // Switching tab lands you on the section you were last looking at.
  document.querySelectorAll('.govuk-tabs__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (!currentSlug) {
        return
      }
      window.setTimeout(() => {
        scrollWriteTo(currentSlug)
        scrollPreviewTo(currentSlug)
      }, 0)
    })
  })
}

// Collapse or expand the contents (WAI-ARIA disclosure). "Hide contents" sits
// under the Contents heading; when collapsed the contents is removed and a
// "Show contents" control takes its place at the top of the editor. Focus moves
// to whichever control replaces the one that was clicked.
const hideContents = document.querySelector('[data-module="app-contents-hide"]')
const showContents = document.querySelector('[data-module="app-contents-show"]')
const contentsRegion = document.getElementById('guide-contents')

if (hideContents && showContents && contentsRegion) {
  const setCollapsed = (collapsed) => {
    contentsRegion.hidden = collapsed
    showContents.hidden = !collapsed
  }
  hideContents.addEventListener('click', () => {
    setCollapsed(true)
    showContents.focus()
  })
  showContents.addEventListener('click', () => {
    setCollapsed(false)
    hideContents.focus()
  })
}

// Guide library: server-side search, filter, sort and pagination (a GOV.UK
// finder shape, so it scales to hundreds of rows). Changing a facet or the sort
// submits the form, which makes the explicit Apply button redundant. The filter
// column can be collapsed to give the table the full width.
const guideLibrary = document.querySelector('[data-module="app-guide-library"]')

if (guideLibrary) {
  const sortSelect = guideLibrary.querySelector(
    '[data-module="app-guide-sort"]'
  )
  const applyButton = guideLibrary.querySelector(
    '[data-module="app-apply-filters"]'
  )
  const filterToggle = guideLibrary.querySelector(
    '[data-module="app-filter-toggle"]'
  )

  if (applyButton) {
    // Filters auto-apply on change with JS on, so the button is redundant.
    // Remove it rather than set .hidden, which govuk-button's display overrides.
    applyButton.remove()
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => guideLibrary.submit())
  }
  guideLibrary.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.addEventListener('change', () => guideLibrary.submit())
  })

  if (filterToggle) {
    filterToggle.addEventListener('click', () => {
      const hidden = guideLibrary.classList.toggle(
        'app-library--filters-hidden'
      )
      filterToggle.setAttribute('aria-expanded', String(!hidden))
      filterToggle.textContent = hidden ? 'Show filters' : 'Hide filters'
    })
  }
}
