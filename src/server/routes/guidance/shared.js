// Shared helpers for the publishing checks overview and issue pages.

// Most serious first. Drives the order issues are listed in.
const SEVERITY_DISPLAY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

// Severities that block publishing, so they are grouped and counted apart
// from the optional improvements.
const MUST_FIX_SEVERITIES = new Set(['critical', 'high'])

/**
 * Rank a severity for sorting. Unknown severities sort last.
 *
 * @param {string} severity
 * @returns {number}
 */
function severityRank(severity) {
  const rank = SEVERITY_DISPLAY_ORDER.indexOf(severity)
  return rank === -1 ? SEVERITY_DISPLAY_ORDER.length : rank
}

/**
 * Whether a severity must be fixed before the document can be published.
 *
 * @param {string} severity
 * @returns {boolean}
 */
function isMustFix(severity) {
  return MUST_FIX_SEVERITIES.has(severity)
}

/**
 * Turns a raw section reference into a label that helps the user find the
 * place in their document. Replaces the em dash the source data sometimes
 * uses, and prefixes "Section" when the reference starts with a number.
 * "2.1 — Application overview" becomes "Section 2.1, Application overview".
 *
 * @param {string} section
 * @returns {string}
 */
function formatSection(section) {
  if (typeof section !== 'string' || section.trim() === '') {
    return ''
  }
  const cleaned = section.replace(/\s*—\s*/g, ', ').trim()
  return /^\d/.test(cleaned) ? `Section ${cleaned}` : cleaned
}

export { SEVERITY_DISPLAY_ORDER, severityRank, isMustFix, formatSection }
