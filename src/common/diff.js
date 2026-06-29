// A small line-level diff for showing what changed between the published
// version of a guide and the author's edited version. GOV.UK's Whitehall does
// the same in "compare with previous version": removed text in red, added in
// green. It is line-based (fast, and matches how the editor works in sections),
// and it collapses long runs of unchanged lines so only the changes show.

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Line-level longest-common-subsequence diff.
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {{ type: 'same' | 'removed' | 'added', text: string }[]}
 */
function diffLines(oldText, newText) {
  const a = (oldText ?? '').replace(/\r\n/g, '\n').split('\n')
  const b = (newText ?? '').replace(/\r\n/g, '\n').split('\n')
  const m = a.length
  const n = b.length

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'removed', text: a[i] })
      i++
    } else {
      rows.push({ type: 'added', text: b[j] })
      j++
    }
  }
  while (i < m) {
    rows.push({ type: 'removed', text: a[i++] })
  }
  while (j < n) {
    rows.push({ type: 'added', text: b[j++] })
  }
  return rows
}

/**
 * Render the diff as HTML: removed lines red, added lines green, runs of
 * unchanged lines collapsed to a count.
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {{ html: string, changed: boolean }}
 */
function renderDiffHtml(oldText, newText) {
  const rows = diffLines(oldText, newText)
  const out = []
  let sameRun = 0

  const flushSame = () => {
    if (sameRun > 0) {
      out.push(
        `<p class="app-diff__gap">${sameRun} unchanged line${sameRun === 1 ? '' : 's'}</p>`
      )
      sameRun = 0
    }
  }

  for (const row of rows) {
    if (row.type === 'same') {
      sameRun++
      continue
    }
    flushSame()
    const text = escapeHtml(row.text).trim() || '&nbsp;'
    const modifier =
      row.type === 'removed'
        ? 'app-diff__line--removed'
        : 'app-diff__line--added'
    const label = row.type === 'removed' ? 'Removed' : 'Added'
    out.push(
      `<p class="app-diff__line ${modifier}"><span class="govuk-visually-hidden">${label}: </span>${text}</p>`
    )
  }
  flushSame()

  return {
    html: out.join(''),
    changed: rows.some((row) => row.type !== 'same')
  }
}

export { diffLines, renderDiffHtml }
