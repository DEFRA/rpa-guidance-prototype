// Stub "AI" responses for the find-and-use assistant. There is no real
// retrieval: a few canned answers are keyed off the question so the assistant
// reads as a guidance tool, not just a funding finder. The supporting-documents
// and eligibility answers cite the guide the make-journey publishes, which
// closes the supply-to-demand loop (a call handler can see where the answer
// comes from, and how that guide is made).

const guideSource = {
  title: 'Subsidy application process',
  url: '/guidance/start',
  summary:
    'The published RPA guide this answer draws on. See how it is made in the make and publish journey.',
  scheme: 'Guidance Hub'
}

const answers = [
  {
    match: /document|upload|evidence|proof|invoice|receipt|file/,
    answer:
      'Applicants upload their supporting documents in the Rural Payments service. Each file must be a PDF, JPG or PNG and no larger than 10MB. They usually need proof of the cost (for example an invoice), proof of payment (for example a bank statement), and photographs of the completed work. Check the published guidance for the full list before you advise the customer.',
    sources: [
      guideSource,
      {
        title: 'Manage your documents in the Rural Payments service',
        url: 'https://www.gov.uk/guidance/rural-payments',
        summary: 'How applicants submit and manage documents online.',
        scheme: 'Rural Payments'
      }
    ]
  },
  {
    match: /eligib|cost|qualify|claim/,
    answer:
      'Eligible costs are those directly linked to the work in the agreement, and the applicant must keep evidence of everything they claim for. They include materials, contractor charges for eligible activities, and equipment hire for the duration of the work. Routine running costs, and work that started before the agreement began, cannot be claimed. Check the published guidance for the current detail.',
    sources: [
      guideSource,
      {
        title: 'Check what funding you can get',
        url: 'https://www.gov.uk/guidance/funding-for-farmers',
        summary: 'Eligibility for environmental land management schemes.',
        scheme: 'Funding'
      }
    ]
  },
  {
    match: /hedge|fund|payment|money|grant|scheme|sfi/,
    answer:
      'The customer may be able to get funding to manage hedgerows under the Sustainable Farming Incentive (SFI). The main actions pay per 100 metres of hedgerow, one side, for assessing and recording hedgerow condition, leaving hedgerows uncut, and maintaining or establishing hedgerow trees. Always check the current payment rates and eligibility on GOV.UK before advising the customer to apply.',
    sources: [
      {
        title: 'Sustainable Farming Incentive: hedgerow actions',
        url: 'https://www.gov.uk/guidance/sfi-hedgerow-actions',
        summary:
          'Payment rates and eligibility for hedgerow actions under SFI.',
        scheme: 'SFI'
      },
      {
        title: 'Countryside Stewardship: boundaries, trees and orchards',
        url: 'https://www.gov.uk/guidance/cs-boundaries-trees-orchards',
        summary: 'Capital items for hedgerow planting, gapping up and laying.',
        scheme: 'Countryside Stewardship'
      }
    ]
  }
]

const defaultAnswer = {
  answer:
    'This tool finds published RPA guidance to help answer a customer query. Ask about a scheme, an application step, eligibility, or what documents an applicant needs, and it will point to the guidance to check.',
  sources: [guideSource]
}

/**
 * @param {string} question
 * @returns {{ answer: string, sources: Array<{title: string, url: string, summary: string, scheme: string}> }}
 */
function buildAnswer(question) {
  const text = (question || '').toLowerCase()
  const matched = text
    ? answers.find((entry) => entry.match.test(text))
    : undefined
  const { answer, sources } = matched ?? defaultAnswer
  return { answer, sources }
}

export { buildAnswer }
