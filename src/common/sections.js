// Split guidance markdown into editable sections, and join them back.
//
// Real guidance documents are too long to edit in one pane, and a well
// structured, sectioned guide is far easier for the find-and-use assistant to
// search and cite later. So the draft is broken into sections taken from the
// document's headings.
//
// Documents can be several heading levels deep: a real RPA processing guide
// runs to four. We split into editable sections down to level 3 (the document
// title, its top sections, and their sub-sections). Deeper headings (level 4
// and below) stay as markdown inside a section body, and are surfaced in the
// outline so the author can still see the full structure.

const HEADING = /^(#{1,6})\s+(.*)$/
const SUBHEADING = /^(#{4,6})\s+(.*)$/

// Headings at this depth or shallower start their own editable section.
const SPLIT_DEPTH = 3

/**
 * @param {string} markdown
 * @returns {{ heading: string, level: number, body: string }[]}
 */
function splitIntoSections(markdown) {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const sections = []
  let current = null

  for (const line of lines) {
    const heading = HEADING.exec(line)
    if (heading && heading[1].length <= SPLIT_DEPTH) {
      current = {
        heading: heading[2].trim(),
        level: heading[1].length,
        body: []
      }
      sections.push(current)
    } else if (current) {
      current.body.push(line)
    } else {
      // Text before any heading: start an untitled title section to hold it.
      current = { heading: '', level: 1, body: [line] }
      sections.push(current)
    }
  }

  const cleaned = sections.map((s) => ({
    heading: s.heading,
    level: s.level,
    body: s.body.join('\n').trim()
  }))

  // Fallback for an empty document: one empty section to edit.
  return cleaned.length > 0
    ? cleaned
    : [{ heading: 'Document', level: 1, body: '' }]
}

/**
 * @param {{ heading: string, level: number, body: string }[]} sections
 * @returns {string}
 */
function joinSections(sections) {
  return sections
    .map((s) => {
      const depth = Math.min(Math.max(s.level || 2, 1), 6)
      const heading = s.heading ? `${'#'.repeat(depth)} ${s.heading}` : ''
      return [heading, s.body].filter(Boolean).join('\n\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

/**
 * The deeper headings (level 4 and below) that live inside a section body,
 * returned so the outline can show the full document structure even though
 * these are edited as markdown within their parent section.
 *
 * @param {string} body
 * @returns {{ text: string, level: number }[]}
 */
function subHeadingsOf(body) {
  const subs = []
  for (const line of (body ?? '').split('\n')) {
    const match = SUBHEADING.exec(line)
    if (match) {
      subs.push({ text: match[2].trim(), level: match[1].length })
    }
  }
  return subs
}

export { splitIntoSections, joinSections, subHeadingsOf }
