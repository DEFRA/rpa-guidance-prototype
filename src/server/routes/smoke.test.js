import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

// Boots the real server (all journeys registered) and injects routes, so we
// confirm each journey renders rather than only that the app assembles.
describe('route smoke tests', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  // Entry routes: must render their page.
  const entryPages = [
    { url: '/', contains: 'Make and publish RPA guidance' },
    { url: '/guidance/library', contains: 'Guides' },
    { url: '/demand/sign-in' },
    { url: '/find-funding/start' },
    { url: '/cookies' },
    { url: '/accessibility-statement' },
    { url: '/password', contains: 'This is a prototype' },
    { url: '/health' }
  ]

  test.each(entryPages)('GET $url responds 200', async ({ url, contains }) => {
    const { statusCode, result } = await server.inject({ method: 'GET', url })

    expect(statusCode).toBe(statusCodes.ok)
    if (contains) {
      expect(result).toEqual(expect.stringContaining(contains))
    }
  })

  // Deep make-journey GET routes: with no session they either render or
  // redirect, but must never crash (a Nunjucks render error surfaces as a 500).
  const deepGuidancePages = [
    '/guidance/start',
    '/guidance/what',
    '/guidance/task-list',
    '/guidance/need',
    '/guidance/need/details',
    '/guidance/need/review',
    '/guidance/upload',
    '/guidance/converted',
    '/guidance/example',
    '/guidance/sections',
    '/guidance/review',
    '/guidance/changes',
    '/guidance/test',
    '/guidance/check',
    '/guidance/check/issues/0',
    '/guidance/check/publish',
    '/guidance/published'
  ]

  test.each(deepGuidancePages)('GET %s does not error', async (url) => {
    const { statusCode } = await server.inject({ method: 'GET', url })

    expect(statusCode).toBeLessThan(statusCodes.internalServerError)
  })
})
