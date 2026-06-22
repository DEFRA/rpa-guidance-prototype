import { passwordController, passwordSubmitController } from './controller.js'

/**
 * The prototype password gate page. Reachable without authentication (the gate
 * in src/server/plugins/prototype-auth.js exempts it).
 */
export const password = {
  plugin: {
    name: 'password',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/password',
          ...passwordController
        },
        {
          method: 'POST',
          path: '/password',
          ...passwordSubmitController
        }
      ])
    }
  }
}
