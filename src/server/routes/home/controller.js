/**
 * The service start page (GOV.UK "start using a service" pattern): what the
 * service does, who it is for, what you need, then a single Start now into the
 * make journey. The demand and find-funding journeys still exist in the code
 * but are not linked from here, because the service is scoped to making
 * guidance.
 */
export const homeController = {
  handler(_request, h) {
    return h.view('home/index', {
      pageTitle: 'Make and publish RPA guidance'
    })
  }
}
