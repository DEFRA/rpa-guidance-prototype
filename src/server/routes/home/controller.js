// The three ways into the service. Each is a separate, self-contained journey
// through one part of the service blueprint. The audience line orients the
// stakeholders who review this prototype.
const entries = [
  {
    title: 'Make and publish guidance',
    href: '/guidance/start',
    description: 'Draft, review, test and publish a guide.',
    audience: 'For policy, design, approval and publishing teams'
  },
  {
    title: 'Find and use guidance',
    href: '/demand/sign-in',
    description: 'Answer a customer query using published guidance.',
    audience: 'For contact centre and operational staff'
  },
  {
    title: 'Find funding',
    href: '/find-funding/start',
    description: 'Find funding schemes for your land.',
    audience: 'For farmers, land managers and their advisers'
  }
]

/**
 * The service start page: choose one of the three journeys.
 */
export const homeController = {
  handler(_request, h) {
    return h.view('home/index', {
      pageTitle: 'Make, find and use guidance',
      entries
    })
  }
}
