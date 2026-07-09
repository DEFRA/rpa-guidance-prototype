import {
  getStartController,
  getWhatController,
  postWhatController,
  getLibraryController,
  openGuideController,
  getGuideDetailController,
  postRequestAccessController,
  getTaskListController,
  getNeedController,
  postNeedUploadController,
  postNeedDocAddController,
  postNeedDocDeleteController,
  getNeedRestartController,
  getNeedDetailsController,
  postNeedDetailsController,
  getNeedExistingController,
  postNeedExistingController,
  getNeedReviewController,
  postNeedReviewController,
  getUploadController,
  postUploadController,
  postDraftDocAddController,
  postDraftDocDeleteController,
  getConvertedController,
  getConfirmSectionsController,
  postConfirmSectionsController,
  getGuideEditorController,
  getExampleController,
  postGuideEditorController,
  getReviewController,
  postReviewController,
  getChangesController,
  getPublishedGuideController,
  getTestController,
  postTestController,
  getScenarioFormController,
  postScenarioFormController,
  getCheckController,
  getCheckIssueController,
  postCheckIssueController,
  getPublishConfirmController,
  postPublishController,
  postCheckFixAllController,
  getPublishedController,
  getViewerGalleryController,
  getViewerOpenController,
  getTemplatesListController,
  getTemplateNewController,
  postTemplateNewController,
  getTemplateEditController,
  postTemplateEditController,
  postTemplateDeleteController
} from './controller.js'

// Word documents are small, but leave generous headroom so a real .docx never
// trips the limit. The handler validates the file; this is just a backstop.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

// Shared payload config for the routes that accept an uploaded Word document.
const uploadOptions = {
  payload: {
    multipart: { output: 'stream' },
    parse: true,
    allow: 'multipart/form-data',
    maxBytes: MAX_UPLOAD_BYTES
  }
}

/**
 * Sets up the routes for the make, find and use guidance journey.
 * These routes are registered in src/server/plugins/router.js.
 */
export const guidance = {
  plugin: {
    name: 'guidance',
    register(server) {
      server.route([
        { method: 'GET', path: '/guidance/start', ...getStartController },
        { method: 'GET', path: '/guidance/what', ...getWhatController },
        { method: 'POST', path: '/guidance/what', ...postWhatController },
        { method: 'GET', path: '/guidance/library', ...getLibraryController },
        {
          method: 'GET',
          path: '/guidance/viewer',
          ...getViewerGalleryController
        },
        {
          method: 'GET',
          path: '/guidance/viewer/open/{docId}',
          ...getViewerOpenController
        },
        {
          method: 'GET',
          path: '/guidance/viewer/templates',
          ...getTemplatesListController
        },
        {
          method: 'GET',
          path: '/guidance/viewer/templates/new',
          ...getTemplateNewController
        },
        {
          method: 'POST',
          path: '/guidance/viewer/templates/new',
          ...postTemplateNewController
        },
        {
          method: 'GET',
          path: '/guidance/viewer/templates/{id}/edit',
          ...getTemplateEditController
        },
        {
          method: 'POST',
          path: '/guidance/viewer/templates/{id}/edit',
          ...postTemplateEditController
        },
        {
          method: 'POST',
          path: '/guidance/viewer/templates/{id}/delete',
          ...postTemplateDeleteController
        },
        {
          method: 'GET',
          path: '/guidance/library/open/{id}',
          ...openGuideController
        },
        {
          method: 'GET',
          path: '/guidance/library/{id}',
          ...getGuideDetailController
        },
        {
          method: 'POST',
          path: '/guidance/library/{id}/request-access',
          ...postRequestAccessController
        },
        {
          method: 'GET',
          path: '/guidance/task-list',
          ...getTaskListController
        },
        { method: 'GET', path: '/guidance/need', ...getNeedController },
        {
          method: 'POST',
          path: '/guidance/need/upload',
          options: uploadOptions,
          ...postNeedUploadController
        },
        {
          method: 'POST',
          path: '/guidance/need/documents/add',
          options: uploadOptions,
          ...postNeedDocAddController
        },
        {
          method: 'POST',
          path: '/guidance/need/documents/delete',
          ...postNeedDocDeleteController
        },
        {
          method: 'GET',
          path: '/guidance/need/restart',
          ...getNeedRestartController
        },
        {
          method: 'GET',
          path: '/guidance/need/details',
          ...getNeedDetailsController
        },
        {
          method: 'POST',
          path: '/guidance/need/details',
          ...postNeedDetailsController
        },
        {
          method: 'GET',
          path: '/guidance/need/existing',
          ...getNeedExistingController
        },
        {
          method: 'POST',
          path: '/guidance/need/existing',
          ...postNeedExistingController
        },
        {
          method: 'GET',
          path: '/guidance/need/review',
          ...getNeedReviewController
        },
        {
          method: 'POST',
          path: '/guidance/need/review',
          ...postNeedReviewController
        },
        { method: 'GET', path: '/guidance/upload', ...getUploadController },
        {
          method: 'POST',
          path: '/guidance/upload',
          options: uploadOptions,
          ...postUploadController
        },
        {
          method: 'POST',
          path: '/guidance/upload/documents/add',
          options: uploadOptions,
          ...postDraftDocAddController
        },
        {
          method: 'POST',
          path: '/guidance/upload/documents/delete',
          ...postDraftDocDeleteController
        },
        {
          method: 'GET',
          path: '/guidance/converted',
          ...getConvertedController
        },
        {
          method: 'GET',
          path: '/guidance/confirm-sections',
          ...getConfirmSectionsController
        },
        {
          method: 'POST',
          path: '/guidance/confirm-sections',
          ...postConfirmSectionsController
        },
        {
          method: 'GET',
          path: '/guidance/sections',
          ...getGuideEditorController
        },
        {
          method: 'GET',
          path: '/guidance/example',
          ...getExampleController
        },
        {
          method: 'POST',
          path: '/guidance/sections',
          ...postGuideEditorController
        },
        { method: 'GET', path: '/guidance/review', ...getReviewController },
        { method: 'POST', path: '/guidance/review', ...postReviewController },
        { method: 'GET', path: '/guidance/changes', ...getChangesController },
        {
          method: 'GET',
          path: '/guidance/published/{id}',
          ...getPublishedGuideController
        },
        { method: 'GET', path: '/guidance/test', ...getTestController },
        { method: 'POST', path: '/guidance/test', ...postTestController },
        {
          method: 'GET',
          path: '/guidance/test/scenario/{id}',
          ...getScenarioFormController
        },
        {
          method: 'POST',
          path: '/guidance/test/scenario/{id}',
          ...postScenarioFormController
        },
        { method: 'GET', path: '/guidance/check', ...getCheckController },
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
