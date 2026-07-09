// The sample Markdown the make-journey starts the editor with. In the real
// service a Word document is ingested and converted to Markdown. Here that
// conversion is stubbed: the editor is seeded with this sample, a real RPA
// processing guide (SFI: Parcel ID not linked to SBI in SITI Tenure), so the
// make journey can be explored against realistic content: deep heading
// nesting, screenshots, tables, note-box templates and nested decision branches.
//
// The content now lives in a single source of truth: the guidance content file
// content/sfi23-parcel-tenure.md, which the viewer-prototyping harness also
// serves. We read it here and strip its frontmatter so the make-journey keeps
// the plain Markdown body it has always used.

import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { parseFrontmatter } from '#/common/frontmatter.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(
  path.join(dirname, 'content', 'sfi23-parcel-tenure.md'),
  'utf-8'
)

const sampleGuidanceMarkdown = parseFrontmatter(source).content

export { sampleGuidanceMarkdown }
