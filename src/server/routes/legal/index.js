import { cookiesController, accessibilityController } from './controller.js'

/**
 * Sets up the legal routes: cookies and accessibility statement.
 * These routes are registered in src/server/router.js.
 */
export const legal = {
  plugin: {
    name: 'legal',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/cookies',
          ...cookiesController
        },
        {
          method: 'GET',
          path: '/accessibility-statement',
          ...accessibilityController
        }
      ])
    }
  }
}
