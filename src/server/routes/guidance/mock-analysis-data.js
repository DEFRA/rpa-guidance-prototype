/**
 * Mock analysis response data for development/testing.
 * Used when GUIDANCE_API_MOCK_ANALYSIS is enabled.
 */

/** @type {import('./analyse.js').AnalyseResponse} */
const mockAnalysisData = {
  verdict: 'not_ready',
  summary:
    'This document has several clarity and completeness issues that should be addressed before publishing. The structure is good, but key sections lack sufficient detail and some wording is ambiguous.',
  document_title: 'Subsidy application process',
  findings: [
    {
      category: 'Clarity',
      section: '2.1, Application overview',
      severity: 'high',
      issue: 'Ambiguous definition of "eligible costs"',
      why_it_matters:
        'Users may misunderstand which expenses qualify, leading to incorrect applications and processing delays.',
      recommendation:
        'Provide a detailed, itemised list of eligible and ineligible cost categories with clear examples.'
    },
    {
      category: 'Clarity',
      section: '3.2, Supporting documents',
      severity: 'medium',
      issue: 'Vague acceptance criteria for uploaded files',
      why_it_matters:
        'Users cannot determine if their documents meet the requirements, causing rejections.',
      recommendation:
        'Specify exact file formats, size limits, resolution (for scans), and required metadata.'
    },
    {
      category: 'Completeness',
      section: '4.0, Appeals process',
      severity: 'critical',
      issue: 'Appeals process section is missing entirely',
      why_it_matters:
        'Users will not know how to challenge a decision they disagree with.',
      recommendation:
        'Add a comprehensive section covering appeal timelines, grounds, and escalation steps.'
    },
    {
      category: 'Completeness',
      section: '2.3, Eligibility criteria',
      severity: 'high',
      issue:
        'Does not address cross-compliance requirements for environmental regulations',
      why_it_matters:
        'Users may submit applications that do not qualify, leading to rejected claims and extra work to put right.',
      recommendation:
        'Reference relevant environmental and land management compliance requirements.'
    },
    {
      category: 'Consistency',
      section: '1.1, Introduction',
      severity: 'low',
      issue: 'Department name and abbreviation changed between sections',
      why_it_matters:
        'Minor inconsistency may confuse users about which department to contact.',
      recommendation:
        'Standardise department names throughout (for example, always use "RPA" or "Rural Payments Agency", not both).'
    },
    {
      category: 'Accuracy',
      section: '5.1, Contact information',
      severity: 'medium',
      issue: 'Email address format appears incorrect (missing domain)',
      why_it_matters:
        'Users cannot contact support if the email address is invalid.',
      recommendation:
        'Verify and update the email address to ensure it is correct and monitored.'
    }
  ],
  good_points: [
    'Document structure is logical and easy to navigate with clear section headings',
    'Step-by-step instructions are well formatted and easy to follow',
    'Visual diagrams clearly illustrate the application workflow',
    'Timeline expectations are clearly stated (for example, "Applications processed within 5 working days")',
    'Common questions are well organised and address user pain points'
  ],
  usage: {
    input_tokens: 2847,
    output_tokens: 1203
  }
}

export { mockAnalysisData }
