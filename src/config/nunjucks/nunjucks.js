import path from 'path'
import nunjucks from 'nunjucks'
import hapiVision from '@hapi/vision'
import { fileURLToPath } from 'node:url'

import { config } from '../config.js'
import { context } from './context/context.js'
import * as filters from './filters/filters.js'
import * as globals from './globals/globals.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const nunjucksEnvironment = nunjucks.configure(
  [
    'node_modules/govuk-frontend/dist/',
    path.resolve(dirname, '../../server/common/templates'),
    path.resolve(dirname, '../../server/common/components'),
    // Lets templates under server/routes extend/include each other by path, e.g.
    // the guidance viewer templates extending guidance/viewers/_viewer-layout.njk
    path.resolve(dirname, '../../server/routes')
  ],
  {
    autoescape: true,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true,
    watch: config.get('nunjucks.watch'),
    noCache: config.get('nunjucks.noCache')
  }
)

export const nunjucksConfig = {
  plugin: hapiVision,
  options: {
    engines: {
      njk: {
        compile(src, options) {
          const template = nunjucks.compile(src, options.environment)
          return (ctx) => template.render(ctx)
        }
      },
      // Plain-HTML viewer templates (the guidance-prototyping harness) are
      // compiled through the same Nunjucks environment, so a designer can write
      // a .html file with {{ tokens }} and no Nunjucks knowledge.
      html: {
        compile(src, options) {
          const template = nunjucks.compile(src, options.environment)
          return (ctx) => template.render(ctx)
        }
      }
    },
    compileOptions: {
      environment: nunjucksEnvironment
    },
    // With more than one engine registered, Vision needs to know which extension
    // to assume for view names given without one (every existing h.view call).
    // Plain-HTML viewers are requested with their explicit .html filename.
    defaultExtension: 'njk',
    relativeTo: path.resolve(dirname, '../..'),
    path: 'server/routes',
    isCached: config.get('isProduction'),
    context
  }
}

Object.entries(globals).forEach(([name, global]) => {
  nunjucksEnvironment.addGlobal(name, global)
})

Object.entries(filters).forEach(([name, filter]) => {
  nunjucksEnvironment.addFilter(name, filter)
})
