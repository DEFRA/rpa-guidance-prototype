const homeCrumb = { text: 'Home', href: '/' }

/**
 * The cookies page: explains the essential cookie this prototype uses.
 */
export const cookiesController = {
  handler(_request, h) {
    return h.view('legal/cookies', {
      pageTitle: 'Cookies',
      breadcrumbs: [homeCrumb]
    })
  }
}

/**
 * The accessibility statement page.
 */
export const accessibilityController = {
  handler(_request, h) {
    return h.view('legal/accessibility-statement', {
      pageTitle: 'Accessibility statement',
      breadcrumbs: [homeCrumb]
    })
  }
}
