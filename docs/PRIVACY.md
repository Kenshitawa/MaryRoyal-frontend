# Privacy and retention — Mary Royal School

**Status: draft for school approval.** This technical notice and schedule need review by the school's designated data protection lead/counsel before real learner data is entered. They are not legal advice or proof of regulatory compliance.

## What the system handles

The system may process learner identity, admission, guardian and emergency contact, attendance, assessment, fee, discipline, learning activity, photograph, document and health/special-needs information. Health and family information is restricted by role; access attempts and selected sensitive reads are audited. The public notice is available at `/privacy`.

## Purpose and safeguards

Data is used for admission and safeguarding, school administration, attendance, teaching and assessment, family communication, and fee accounting. Collect only fields required for those purposes. Use unique accounts, least-privilege role access, private document storage, encrypted transport, controlled backups and periodic access review. Obtain and retain verifiable parent/guardian consent before processing a child's data; record the consent timestamp and retain the signed admission declaration with the admission documents. Notify the family of purposes and rights in clear language.

## Data subject requests

Parents/guardians may contact the school to request access, correction, restriction, objection, or deletion where applicable. Requests must be identity-checked and handled by the Director or designated data protection lead, with a reasoned decision and audit trail. A Director-only, audited learner JSON export endpoint exists. A parent-facing request workflow, portable files bundle, and safe anonymization/deletion workflow are **not yet implemented**. Until delivered and verified, fulfill other requests through a controlled manual process and record it outside the app; do not claim those in-app workflows exist.

## Draft retention schedule

This is a starting schedule, not a finding that these periods satisfy every Kenyan education, finance, safeguarding, or limitation rule. The school must confirm applicable statutory and ministry requirements and approve exact periods before production use.

| Record | Proposed handling | Automation status |
|---|---|---|
| Abandoned admission drafts without an enrolled learner | Purge after 365 days since last update; remove associated private documents and retain a minimal purge audit event. | `npm run retention:enforce` supports dry run by default. Set `RETENTION_APPLY=PURGE_EXPIRED_DRAFTS` only after review/approval. |
| Enrolled learner academic, attendance and safeguarding history | Keep only while needed for the educational relationship and an owner-approved post-exit period; lock/archive after exit, then securely anonymize/delete unless a legal hold or statutory requirement applies. | No lifecycle automation yet. |
| Fee transactions, receipts, payroll and accounting records | Retain for the period required by applicable tax/accounting law and resolve legal holds before deletion. | No lifecycle automation yet. |
| Backups | Keep encrypted daily/month-end copies per the approved backup schedule; expire copies when the retention window ends. | Backup job/scheduled deletion not configured. |
| Access and audit logs | Restrict to Director/Head Teacher; establish a retention duration and review it with legal/accounting requirements. | Append-only behavior is not database-enforced; log retention purge is not implemented. |

## Legal references to review

- Kenya Data Protection Act, 2019: child data processing requires parent/guardian consent and best-interest safeguards; data subject rights and retention principles apply. [Kenya Law — Data Protection Act](https://new.kenyalaw.org/akn/ke/act/2019/24/eng%402019-11-15/source)
- ODPC's children's-data guidance calls for a defined retention schedule and secure deletion/anonymization when data is no longer needed. [ODPC — Guidance Notes for Processing Children's Data](https://www.odpc.go.ke/wp-content/uploads/2025/11/ODPC-%E2%80%93-Guidance-Note-for-Processing-Childrens-Data.pdf)
- ODPC's education guidance says schools should set retention periods by applicable laws/policy or reasonable, justified purposes. [ODPC — Education Sector Guidance](https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-for-the-Education-Sector.pdf)

The school should confirm controller/processor registration duties, cross-border hosting safeguards, child-consent wording, and whether a DPIA is required before launch.
