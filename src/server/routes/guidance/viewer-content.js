// Loads the guidance content files a designer drops into ./content.
//
// Each file is Markdown with an optional frontmatter block (see
// src/common/frontmatter.js). Designers add or edit a .md file and it appears in
// the viewer picker on the next request — no route, controller or restart. In
// development the folder is re-scanned on every call so edits are live; in
// production it is scanned once and cached.

import path from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { config } from '#/config/config.js'
import { parseFrontmatter } from '#/common/frontmatter.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()
const contentDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'content'
)

// Turn a filename into a fallback id/title when frontmatter omits them.
function slugFromFile(file) {
  return path.basename(file, '.md')
}

function titleFromMarkdown(markdown, fallback) {
  const heading = markdown.match(/^\s*#\s+(.+)/)
  return heading ? heading[1].trim() : fallback
}

function loadDoc(file) {
  const source = readFileSync(path.join(contentDir, file), 'utf-8')
  const { data, content } = parseFrontmatter(source)
  const id = data.id || slugFromFile(file)
  return {
    id,
    title: data.title || titleFromMarkdown(content, id),
    type: data.type || 'guidance',
    summary: data.summary || '',
    defaultViewer: data.defaultViewer || 'single-page',
    // All frontmatter, so a template can read arbitrary per-doc config.
    data,
    markdown: content
  }
}

function scan() {
  let files = []
  try {
    files = readdirSync(contentDir).filter((f) => f.endsWith('.md'))
  } catch (error) {
    logger.error(`Guidance content folder not readable: ${error.message}`)
    return []
  }
  return files
    .map((file) => {
      try {
        return loadDoc(file)
      } catch (error) {
        logger.error(`Could not load guidance file ${file}: ${error.message}`)
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title))
}

let cache

function allDocs() {
  if (config.get('isProduction')) {
    cache = cache ?? scan()
    return cache
  }
  return scan()
}

function listDocs() {
  return allDocs()
}

function getDoc(id) {
  return allDocs().find((doc) => doc.id === id) ?? null
}

export { listDocs, getDoc }
