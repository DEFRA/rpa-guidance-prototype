import { config } from '#/config/config.js'

const assetPath = config.get('assetPath')

// Paths that must never sit behind the gate: the platform health probe (CDP
// polls it), static assets, the favicon, and the password page itself.
function isOpenPath(path) {
  return (
    path === '/health' ||
    path === '/favicon.ico' ||
    path === '/password' ||
    path.startsWith(`${assetPath}/`)
  )
}

// A prototype-wide password gate: the Hapi equivalent of the GOV.UK Prototype
// Kit's built-in protection. The password comes from the PASSWORD secret (see
// config), never hardcoded. Turn the whole gate off locally with USE_AUTH=false.
export const prototypeAuth = {
  plugin: {
    name: 'prototype-auth',
    register(server) {
      server.ext('onPostAuth', (request, h) => {
        // The gate is only active when a password has actually been set (as a
        // CDP secret). With no PASSWORD configured there is nothing to check
        // against, so the prototype is open, which is what we want for tests
        // and local development.
        if (
          !config.get('auth.enabled') ||
          !config.get('auth.password') ||
          isOpenPath(request.path)
        ) {
          return h.continue
        }

        if (request.yar.get('isAuthenticated')) {
          return h.continue
        }

        const returnTo = encodeURIComponent(
          request.path + (request.url.search || '')
        )
        return h.redirect(`/password?returnTo=${returnTo}`).takeover()
      })
    }
  }
}
