import { buildAnswer } from './stub.js'

const THREAD_KEY = 'demandThread'
const LOG_KEY = 'demandLog'

// Labels for the call log, used to show back what the handler recorded.
const OUTCOME_LABELS = {
  resolved: 'Resolved on this call',
  transferred: 'Transferred to a specialist',
  'follow-up': 'Customer needs to follow up'
}

const QUERY_LABELS = {
  funding: 'Funding',
  application: 'Application',
  eligibility: 'Eligibility',
  documents: 'Supporting documents',
  other: 'Something else'
}

const SEED_QUESTION =
  'What documents does an applicant need to support a claim?'

// ── Phase 7: authenticate (stubbed sign-in) ────────────────────────────────
export const getSignInController = {
  handler(_request, h) {
    return h.view('demand/sign-in', {
      pageTitle: 'Sign in',
      backHref: '/'
    })
  }
}

export const postSignInController = {
  handler(_request, h) {
    return h.redirect('/demand/ask')
  }
}

// ── Phase 8: find the guidance (ask) ───────────────────────────────────────
export const getAskController = {
  handler(request, h) {
    // Starting a new question begins a fresh thread.
    request.yar?.clear?.(THREAD_KEY)

    return h.view('demand/ask', {
      pageTitle: 'Find and use guidance',
      backHref: '/demand/sign-in'
    })
  }
}

export const getAnswerController = {
  handler(request, h) {
    const thread = request.yar?.get(THREAD_KEY) ?? []

    // Seed a default exchange if someone lands here directly.
    const messages = thread.length
      ? thread
      : [
          { role: 'user', text: SEED_QUESTION },
          { role: 'assistant', ...buildAnswer(SEED_QUESTION) }
        ]

    return h.view('demand/answer', {
      pageTitle: 'Find and use guidance',
      thread: messages
    })
  }
}

// Questions are posted, never sent by GET, so the text the user is warned may
// be sensitive never lands in the URL, browser history or server logs. Post,
// redirect, get, then the page focuses the new answer.
export const postAnswerController = {
  handler(request, h) {
    const question = (request.payload?.q ?? '').trim()

    if (question) {
      const thread = request.yar?.get(THREAD_KEY) ?? []
      thread.push({ role: 'user', text: question })
      thread.push({ role: 'assistant', ...buildAnswer(question) })
      request.yar?.set(THREAD_KEY, thread)
    }

    return h.redirect('/demand/answer#latest-answer')
  }
}

// ── Phase 9: answer and follow up (log the call) ───────────────────────────
function renderLog(h, values, errors) {
  const errorList = []
  if (errors?.outcome) {
    errorList.push({ text: errors.outcome, href: '#outcome' })
  }
  if (errors?.queryType) {
    errorList.push({ text: errors.queryType, href: '#queryType' })
  }

  return h.view('demand/log', {
    pageTitle: (errors ? 'Error: ' : '') + 'Log this call',
    backHref: '/demand/answer',
    values: values ?? {},
    errors: errors ?? {},
    errorList
  })
}

export const getLogController = {
  handler(_request, h) {
    return renderLog(h)
  }
}

export const postLogController = {
  handler(request, h) {
    const payload = request.payload ?? {}
    const values = {
      outcome: payload.outcome,
      queryType: payload.queryType,
      helpful: payload.helpful,
      reference: (payload.reference ?? '').trim()
    }

    const errors = {}
    if (!values.outcome) {
      errors.outcome = 'Select how the call ended'
    }
    if (!values.queryType) {
      errors.queryType = 'Select what the query was about'
    }

    if (Object.keys(errors).length > 0) {
      return renderLog(h, values, errors)
    }

    request.yar?.set(LOG_KEY, values)
    return h.redirect('/demand/done')
  }
}

export const getDoneController = {
  handler(request, h) {
    const log = request.yar?.get(LOG_KEY) ?? {}
    request.yar?.clear?.(THREAD_KEY)
    request.yar?.clear?.(LOG_KEY)

    const rows = []
    if (log.outcome) {
      rows.push({
        key: { text: 'Outcome' },
        value: { text: OUTCOME_LABELS[log.outcome] ?? log.outcome }
      })
    }
    if (log.queryType) {
      rows.push({
        key: { text: 'Query type' },
        value: { text: QUERY_LABELS[log.queryType] ?? log.queryType }
      })
    }
    if (log.helpful) {
      rows.push({
        key: { text: 'Assistant helpful' },
        value: { text: log.helpful === 'yes' ? 'Yes' : 'No' }
      })
    }
    if (log.reference) {
      rows.push({
        key: { text: 'Customer reference' },
        value: { text: log.reference }
      })
    }

    return h.view('demand/done', {
      pageTitle: 'Call logged',
      reference: 'CALL-2026-8842',
      rows
    })
  }
}
