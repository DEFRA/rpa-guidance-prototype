/**
 * Mock analysis response data for development/testing.
 * Used when GUIDANCE_API_MOCK_ANALYSIS is enabled.
 *
 * This is a readiness check of the sample document the make-journey edits, the
 * real SFI/SITI processing guide. The findings deliberately reflect what makes
 * processing guidance hard to follow and hard for the find-and-use assistant to
 * search: references to other guides that are not links, screenshots with no
 * alt text, and unexpanded acronyms.
 */

/** @type {import('./analyse.js').AnalyseResponse} */
const mockAnalysisData = {
  verdict: 'not_ready',
  summary:
    'This processing guide is well structured, but a few issues would make it hard to follow, and hard to search, before it is published. References to other guides are not links, screenshots have no alt text, and acronyms are not expanded.',
  document_title: 'Parcel ID not linked to SBI in SITI Tenure (SFI23)',
  findings: [
    {
      category: 'Completeness',
      section: 'Throughout the guide',
      severity: 'critical',
      issue: 'References to other guides are not links',
      why_it_matters:
        'The procedure depends on dozens of references to other guides, for example the SITI Agri Basic Navigation guide. None are links, so an officer cannot follow a step without already knowing where each guide and section is.',
      recommendation:
        'Make every reference to another guide or section a working link.',
      suggestion: {
        before:
          'See the SITI Agri Basic Navigation guide for how to open the parcel.',
        after:
          'See the [SITI Agri Basic Navigation guide](/guidance/siti-agri-basic-navigation) for how to open the parcel.'
      }
    },
    {
      category: 'Accessibility',
      section: 'Throughout the guide',
      severity: 'high',
      issue: 'Screenshots have no descriptive alt text',
      why_it_matters:
        'The 14 screenshots are labelled only "system screen for this step". Officers using a screen reader, and the find-and-use assistant, cannot tell what each one shows, so those steps cannot be followed.',
      recommendation:
        'Give each screenshot specific alt text describing what to look at and what to do on the screen.',
      suggestion: {
        before: 'Screenshot. Alt text: "system screen for this step".',
        after:
          'Screenshot. Alt text: "SITI Tenure screen with the Parcel ID field highlighted and no SBI linked".'
      }
    },
    {
      category: 'Clarity',
      section: 'Throughout the guide',
      severity: 'high',
      issue: 'Acronyms are not expanded on first use',
      why_it_matters:
        'SBI, LPIS, JMS, CRM, PLCD, FRN, RLE1 and ORT appear without definition. A new processor, and the assistant answering a question, cannot reliably resolve them.',
      recommendation:
        'Expand each acronym on first use, or add a short terms list at the top of the guide.',
      suggestion: {
        before: 'Check the SBI in CRM against LPIS.',
        after:
          'Check the Single Business Identifier (SBI) in the Customer Relationship Management system (CRM) against the Land Parcel Identification System (LPIS).'
      }
    },
    {
      category: 'Completeness',
      section: 'Check CRM',
      severity: 'high',
      issue: 'Some decision branches do not state the next step',
      why_it_matters:
        'A few Yes and No branches end without telling the officer which section to go to next, so an investigation can stall mid-case.',
      recommendation:
        'End every branch with an explicit next step or a link to the section that follows.',
      suggestion: {
        before: 'Is the parcel linked to the SBI? No.',
        after:
          'Is the parcel linked to the SBI? No, go to "Apply hold HOLD972".'
      }
    },
    {
      category: 'Consistency',
      section: 'Multiple headings',
      severity: 'medium',
      issue: 'Headings are styled inconsistently',
      why_it_matters:
        'Some headings end in a full stop, for example "Check Old link.", and they mix title case with sentence case. This reads untidily and produces an inconsistent contents page.',
      recommendation:
        'Use sentence case with no trailing full stop for every heading.',
      suggestion: {
        before: '## Check Old link.',
        after: '## Check old link'
      }
    },
    {
      category: 'Clarity',
      section: 'Learner checks',
      severity: 'medium',
      issue: 'A referenced section name does not match its heading',
      why_it_matters:
        'Branches refer to a "Learner check" section, but the heading is "Learner checks", so officers may not be sure they are in the right place.',
      recommendation:
        'Make every in-text section reference match the actual heading exactly.',
      suggestion: {
        before: 'Go to the Learner check section.',
        after: 'Go to the Learner checks section.'
      }
    },
    {
      category: 'Consistency',
      section: 'Multiple sections',
      severity: 'low',
      issue: 'Hold codes are repeated without a single reference',
      why_it_matters:
        'HOLD972, HOLD963, HOLD925 and HOLD927 appear in different places with slightly different note wording, so an officer could apply the wrong note.',
      recommendation:
        'Add one table of hold codes with their standard notes, and refer to it.',
      suggestion: {
        before: 'Apply HOLD972 and add a note about the missing link.',
        after:
          'Apply HOLD972 (see Hold codes) and add the standard note for a missing parcel link.'
      }
    }
  ],
  good_points: [
    'The procedure is broken into clear, numbered investigation stages with a contents page',
    'Decision points consistently use a question followed by Yes and No branches',
    'Escalation routes (Team Leader, Operations Resolution Team, GI Operations) are spelled out, with the hold code to apply at each',
    'A standard case-note template is given for every contact and hold',
    'Screenshots are placed at the step where the officer needs them'
  ],
  usage: {
    input_tokens: 4120,
    output_tokens: 1486
  }
}

export { mockAnalysisData }
