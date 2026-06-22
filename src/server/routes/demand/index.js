import {
  getSignInController,
  postSignInController,
  getAskController,
  getAnswerController,
  postAnswerController,
  getLogController,
  postLogController,
  getDoneController
} from './controller.js'

/**
 * The find-and-use guidance journey: sign in, ask the assistant a question,
 * read the answer, then log the call.
 * These routes are registered in src/server/router.js.
 */
export const demand = {
  plugin: {
    name: 'demand',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/demand/sign-in',
          ...getSignInController
        },
        {
          method: 'POST',
          path: '/demand/sign-in',
          ...postSignInController
        },
        {
          method: 'GET',
          path: '/demand/ask',
          ...getAskController
        },
        {
          method: 'GET',
          path: '/demand/answer',
          ...getAnswerController
        },
        {
          method: 'POST',
          path: '/demand/answer',
          ...postAnswerController
        },
        {
          method: 'GET',
          path: '/demand/log',
          ...getLogController
        },
        {
          method: 'POST',
          path: '/demand/log',
          ...postLogController
        },
        {
          method: 'GET',
          path: '/demand/done',
          ...getDoneController
        }
      ])
    }
  }
}
