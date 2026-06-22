import { config } from '#/config/config.js'

const DEFAULT_RETURN = '/'

// Only ever redirect back to a same-site path, never an absolute or
// protocol-relative URL an attacker could craft in the returnTo parameter.
function safeReturnTo(value) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : DEFAULT_RETURN
}

export const passwordController = {
  handler(request, h) {
    return h.view('password/index', {
      pageTitle: 'Enter the password',
      returnTo: safeReturnTo(request.query.returnTo)
    })
  }
}

export const passwordSubmitController = {
  handler(request, h) {
    const returnTo = safeReturnTo(request.payload?.returnTo)
    const expected = config.get('auth.password')
    const supplied = (request.payload?.password ?? '').trim()

    if (expected && supplied === expected) {
      request.yar.set('isAuthenticated', true)
      return h.redirect(returnTo)
    }

    return h.view('password/index', {
      pageTitle: 'Enter the password',
      returnTo,
      error: 'Enter the correct password'
    })
  }
}
