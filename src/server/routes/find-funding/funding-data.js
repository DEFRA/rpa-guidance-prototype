/**
 * Mock funding options for the external "find funding" journey.
 * Stub data only. Real detail lives on GOV.UK, linked from each option.
 *
 * Each option is tagged with the goals it suits, so the results page can show
 * only the options that match what the customer told us.
 */
const mockFundingOptions = [
  {
    id: 'sfi-hedgerows',
    scheme: 'Sustainable Farming Incentive',
    title: 'Manage hedgerows',
    summary:
      'Payments for assessing, maintaining and establishing hedgerows on your land.',
    paysFor: 'Per 100 metres of hedgerow, one side',
    deadline: 'Open all year',
    tagText: 'Open',
    tagClass: 'govuk-tag--green',
    goals: ['hedgerows'],
    url: 'https://www.gov.uk/guidance/sfi-hedgerow-actions'
  },
  {
    id: 'sfi-soil',
    scheme: 'Sustainable Farming Incentive',
    title: 'Improve soil health',
    summary:
      'Actions for soil assessment, cover crops and adding organic matter.',
    paysFor: 'Per hectare',
    deadline: 'Open all year',
    tagText: 'Open',
    tagClass: 'govuk-tag--green',
    goals: ['soil'],
    url: 'https://www.gov.uk/guidance/sfi-soil-actions'
  },
  {
    id: 'cs-higher-tier',
    scheme: 'Countryside Stewardship',
    title: 'Higher tier agreement',
    summary:
      'Multi-year agreements for high-priority sites and more complex management.',
    paysFor: 'Per hectare, plus capital items',
    deadline: 'Applications close 1 September',
    tagText: 'Closing soon',
    tagClass: 'govuk-tag--yellow',
    goals: ['hedgerows', 'water', 'woodland'],
    url: 'https://www.gov.uk/guidance/countryside-stewardship-higher-tier'
  },
  {
    id: 'fetf-equipment',
    scheme: 'Farming Equipment and Technology Fund',
    title: 'Equipment and technology grants',
    summary:
      'Grants towards specific equipment to improve productivity and the environment.',
    paysFor: 'Grant towards listed items',
    deadline: 'Round closes 31 July',
    tagText: 'Closing soon',
    tagClass: 'govuk-tag--yellow',
    goals: ['equipment'],
    url: 'https://www.gov.uk/guidance/farming-equipment-and-technology-fund'
  },
  {
    id: 'cs-capital-water',
    scheme: 'Countryside Stewardship',
    title: 'Capital grants for water quality',
    summary:
      'One-off grants for items that reduce water pollution from farming.',
    paysFor: 'Grant per item',
    deadline: 'Open all year',
    tagText: 'Open',
    tagClass: 'govuk-tag--green',
    goals: ['water', 'soil'],
    url: 'https://www.gov.uk/guidance/capital-grants'
  }
]

export { mockFundingOptions }
