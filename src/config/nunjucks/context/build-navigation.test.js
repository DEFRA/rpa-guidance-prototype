import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should provide expected navigation details', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([
      {
        current: false,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'Make and publish guidance',
        href: '/guidance/start'
      },
      {
        current: false,
        text: 'Find and use guidance',
        href: '/demand/sign-in'
      },
      {
        current: false,
        text: 'Find funding',
        href: '/find-funding/start'
      }
    ])
  })

  test('Should provide expected highlighted navigation details', () => {
    expect(buildNavigation(mockRequest({ path: '/' }))).toEqual([
      {
        current: true,
        text: 'Home',
        href: '/'
      },
      {
        current: false,
        text: 'Make and publish guidance',
        href: '/guidance/start'
      },
      {
        current: false,
        text: 'Find and use guidance',
        href: '/demand/sign-in'
      },
      {
        current: false,
        text: 'Find funding',
        href: '/find-funding/start'
      }
    ])
  })
})
