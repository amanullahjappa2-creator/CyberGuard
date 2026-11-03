# Learning data model

## Purpose and boundary

This design is the prerequisite for account-level learning reports, teacher
views of individual progress, structured lessons, and server-authorized
assessments. Until those controls exist, browser progress remains the source of
truth and account backup remains an explicit student action. The current
aggregate XP value and adaptive observations do not prove how a result was
earned.

## Event record

Record learning as append-only events with a stable, client-generated UUID:

| Field | Meaning |
| --- | --- |
| `eventId` | UUID used for deduplication across retries and device merges. |
| `eventType` | Versioned allowlist such as `level_completed`, `lesson_completed`, `knowledge_check_answered`, or `xp_awarded`. |
| `occurredAt` | Client timestamp in UTC; useful for ordering, not trusted evidence. |
| `contentId` | Stable level, lesson, question, or course identifier. |
| `contentVersion` | Version of the content presented to the learner. |
| `attemptId` | Random ID linking events from one attempt without revealing identity. |
| `result` | Bounded outcome fields appropriate to the event type. Never store free-text answers. |
| `xpDelta` | Nonnegative integer award, zero for events that award no XP. |
| `source` | `local_practice`, `lesson`, or `server_assessment`; server-only sources are assigned by the server. |
| `schemaVersion` | Event payload version for validation and migration. |

Events must not contain names, email addresses, certificate names, raw answer
text, URLs visited outside the fictional exercises, or device fingerprints.
Question identifiers and result values are checked against the content version
on the server for any server-authorized assessment. A browser-only event is a
useful progress record but is not cryptographic proof of completion.

## XP accounting

`xp` is a derived balance: sum unique, valid `xp_awarded` events. Each award
references the event that earned it and has a deterministic award key scoped to
learner, content version, attempt, and award kind. Replaying an upload cannot
award XP twice. The existing cumulative XP value has no award ledger; migration
must preserve it as a clearly labelled `legacy_balance` adjustment, never
fabricate historical award details. Merging event histories unions by
`eventId`; conflicting records with one ID are rejected. Legacy balances merge
using the greater value until both copies have ledger-backed balances, avoiding
double-counting existing totals.

## Storage and sync

- Offline browser play writes events locally and continues to work without an
  account or network connection.
- Explicit backup uploads bounded event batches with the existing revision
  precondition. The server validates shape, size, allowed identifiers, and
  deduplication, then returns the canonical accepted events and revision.
- A conflict requires fetching the latest snapshot, merging by ID, and retrying;
  an event is never silently overwritten.
- Keep aggregate level records and adaptive observations during transition.
  They can be recomputed from events only after equivalence is demonstrated;
  do not delete or reinterpret them as event evidence.
- Retention and deletion follow the account's progress backup lifecycle. Event
  exports must be explicitly requested by the learner and omit account
  identifiers.

## Authorization and reporting gates

Teacher access to a learner's event history requires an active approved
membership in a teacher-owned class, an explicit learner-facing disclosure, and
server-side ownership checks on every query. Class reports return only the
minimum necessary fields. Legacy token-owned classes do not grant access to
account event histories. Assessments that reveal grades or award trusted XP
must use server-held answer keys, server-side scoring, attempt limits, and a
defined answer-release policy; static client files cannot hold secret answers.

Before implementation, tests must cover duplicate uploads, conflicting IDs,
concurrent revision conflicts, legacy XP migration, event size limits, content
version validation, deletion, unauthorized teacher access, and no-network local
play. These are acceptance criteria, not claims about current behavior.
