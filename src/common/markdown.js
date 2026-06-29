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

const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s+(.*)$/
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
      /!\[([^\]]*)\]\(([^)\s]+)\)/g,
      (match, alt, file) =>
        `<span class="app-image-placeholder" data-file="${file}" data-alt="${alt}">Image${alt ? ': ' + alt : ''}</span>`
    )
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

function listItemInfo(line) {
  const match = LIST_ITEM.exec(line)
  if (!match) {
    return null
  }
  return {
    indent: match[1].replace(/\t/g, '  ').length,
    ordered: /\d+\./.test(match[2]),
    text: match[3].trim()
  }
}

// Render a list, nesting any deeper-indented items inside the item above them.
// Processing guidance routes on nested Yes/No branches (a Yes/No under a Yes/No),
// so the nesting has to survive or the reader cannot tell which answer is which.
function renderList(lines, start) {
  return renderListLevel(lines, start, listItemInfo(lines[start]).indent)
}

function renderListLevel(lines, start, indent) {
  const ordered = listItemInfo(lines[start]).ordered
  const items = []
  let i = start

  while (i < lines.length) {
    const info = listItemInfo(lines[i])
    if (!info || info.indent < indent) {
      break
    }
    if (info.indent > indent) {
      const nested = renderListLevel(lines, i, info.indent)
      if (items.length > 0) {
        items[items.length - 1] += nested.html
      }
      i = nested.next
      continue
    }
    items.push(`<li>${applyInline(info.text)}`)
    i++
  }

  const tag = ordered ? 'ol' : 'ul'
  const className = ordered
    ? 'govuk-list govuk-list--number'
    : 'govuk-list govuk-list--bullet'
  const html = `<${tag} class="${className}">${items.map((item) => `${item}</li>`).join('')}</${tag}>`
  return { html, next: i }
}

const TABLE_LINE = /^\s*\|.*\|\s*$/

function splitTableRow(line) {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|')) text = text.slice(0, -1)
  return text.split('|').map((cell) => cell.trim())
}

function isSeparatorRow(line) {
  if (!TABLE_LINE.test(line)) {
    return false
  }
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function isTableStart(lines, i) {
  return TABLE_LINE.test(lines[i] || '') && isSeparatorRow(lines[i + 1] || '')
}

// A GitHub-style pipe table. Word tables convert to these, and processing
// guidance leans on them, so a rectangular grid is rendered. Rows are padded to
// the widest, so a source table with merged cells still renders cleanly.
function renderTable(lines, start) {
  const rows = [splitTableRow(lines[start])]
  let i = start + 2

  while (
    i < lines.length &&
    TABLE_LINE.test(lines[i]) &&
    !isSeparatorRow(lines[i])
  ) {
    rows.push(splitTableRow(lines[i]))
    i++
  }

  // The header row defines the column count, so a body row with stray extra
  // cells cannot inject empty, unlabelled header cells.
  const columns = rows[0].length
  const fit = (row) =>
    row
      .slice(0, columns)
      .concat(Array(Math.max(0, columns - row.length)).fill(''))
  const header = fit(rows[0])
  const body = rows.slice(1).map(fit)

  const head = header
    .map(
      (cell) =>
        `<th scope="col" class="govuk-table__header">${applyInline(cell)}</th>`
    )
    .join('')
  const rowsHtml = body
    .map(
      (row) =>
        `<tr class="govuk-table__row">${row
          .map(
            (cell) => `<td class="govuk-table__cell">${applyInline(cell)}</td>`
          )
          .join('')}</tr>`
    )
    .join('')

  return {
    html: `<table class="govuk-table"><thead class="govuk-table__head"><tr class="govuk-table__row">${head}</tr></thead><tbody class="govuk-table__body">${rowsHtml}</tbody></table>`,
    next: i
  }
}

// A blockquote block, used for the boxed case-note and hold templates that
// processing guidance tells officers to copy. Rendered as a GOV.UK inset so it
// reads as a distinct, copyable block. The markers arrive HTML-escaped
// (">" becomes "&gt;"), because the whole input is escaped before parsing.
function renderBlockquote(lines, start) {
  const items = []
  let i = start
  while (i < lines.length && lines[i].startsWith('&gt;')) {
    items.push(applyInline(lines[i].replace(/^&gt;\s?/, '').trim()))
    i++
  }
  return {
    html: `<div class="govuk-inset-text">${items.join('<br>')}</div>`,
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
      RULE.test(line.trim()) ||
      isTableStart(lines, i) ||
      line.startsWith('&gt;')
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
    } else if (isTableStart(lines, i)) {
      const { html, next } = renderTable(lines, i)
      blocks.push(html)
      i = next
    } else if (line.startsWith('&gt;')) {
      const { html, next } = renderBlockquote(lines, i)
      blocks.push(html)
      i = next
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

// Swap uploaded screenshots into rendered HTML. Each placeholder carries its
// source filename; where an image has been uploaded for that filename the
// placeholder becomes a real image. Run after renderMarkdown, server-side.
function applyImages(html, images) {
  if (!images) {
    return html
  }
  return html.replace(
    /<span class="app-image-placeholder" data-file="([^"]+)" data-alt="([^"]*)">[^<]*<\/span>/g,
    (match, file, alt) => {
      const src = images[file]
      return src
        ? `<img class="app-screenshot" src="${src}" alt="${alt}">`
        : match
    }
  )
}

// Slugify a heading into a stable anchor id. Used by both the editor preview and
// the contents side-nav so links resolve to the same headings on every render.
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Add id attributes to the section-level headings (h2, h3, h4) of rendered HTML,
// so the contents side-nav can scroll the preview to a section. This matches the
// outline depth: document heading levels 1 to 3. Collision-safe: a repeated
// heading gets -2, -3 and so on, in document order.
function addHeadingIds(html) {
  const seen = new Map()
  return html.replace(
    /<(h2|h3|h4)([^>]*)>([\s\S]*?)<\/\1>/g,
    (match, tag, attrs, inner) => {
      let slug = slugify(inner) || 'section'
      const count = seen.get(slug) ?? 0
      seen.set(slug, count + 1)
      if (count > 0) {
        slug = slug + '-' + (count + 1)
      }
      return `<${tag}${attrs} id="${slug}">${inner}</${tag}>`
    }
  )
}

export { renderMarkdown, applyImages, slugify, addHeadingIds }
