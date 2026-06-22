import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Header,
  Radios,
  SkipLink
} from 'govuk-frontend'

import { renderMarkdown } from '../../common/markdown.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Header)
createAll(Radios)
createAll(SkipLink)

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

// Live markdown preview on the edit screen. The server renders the same preview
// for people without JavaScript, who use the "Update preview" button; with
// JavaScript we hide that button and refresh the preview as the author types.
const PREVIEW_DEBOUNCE_MS = 200
const editor = document.querySelector('[data-module="app-markdown-editor"]')

if (editor) {
  const input = editor.querySelector('[name="markdown"]')
  const preview = editor.querySelector('[data-module="app-markdown-preview"]')
  // The GOV.UK button macro owns the data-module attribute, so target the
  // no-JS preview button by its submit value instead.
  const previewSubmit = editor.querySelector('button[value="preview"]')

  if (input && preview) {
    if (previewSubmit) {
      previewSubmit.setAttribute('hidden', '')
    }

    let timer
    input.addEventListener('input', () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        preview.innerHTML = renderMarkdown(input.value)
      }, PREVIEW_DEBOUNCE_MS)
    })
  }
}
