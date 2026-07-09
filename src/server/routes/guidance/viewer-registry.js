// Discovers — and, for the in-UI editor, reads/writes — the viewer templates a
// designer keeps in ./viewers.
//
// A viewer is a single .njk or .html file. Both are compiled through Nunjucks
// (see src/config/nunjucks/nunjucks.js), so a file can be plain HTML with
// {{ tokens }} or full Nunjucks — the designer's choice. Files starting with an
// underscore (layouts, partials) and the README are skipped.
//
// The render route only ever loads a template whose id is in this list, and
// every path derived from user input is resolved and checked to stay inside
// ./viewers, so a URL or form value can never reach an arbitrary file.

import path from 'node:path'
import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { config } from '#/config/config.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger()
const viewersDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'viewers'
)

const ALLOWED_EXTS = ['njk', 'html']
// Names that would collide with the shared layout/partials once slugified
// (toId strips the leading underscore), so block them for created templates.
const RESERVED = ['viewer-layout', 'switcher']

// Prettify a file id for the picker: "task-stepper" -> "Task stepper".
function labelFromId(id) {
  const spaced = id.replace(/[-_]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// Turn free text a designer typed into a safe file id: lowercase, hyphenated,
// no leading underscore, no path characters.
function toId(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[-_]+|-+$/g, '')
}

// Resolve an id+ext to an absolute path and confirm it stays inside ./viewers.
function safePath(id, ext) {
  const file = `${id}.${ext}`
  const resolved = path.resolve(viewersDir, file)
  if (path.dirname(resolved) !== viewersDir) {
    throw new Error('Template path escapes the viewers folder')
  }
  return resolved
}

function scan() {
  let files = []
  try {
    files = readdirSync(viewersDir)
  } catch (error) {
    logger.error(`Viewers folder not readable: ${error.message}`)
    return []
  }
  return files
    .filter((f) => /\.(njk|html)$/.test(f) && !f.startsWith('_'))
    .map((file) => {
      const ext = path.extname(file).slice(1)
      const id = path.basename(file, path.extname(file))
      return { id, ext, file, label: labelFromId(id) }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

let cache

function allViewers() {
  if (config.get('isProduction')) {
    cache = cache ?? scan()
    return cache
  }
  return scan()
}

function listViewers() {
  return allViewers()
}

function getViewer(id) {
  return allViewers().find((viewer) => viewer.id === id) ?? null
}

function hasViewer(id) {
  return Boolean(getViewer(id))
}

// Read a viewer's source so the editor can load it.
function readViewerSource(id) {
  const viewer = getViewer(id)
  if (!viewer) {
    return null
  }
  return { ...viewer, source: readFileSync(safePath(id, viewer.ext), 'utf-8') }
}

/**
 * Create or overwrite a viewer template file from the in-UI editor.
 *
 * @param {{ name?: string, id?: string, ext: string, body: string }} input
 * @returns {{ id: string, ext: string }}
 * @throws {Error} with a human-readable message when the input is rejected
 */
function saveViewer({ name, id, ext, body }) {
  const finalId = toId(id || name)
  if (!finalId) {
    throw new Error('Enter a name for the template')
  }
  if (RESERVED.includes(finalId)) {
    throw new Error('That name is reserved, choose another')
  }
  if (!ALLOWED_EXTS.includes(ext)) {
    throw new Error('Choose a template type of Nunjucks (.njk) or HTML (.html)')
  }
  if (!body || body.trim() === '') {
    throw new Error('The template cannot be empty')
  }
  writeFileSync(safePath(finalId, ext), body, 'utf-8')
  // Invalidate the production cache so the new file is discoverable.
  cache = undefined
  return { id: finalId, ext }
}

function deleteViewer(id) {
  const viewer = getViewer(id)
  if (!viewer) {
    return false
  }
  rmSync(safePath(id, viewer.ext))
  cache = undefined
  return true
}

export {
  listViewers,
  getViewer,
  hasViewer,
  readViewerSource,
  saveViewer,
  deleteViewer,
  toId
}
