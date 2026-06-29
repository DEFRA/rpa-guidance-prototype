/**
 * Mock guidance document data for the library , the content designer's
 * case-management view of the guides they and their team author.
 *
 * Each guide carries the metadata the library needs to be searched, filtered
 * and recognised (scheme, owner, status, a one-line summary, created and updated
 * dates), plus the ingested context documents: the briefing and operational
 * documents given when the guide's need was captured.
 *
 * A handful of guides are hand-written exemplars (the SFI23 parcel-tenure guide
 * authored in the make journey appears here as the user's own work in progress).
 * The rest are generated so the library shows what 100+ Word documents from a
 * SharePoint site actually look like: enough to need search, faceted filters and
 * pagination.
 */
const featuredGuides = [
  {
    id: 'sfi23-parcel-tenure',
    reference: 'RPA-2026-0042',
    title: 'SFI parcel ID not linked to SBI in SITI Tenure (SFI23)',
    scheme: 'Sustainable Farming Incentive',
    status: 'draft',
    summary:
      'Work an SFI parcel-not-linked-to-SBI case: tenure and mapping checks, the right hold code, and the Operations Resolution route.',
    owner: 'You',
    audience: 'Processing and operational staff',
    createdAt: '2026-06-24T09:00:00.000Z',
    updatedAt: '2026-06-29T08:40:00.000Z',
    contextDocs: [
      { name: 'SFI23 operational briefing.docx', type: 'Briefing' },
      { name: 'Tenure change request CR-1182.docx', type: 'Change request' }
    ]
  },
  {
    id: 'es-uplands-guide',
    reference: 'RPA-2026-0048',
    title: 'Environmental Stewardship uplands guide',
    scheme: 'Environmental Stewardship',
    status: 'draft',
    summary:
      'Handle Environmental Stewardship uplands agreement changes and the queries they raise.',
    owner: 'You',
    audience: 'Processing and operational staff',
    createdAt: '2026-06-14T10:00:00.000Z',
    updatedAt: '2026-06-28T15:20:00.000Z',
    contextDocs: [
      { name: 'ES uplands agreement note.docx', type: 'Operational note' }
    ]
  },
  {
    id: 'sfi-actions-guide',
    reference: 'RPA-2026-0012',
    title: 'Sustainable Farming Incentive actions guide',
    scheme: 'Sustainable Farming Incentive',
    status: 'in-review',
    summary:
      'Check SFI actions against agreements and resolve action-level queries.',
    owner: 'Mark Ellison',
    audience: 'Processing and operational staff',
    createdAt: '2026-06-05T16:45:00.000Z',
    updatedAt: '2026-06-23T11:05:00.000Z',
    contextDocs: [
      { name: 'SFI actions reference.docx', type: 'Briefing' },
      { name: 'Action query log.docx', type: 'Operational note' }
    ]
  },
  {
    id: 'cs-higher-tier',
    reference: 'RPA-2026-0035',
    title: 'Countryside Stewardship Higher Tier manual',
    scheme: 'Countryside Stewardship',
    status: 'testing',
    summary:
      'Assess Countryside Stewardship Higher Tier claims and capital works evidence.',
    owner: 'Aisha Rahman',
    audience: 'Processing and operational staff',
    createdAt: '2026-06-12T11:15:00.000Z',
    updatedAt: '2026-06-27T09:30:00.000Z',
    contextDocs: [
      { name: 'CS Higher Tier manual extract.docx', type: 'Briefing' }
    ]
  },
  {
    id: 'rpa-subsidy-v2',
    reference: 'RPA-2026-0031',
    title: 'RPA Guidance: Subsidy Application Process v2.1',
    scheme: 'Cross-scheme',
    status: 'ready',
    summary:
      'Process a subsidy application: eligibility, evidence checks, and the decision route.',
    owner: 'Priya Shah',
    audience: 'Processing and operational staff',
    createdAt: '2026-06-10T09:00:00.000Z',
    updatedAt: '2026-06-26T14:10:00.000Z',
    contextDocs: [
      { name: 'Subsidy processing policy 2026.docx', type: 'Policy' },
      { name: 'Decision route note.docx', type: 'Operational note' }
    ]
  },
  {
    id: 'bps-2026-handbook',
    reference: 'RPA-2026-0019',
    title: 'Basic Payment Scheme 2026 handbook',
    scheme: 'Basic Payment Scheme',
    status: 'published',
    summary:
      'Work BPS 2026 claims: entitlements, cross-checks, and common exceptions.',
    owner: 'Tom Beckett',
    audience: 'Processing and operational staff',
    createdAt: '2026-06-08T14:30:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    contextDocs: [
      { name: 'BPS 2026 scheme rules.pdf', type: 'Policy' },
      { name: 'Entitlements briefing.docx', type: 'Briefing' }
    ]
  }
]

// ── Generated set: ~100 more guides so the library is a realistic SharePoint ──
const GEN_SCHEMES = [
  { name: 'Sustainable Farming Incentive', abbr: 'SFI' },
  { name: 'Basic Payment Scheme', abbr: 'BPS' },
  { name: 'Countryside Stewardship', abbr: 'CS' },
  { name: 'Environmental Stewardship', abbr: 'ES' },
  { name: 'Cross-scheme', abbr: 'XS' }
]
const GEN_TOPICS = [
  'Dual-use parcel handling',
  'Mapping change disputes',
  'Overpayment recovery',
  'Capital works evidence checks',
  'Agreement amendments',
  'Payment exceptions',
  'Hold code application',
  'Land eligibility checks',
  'Commons and shared grazing',
  'Young farmer payments',
  'Inspection follow-ups',
  'Force majeure claims',
  'Transfer of entitlements',
  'Scheme year transitions',
  'Remote sensing queries',
  'Boundary discrepancies',
  'Withdrawal and recovery',
  'Penalty calculations',
  'Cross-compliance breaches',
  'Tenure change processing',
  'Re-mapping requests',
  'Late claim handling'
]
const GEN_OWNERS = [
  'You',
  'Priya Shah',
  'Tom Beckett',
  'Aisha Rahman',
  'Mark Ellison',
  'Jo Fairhurst',
  'Dan Okonkwo',
  'Helen Voss'
]
const GEN_STATUSES = [
  'published',
  'draft',
  'published',
  'in-review',
  'published',
  'draft',
  'testing',
  'published',
  'ready',
  'draft',
  'in-review',
  'published'
]
const GEN_DOCS = [
  [{ name: 'Operational briefing.docx', type: 'Briefing' }],
  [
    { name: 'Policy note.docx', type: 'Policy' },
    { name: 'Worked examples.docx', type: 'Operational note' }
  ],
  [{ name: 'Change request.docx', type: 'Change request' }],
  [
    { name: 'Scheme rules extract.pdf', type: 'Policy' },
    { name: 'Process map.docx', type: 'Operational note' }
  ]
]

const generatedGuides = []
let gi = 0
for (const topic of GEN_TOPICS) {
  for (const scheme of GEN_SCHEMES) {
    const status = GEN_STATUSES[gi % GEN_STATUSES.length]
    const owner = GEN_OWNERS[gi % GEN_OWNERS.length]
    const docs = GEN_DOCS[gi % GEN_DOCS.length]
    const day = (gi % 27) + 1
    generatedGuides.push({
      id: 'guide-' + scheme.abbr.toLowerCase() + '-' + gi,
      reference: 'RPA-2026-' + String(100 + gi).padStart(4, '0'),
      title: topic + ' (' + scheme.abbr + ')',
      scheme: scheme.name,
      status,
      summary:
        'How to work ' + topic.toLowerCase() + ' for ' + scheme.name + '.',
      owner,
      audience: 'Processing and operational staff',
      createdAt:
        '2026-05-' + String((gi % 27) + 1).padStart(2, '0') + 'T09:00:00.000Z',
      updatedAt: '2026-06-' + String(day).padStart(2, '0') + 'T09:00:00.000Z',
      contextDocs: docs
    })
    gi++
  }
}

const mockDocuments = [...featuredGuides, ...generatedGuides]

export { mockDocuments }
