import { statusCodes } from '../../common/constants/status-codes.js'
import { mockFundingOptions } from './funding-data.js'

const APPLICANT_KEY = 'fundingApplicant'
const GOALS_KEY = 'fundingGoals'

export const startController = {
  handler(_request, h) {
    return h.view('find-funding/start', {
      pageTitle: 'Find funding for your land'
    })
  }
}

export const aboutYouController = {
  handler(request, h) {
    return h.view('find-funding/about-you', {
      pageTitle: 'Who are you applying as?',
      backHref: '/find-funding/start',
      applicant: request.yar.get(APPLICANT_KEY)
    })
  }
}

export const aboutYouSubmitController = {
  handler(request, h) {
    const applicant = request.payload?.applicant

    if (!applicant) {
      return h.view('find-funding/about-you', {
        pageTitle: 'Error: Who are you applying as?',
        backHref: '/find-funding/start',
        errorMessage: 'Select who you are applying as'
      })
    }

    request.yar.set(APPLICANT_KEY, applicant)
    return h.redirect('/find-funding/goals')
  }
}

export const goalsController = {
  handler(request, h) {
    return h.view('find-funding/goals', {
      pageTitle: 'What do you want to do?',
      backHref: '/find-funding/about-you',
      goals: request.yar.get(GOALS_KEY) ?? []
    })
  }
}

export const goalsSubmitController = {
  handler(request, h) {
    // Checkboxes submit a single value or an array; normalise to an array.
    const raw = request.payload?.goals
    const goals = Array.isArray(raw) ? raw : raw ? [raw] : []

    if (goals.length === 0) {
      return h.view('find-funding/goals', {
        pageTitle: 'Error: What do you want to do?',
        backHref: '/find-funding/about-you',
        goals: [],
        errorMessage: 'Select at least one thing you want to do'
      })
    }

    request.yar.set(GOALS_KEY, goals)
    return h.redirect('/find-funding/results')
  }
}

export const resultsController = {
  handler(request, h) {
    const goals = request.yar.get(GOALS_KEY) ?? []
    const options = goals.length
      ? mockFundingOptions.filter((option) =>
          (option.goals ?? []).some((goal) => goals.includes(goal))
        )
      : mockFundingOptions

    return h.view('find-funding/results', {
      pageTitle: 'Funding options',
      backHref: '/find-funding/goals',
      options,
      filtered: goals.length > 0
    })
  }
}

export const optionController = {
  handler(request, h) {
    const option = mockFundingOptions.find(
      (item) => item.id === request.params.id
    )

    if (!option) {
      return h
        .view('error/index', {
          pageTitle: 'Page not found',
          heading: statusCodes.notFound,
          message: 'Funding option not found'
        })
        .code(statusCodes.notFound)
    }

    return h.view('find-funding/option', {
      pageTitle: option.title,
      backHref: '/find-funding/results',
      option
    })
  }
}

export const contactController = {
  handler(_request, h) {
    return h.view('find-funding/contact', {
      pageTitle: 'Get more help',
      backHref: '/find-funding/results'
    })
  }
}
