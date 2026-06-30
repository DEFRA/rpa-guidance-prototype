// The service is scoped to making guidance, so the service navigation links
// Home only. The demand and find-funding journeys still exist in the code but
// are not linked from the nav.
export function buildNavigation(request) {
  const path = request?.path ?? ''
  return [
    {
      text: 'Home',
      href: '/',
      current: path === '/'
    }
  ]
}
