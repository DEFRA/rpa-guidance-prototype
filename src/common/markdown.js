// A small, dependency-free Markdown to HTML renderer shared by the server and
// the browser.
//
// The make-journey ingests a Word document, converts it to Markdown, and lets
// an author edit that Markdown. This renders a faithful, GOV.UK-styled preview
// of the result. The same module runs server-side (the no-JavaScript "Update
// preview" fallback and the review page) and is bundled into the client for the
// live preview, so the two renderings can never drift apart.
//
// It is deliberately minimal: headings, paragraphs, bold, italic, inline code,
// links, bullet and numbered lists, and horizontal rules. That is enough for
// guidance prose. The whole input is HTML-escaped first, so author text cannot
// inject markup, then a small set of Markdown patterns are applied.

// Markdown heading levels map down one level: a guidance document's own title
// renders as h2, so it sits below the page h1 ("Preview", "Edit the guidance")
// and the page keeps a single, valid heading outline.
const HEADINGS = {
  1: { tag: 'h2', className: 'govuk-heading-l' },
  2: { tag: 'h3', className: 'govuk-heading-m' },
  3: { tag: 'h4', className: 'govuk-heading-s' },
  4: { tag: 'h5', className: 'govuk-heading-s' },
  5: { tag: 'h6', className: 'govuk-heading-s' },
  6: { tag: 'h6', className: 'govuk-heading-s' }
}

const LIST_ITEM = /^\s*([-*+]|\d+\.)\s+(.*)$/
const HEADING = /^(#{1,6})\s+(.*)$/
const RULE = /^(-{3,}|\*{3,}|_{3,})$/

// A sentinel that cannot occur in typed guidance text (the null character),
// used to hold an extracted inline-code span's place while emphasis and links
// are applied around it.
const CODE_SENTINEL = String.fromCharCode(0)

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Only allow safe link targets: http(s), mailto, and site-relative or in-page
// anchors. Anything else (for example javascript:) falls back to a dead link.
function safeHref(url) {
  const trimmed = url.trim()
  const allowed =
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  return allowed ? trimmed : '#'
}

// Inline formatting, applied to already-escaped text. Inline code spans are
// pulled out first and restored last, so their contents are never treated as
// bold, italic or links. Emphasis markers must hug their text (no space just
// inside the markers), so stray asterisks in prose such as "5 * 3" are left
// alone.
function applyInline(text) {
  const codeSpans = []
  let html = text.replace(/`([^`]+)`/g, (match, code) => {
    codeSpans.push(`<code class="app-code">${code}</code>`)
    return `${CODE_SENTINEL}${codeSpans.length - 1}${CODE_SENTINEL}`
  })

  html = html
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (match, label, url) =>
        `<a class="govuk-link" href="${safeHref(url)}">${label}</a>`
    )
    .replace(/\*\*([^\s*][^*]*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^\s_][^_]*?)__/g, '<strong>$1</strong>')
    .replace(/\*([^\s*][^*]*?)\*/g, '<em>$1</em>')

  return html.replace(
    new RegExp(`${CODE_SENTINEL}(\\d+)${CODE_SENTINEL}`, 'g'),
    (match, index) => codeSpans[Number(index)]
  )
}

function renderList(lines, start) {
  const ordered = /\d+\./.test(LIST_ITEM.exec(lines[start])[1])
  const items = []
  let i = start

  while (i < lines.length) {
    const match = LIST_ITEM.exec(lines[i])
    if (!match || /\d+\./.test(match[1]) !== ordered) {
      break
    }
    items.push(`<li>${applyInline(match[2].trim())}</li>`)
    i++
  }

  const tag = ordered ? 'ol' : 'ul'
  const className = ordered
    ? 'govuk-list govuk-list--number'
    : 'govuk-list govuk-list--bullet'
  return {
    html: `<${tag} class="${className}">${items.join('')}</${tag}>`,
    next: i
  }
}

function renderParagraph(lines, start) {
  const collected = []
  let i = start

  while (i < lines.length) {
    const line = lines[i]
    const isBlock =
      line.trim() === '' ||
      HEADING.test(line) ||
      LIST_ITEM.test(line) ||
      RULE.test(line.trim())
    if (isBlock) {
      break
    }
    collected.push(line.trim())
    i++
  }

  return {
    html: `<p class="govuk-body">${applyInline(collected.join(' '))}</p>`,
    next: i
  }
}

/**
 * Render a Markdown string to a GOV.UK-styled HTML fragment.
 *
 * @param {string} src
 * @returns {string}
 */
function renderMarkdown(src) {
  if (typeof src !== 'string' || src.trim() === '') {
    return ''
  }

  const lines = escapeHtml(src.replace(/\r\n/g, '\n')).split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
    } else if (RULE.test(line.trim())) {
      blocks.push(
        '<hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">'
      )
      i++
    } else if (HEADING.test(line)) {
      const [, hashes, text] = HEADING.exec(line)
      const { tag, className } = HEADINGS[hashes.length]
      blocks.push(
        `<${tag} class="${className}">${applyInline(text.trim())}</${tag}>`
      )
      i++
    } else if (LIST_ITEM.test(line)) {
      const { html, next } = renderList(lines, i)
      blocks.push(html)
      i = next
    } else {
      const { html, next } = renderParagraph(lines, i)
      blocks.push(html)
      i = next
    }
  }

  return blocks.join('\n')
}

export { renderMarkdown }
