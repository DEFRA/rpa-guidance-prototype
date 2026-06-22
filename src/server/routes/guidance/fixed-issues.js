// Tracks which issues the user has marked as fixed, in their session, so the
// checklist remembers progress as they work through edits to their document.
// State is namespaced by check id so different documents do not collide.

const YAR_KEY = 'publishingChecksFixed'

/**
 * The set of issue indexes the user has marked as fixed for a given check.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} checkId
 * @returns {Set<number>}
 */
function getFixedIssues(request, checkId) {
  const all = request.yar?.get(YAR_KEY) ?? {}
  return new Set(all[checkId] ?? [])
}

/**
 * Marks an issue as fixed or not fixed for a given check.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} checkId
 * @param {number} index
 * @param {boolean} fixed
 * @returns {Set<number>}
 */
function setFixedIssue(request, checkId, index, fixed) {
  const all = request.yar?.get(YAR_KEY) ?? {}
  const current = new Set(all[checkId] ?? [])

  if (fixed) {
    current.add(index)
  } else {
    current.delete(index)
  }

  all[checkId] = [...current]
  request.yar?.set(YAR_KEY, all)

  return current
}

/**
 * Clears all fixed-issue progress for a given check, so a fresh run of the
 * journey starts with nothing marked as done.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} checkId
 */
function clearFixedIssues(request, checkId) {
  const all = request.yar?.get(YAR_KEY) ?? {}
  delete all[checkId]
  request.yar?.set(YAR_KEY, all)
}

export { getFixedIssues, setFixedIssue, clearFixedIssues }
