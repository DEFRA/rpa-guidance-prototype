export function buildNavigation(request) {
  const path = request?.path ?? ''
  return [
    {
      text: 'Home',
      href: '/',
      current: path === '/'
    },
    {
      text: 'Make and publish guidance',
      href: '/guidance/start',
      current: path.startsWith('/guidance')
    },
    {
      text: 'Find and use guidance',
      href: '/demand/sign-in',
      current: path.startsWith('/demand')
    },
    {
      text: 'Find funding',
      href: '/find-funding/start',
      current: path.startsWith('/find-funding')
    }
  ]
}
