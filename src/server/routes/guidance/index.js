import {
  getStartController,
  getTaskListController,
  getNeedController,
  postNeedController,
  getUploadController,
  postUploadController,
  getConvertedController,
  getEditController,
  postEditController,
  getReviewController,
  postReviewController,
  getTestController,
  postTestController,
  getCheckController,
  getCheckIssueController,
  postCheckIssueController,
  getPublishConfirmController,
  postPublishController,
  postCheckFixAllController,
  getPublishedController
} from './controller.js'

// Word documents are small, but leave generous headroom so a real .docx never
// trips the limit. The handler validates the file; this is just a backstop.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/**
 * Sets up the routes for the make and publish guidance journey.
 * These routes are registered in src/server/plugins/router.js.
 */
export const guidance = {
  plugin: {
    name: 'guidance',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/guidance/start',
          ...getStartController
        },
        {
          method: 'GET',
          path: '/guidance/task-list',
          ...getTaskListController
        },
        {
          method: 'GET',
          path: '/guidance/need',
          ...getNeedController
        },
        {
          method: 'POST',
          path: '/guidance/need',
          ...postNeedController
        },
        {
          method: 'GET',
          path: '/guidance/upload',
          ...getUploadController
        },
        {
          method: 'POST',
          path: '/guidance/upload',
          options: {
            payload: {
              multipart: { output: 'stream' },
              parse: true,
              allow: 'multipart/form-data',
              maxBytes: MAX_UPLOAD_BYTES
            }
          },
          ...postUploadController
        },
        {
          method: 'GET',
          path: '/guidance/converted',
          ...getConvertedController
        },
        {
          method: 'GET',
          path: '/guidance/edit',
          ...getEditController
        },
        {
          method: 'POST',
          path: '/guidance/edit',
          ...postEditController
        },
        {
          method: 'GET',
          path: '/guidance/review',
          ...getReviewController
        },
        {
          method: 'POST',
          path: '/guidance/review',
          ...postReviewController
        },
        {
          method: 'GET',
          path: '/guidance/test',
          ...getTestController
        },
        {
          method: 'POST',
          path: '/guidance/test',
          ...postTestController
        },
        {
          method: 'GET',
          path: '/guidance/check',
          ...getCheckController
        },
        {
          method: 'GET',
          path: '/guidance/check/issues/{index}',
          ...getCheckIssueController
        },
        {
          method: 'POST',
          path: '/guidance/check/issues/{index}',
          ...postCheckIssueController
        },
        {
          method: 'GET',
          path: '/guidance/check/publish',
          ...getPublishConfirmController
        },
        {
          method: 'POST',
          path: '/guidance/check/publish',
          ...postPublishController
        },
        {
          method: 'POST',
          path: '/guidance/check/fix-all',
          ...postCheckFixAllController
        },
        {
          method: 'GET',
          path: '/guidance/published',
          ...getPublishedController
        }
      ])
    }
  }
}
