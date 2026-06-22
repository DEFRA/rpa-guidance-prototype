import {
  startController,
  aboutYouController,
  aboutYouSubmitController,
  goalsController,
  goalsSubmitController,
  resultsController,
  optionController,
  contactController
} from './controller.js'

/**
 * Sets up the routes used in the find funding journey.
 * These routes are registered in src/server/plugins/router.js.
 */
export const findFunding = {
  plugin: {
    name: 'find-funding',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/find-funding/start',
          ...startController
        },
        {
          method: 'GET',
          path: '/find-funding/about-you',
          ...aboutYouController
        },
        {
          method: 'POST',
          path: '/find-funding/about-you',
          ...aboutYouSubmitController
        },
        {
          method: 'GET',
          path: '/find-funding/goals',
          ...goalsController
        },
        {
          method: 'POST',
          path: '/find-funding/goals',
          ...goalsSubmitController
        },
        {
          method: 'GET',
          path: '/find-funding/results',
          ...resultsController
        },
        {
          method: 'GET',
          path: '/find-funding/option/{id}',
          ...optionController
        },
        {
          method: 'GET',
          path: '/find-funding/contact',
          ...contactController
        }
      ])
    }
  }
}
