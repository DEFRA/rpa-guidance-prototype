// A tiny, dependency-free frontmatter parser, in the same spirit as the
// hand-rolled Markdown renderer in markdown.js.
//
// Guidance content files start with an optional YAML-ish block fenced by "---"
// lines. It holds prototype metadata the viewer harness reads (title, type,
// summary, which viewer to open by default, how to split into steps), plus any
// free-form keys a designer wants a template to pick up. This is deliberately
// not a full YAML engine: simple `key: value` lines, and `- item` lines that
// build a list. That is all guidance metadata needs.

// Coerce the obvious scalars so templates get real booleans/numbers, not the
// strings "true" or "3". Everything else stays a trimmed string.
function coerce(value) {
  const trimmed = value.trim().replace(/^["']|["']$/g, '')
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed !== '' && !isNaN(Number(trimmed))) return Number(trimmed)
  return trimmed
}

/**
 * Split a source string into its frontmatter data and the remaining content.
 *
 * @param {string} src
 * @returns {{ data: Record<string, unknown>, content: string }}
 */
function parseFrontmatter(src) {
  const text = (src ?? '').replace(/\r\n/g, '\n')
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) {
    return { data: {}, content: text }
  }

  const data = {}
  let lastKey = null

  for (const line of match[1].split('\n')) {
    if (line.trim() === '') {
      continue
    }
    // A "- item" line appends to the list started by the key above it.
    const listItem = line.match(/^\s*-\s+(.*)$/)
    if (listItem && lastKey) {
      if (!Array.isArray(data[lastKey])) {
        data[lastKey] = []
      }
      data[lastKey].push(coerce(listItem[1]))
      continue
    }
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (pair) {
      lastKey = pair[1]
      // A key with no inline value opens a list to be filled by "- " lines.
      data[lastKey] = pair[2].trim() === '' ? [] : coerce(pair[2])
    }
  }

  return { data, content: text.slice(match[0].length) }
}

export { parseFrontmatter }
