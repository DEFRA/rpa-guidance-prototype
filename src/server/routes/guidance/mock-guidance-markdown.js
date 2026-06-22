// The sample Markdown the make-journey starts the editor with. In the real
// service a Word document would be ingested and converted to Markdown. In this
// prototype the conversion is stubbed: whatever file you upload, the editor is
// seeded with this realistic sample so the rest of the journey can be explored.
//
// The content deliberately matches the document the pre-publish check reports
// on ("Subsidy application process"), so the journey reads as one document
// moving through the phases.

const sampleGuidanceMarkdown = `# Subsidy application process

Use this guidance to apply for a rural payments subsidy. It explains who can apply, what counts as an eligible cost, and how to submit supporting documents.

## Who can apply

You can apply if you:

- manage at least 5 hectares of eligible land in England
- have a single business identifier (SBI)
- are registered with the Rural Payments service

## Eligible costs

You can claim for costs that are directly linked to the work in your agreement. Keep evidence of everything you claim for.

Eligible costs include:

- materials used to carry out the work
- contractor charges for eligible activities
- equipment hire for the duration of the work

You cannot claim for routine running costs, or for work that started before your agreement began.

## Supporting documents

Upload clear copies of your documents in the Rural Payments service. Each file must be a **PDF, JPG or PNG** and no larger than 10MB.

You will usually need to provide:

1. proof of the cost, for example an invoice or receipt
2. proof of payment, for example a bank statement
3. photographs of the completed work

## Get help

If you are not sure whether a cost is eligible, contact the RPA before you apply. Read the full scheme rules on [GOV.UK](https://www.gov.uk/guidance/rural-payments) or call the RPA helpline.
`

export { sampleGuidanceMarkdown }
