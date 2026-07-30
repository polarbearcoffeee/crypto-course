## Context

The current product is a GitHub Pages static site. `index.html` contains the learner application, shared-PIN admin UI, course content fallback, local progress, and direct Firestore reads and writes. Firestore collections `ta_content`, `ta_students`, and `ta_settings` share the unrelated `airport-car` Firebase project. Learner identity, progress, XP, and check-in authority are primarily browser `localStorage`; every client subscribes to the complete learner collection.

The target product is not a generic CMS. It is a small learning-operations and referral-conversion platform serving:

- learners completing beginner and later advanced courses;
- teachers verifying Bitunix UIDs and following up with stuck learners;
- content editors maintaining lessons and quizzes;
- owners monitoring acquisition quality, activation, completion, and operational risk;
- analysts comparing sources and course performance.

The design must permit staged migration because the existing learner site is live and has device-local progress. Formal security testing remains a separate `security-check` scope, but this design must establish enforceable identity and authorization boundaries.

## Goals / Non-Goals

**Goals:**

- Create an independent, authenticated administration application with a detailed operations dashboard.
- Provide a reliable event ledger and versioned metric definitions for reproducible analytics.
- Support a complete UID verification and learner follow-up workflow.
- Make curriculum changes safe through draft, validation, versioning, publishing, and rollback.
- Remove unbounded learner reads and render-triggered writes from the learner experience.
- Preserve an incremental migration path from current device-local records.
- Separate development, staging, and production data.

**Non-Goals:**

- Automatically validate UID against private Bitunix affiliate systems without an approved official integration.
- Execute trades, hold assets, provide investment recommendations, or build exchange/wallet functionality.
- Add automated learner messaging in the first release; first release produces queues and exports only.
- Build advanced-course educational content; the platform will support it, but subject-matter creation is separate.
- Rebuild the learner visual design during the first admin release.
- Treat XP or leaderboard ranking as financial value.

## Decisions

### 1. Separate learner and admin applications

Create an independent admin SPA under a separate deployment and authentication boundary. Keep the current learner site functioning during migration, then replace direct Firestore operations with a small data-access layer.

**Why:** the detailed dashboard, routing, forms, tables, permissions, and testability exceed a maintainable single-file implementation. Separation also prevents learner bundles from containing admin-only queries and fields.

**Recommended stack:** React + TypeScript + Vite for the admin SPA, TanStack Router, TanStack Query, and a tested component library. React is recommended because the admin requires complex tables, filters, URL state, cache management, and broad maintenance talent.

**Alternative considered:** continue vanilla JavaScript in `index.html`. Rejected because it preserves the same re-render, validation, state, and testing problems.

### 2. Use a dedicated Firebase project and three environments

Create separate development, staging, and production Firebase projects for crypto-course. Do not continue sharing the `airport-car` production boundary.

**Why:** separation limits accidental writes, clarifies billing and Security Rules, and enables safe dynamic tests.

**Alternative considered:** keep one Firebase project with collection prefixes. Acceptable only as a temporary bridge; it does not provide sufficient environment or ownership isolation.

### 3. Named authentication plus custom-claim roles

Use Firebase Authentication for named administrators. Store role assignments in `adminUsers/{uid}` and mirror stable authorization claims into custom claims or a server-validated permission layer. Firestore Rules and callable/server endpoints enforce permissions.

Roles:

| Role | Primary responsibilities |
|---|---|
| owner | all settings, administrators, publishing, rollback, export, audit |
| lead-teacher | learner operations, UID verification, publishing, reports |
| assistant | learner follow-up and permitted UID verification |
| content-editor | curriculum draft and preview, no publishing by default |
| analyst | dashboard and non-PII reports, read-only |

The shared PIN becomes a short-lived migration path and is removed after an owner account is verified.

### 4. Event ledger as analytics source of truth

Write immutable events to `learningEvents/{eventId}` through a trusted ingestion function. Clients generate event IDs; the server adds authoritative timestamps, validates payloads, enforces idempotency, and awards XP through a rule version.

Learner summary documents remain for fast UI reads but are derived state, not the only history. A scheduled reconciliation compares summaries with events and XP ledger entries.

**Why:** current summaries cannot explain how a number was produced, cannot support reproducible funnels, and trust client time.

### 5. Pre-aggregated dashboard metrics with drill-down query contracts

Do not calculate the dashboard by downloading all learners. Use server-side or scheduled aggregations:

- `metricDaily/{date_dimension_key}` for daily KPI counts;
- `metricCohorts/{cohort_dimension_key}` for cohort retention;
- `metricLessons/{courseVersion_lesson_date}` for lesson and question metrics;
- operational queues from indexed learner status fields;
- drill-down endpoints that resolve metric filters into paginated learner IDs.

The dashboard displays `asOf`, freshness status, and metric-definition version.

**Why:** small datasets can query Firestore directly, but the current design already exposes private fields to every learner and will not scale. Aggregates keep reads predictable.

### 6. Curriculum as immutable published versions

Use:

- `curriculumDrafts/{draftId}`;
- `curriculumVersions/{versionId}`;
- `curriculumCurrent/{courseId}` pointer;
- `curriculumAudit/{auditId}` or the global audit log.

Publishing validates the full draft, writes an immutable version, and atomically moves the current pointer. Rollback creates a new version containing restored content. Learners never read drafts.

### 7. Explicit learner and UID state models

Learner operational fields are separated from analytics and immutable events:

```
learner.status: active | paused | blocked | deleted-pending-retention
learner.learningState: registered | activated | in-progress | stuck | completed | inactive
learner.uidStatus: pending | verified | rejected | needs-correction
```

UID history records normalized value, old value, reason, verifier, and timestamps. Duplicate UID detection creates a review item and never auto-merges.

### 8. Dashboard information architecture

The default dashboard is an action-oriented control room:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Date | Source | Cohort | Course | UID | Learner State | Saved View │
├──────────────────────────────────────────────────────────────────────┤
│ Registered │ UID Pending │ Activation │ 7d Active │ Completed │ Stuck│
├──────────────────────────────┬───────────────────────────────────────┤
│ Recruitment → Completion     │ Today / This week operational queues │
│ funnel                       │ UID, stuck, sync, content, alerts     │
├──────────────────────────────┼───────────────────────────────────────┤
│ Registration / activation /  │ Source quality table                 │
│ completion trends            │ volume + conversion + completion     │
├──────────────────────────────┴───────────────────────────────────────┤
│ Lesson performance table: starts, pass, attempts, time, drop-off    │
└──────────────────────────────────────────────────────────────────────┘
```

Every learner count drills down to the same filtered learner directory. Cards show numerator, denominator, comparison, definition, freshness, and error state.

### 9. URL-addressable admin state

Filters, date ranges, table columns, sort, pagination, selected dashboard tab, and saved views use URL state. This enables refresh, browser navigation, bookmarks, and shareable operational views without sharing unauthorized data.

### 10. Data model

Primary collections:

| Collection | Purpose | Key fields |
|---|---|---|
| `learners` | current learner identity and operational summary | name, sourceFirst, sourceLatest, status, learningState, uidStatus, currentLesson, lastActiveAt, createdAt |
| `learnerPrivate` | restricted PII/UID fields | learnerId, uidCurrent, uidNormalized, contact fields if approved |
| `uidVerifications` | UID workflow history | learnerId, status, value, reason, verifierId, verifiedAt |
| `learningEvents` | immutable activity ledger | eventId, type, learnerId, occurredAt, receivedAt, courseVersion, lessonId, properties |
| `xpLedger` | immutable XP awards and adjustments | learnerId, ruleId, eventId, idempotencyKey, amount, balanceAfter |
| `learnerProgress` | version-aware completion summary | learnerId, courseVersion, lessonId, quizVersion, watchedAt, passedAt, attempts |
| `curriculumDrafts` | editable content | courseId, baseVersion, status, content, editorId, updatedAt |
| `curriculumVersions` | immutable published content | versionId, content, checksum, publisherId, publishedAt, note |
| `adminUsers` | admin profile and role assignment | uid, displayName, roles, status |
| `auditLogs` | immutable sensitive action history | actorId, action, target, before, after, reason, requestId, result |
| `settingsVersions` | versioned operational settings | version, rules, actorId, activatedAt |
| `metricDaily` / `metricCohorts` / `metricLessons` | dashboard aggregates | dimensions, values, metricVersion, asOf |
| `alerts` | operational alerts | type, severity, state, count, firstSeenAt, ownerRole, link |
| `dataQualityIssues` | reconciliation and malformed-data queue | type, recordId, severity, detectedAt, state |

### 11. Metric definitions

Initial definitions:

- **Registered learners:** distinct learners with accepted `registration_submitted` in the selected cohort.
- **UID verification rate:** distinct verified learners divided by registered learners eligible for verification.
- **Activated learners:** registered learners with at least one accepted `lesson_started`.
- **7-day active:** distinct learners with a valid learning event in the trailing seven 24-hour periods using Asia/Taipei reporting boundaries.
- **Beginner completion:** learners satisfying the current course-version completion contract divided by selected cohort size.
- **Stuck learners:** started but incomplete learners without a progress event for the configured period.
- **Advanced eligible:** learners satisfying the published advanced eligibility rule.

Metric definitions are versioned. Historical exports include the metric version.

### 12. Migration strategy for existing learners

Create a migration tool that reads current `ta_students` into staging, maps fields, and labels evidence strength:

- device-generated ID remains `legacyLearnerId`;
- current summary becomes an imported snapshot;
- local-only XP without ledger becomes `legacy-import` ledger adjustment;
- UID starts `pending` unless separately verified;
- missing source becomes `unknown`;
- progress uses legacy course and quiz version `v1`.

The migration never fabricates learning events. Reports distinguish pre-event imported summaries from event-backed activity.

## Risks / Trade-offs

- **[Risk] Existing learners have no login and may fragment across devices** → provide a temporary claim/transfer path, keep legacy IDs, and avoid automatic merges.
- **[Risk] Firestore aggregation costs or limits grow** → pre-aggregate metrics, index operational queues, monitor reads/writes, and move heavy analytics to BigQuery only when justified.
- **[Risk] UID cannot be officially validated by the product** → model verification as manual evidence-based workflow; do not label it automated exchange validation.
- **[Risk] Event tracking begins after historical usage** → label historical periods “summary-only”, never display missing events as zero, and record tracking start date.
- **[Risk] Curriculum version changes invalidate learner completion** → require explicit publish policy and preview affected learner count.
- **[Risk] New admin scope delays urgent fixes** → phase the work: data boundary and stop-the-bleeding fixes first, then operations, then analytics.
- **[Trade-off] React/Vite adds build tooling** → accept this cost for typed contracts, routing, tests, and maintainable admin state; keep learner front end unchanged initially.
- **[Trade-off] Separate Firebase projects increase setup work** → accept this to gain safe testing, cleaner billing, and controlled production access.

## Migration Plan

1. Back up current repository, current curriculum document, settings, and learner collection; verify restore in an isolated project.
2. Create crypto-course development and staging Firebase projects, schemas, indexes, Authentication, Rules, and test data.
3. Implement event contracts, XP ledger, learner summary, and server-time rules behind feature flags.
4. Import a redacted copy of legacy data into staging; run reconciliation and field mapping reports.
5. Build named admin authentication, permission enforcement, audit log, learner directory, and UID workflow.
6. Build curriculum draft/version/publish flow; migrate current curriculum as legacy v1.
7. Build metric aggregations and dashboard after event/summary contracts are stable.
8. Pilot with owner and one teacher; compare old and new counts for at least one reporting period.
9. Create and verify the first owner account, disable production PIN writes, and open the new admin read-only.
10. Enable operational writes in controlled stages: UID workflow, notes/tags, curriculum publishing, settings.
11. Redirect the learner front end to the new data-access layer and remove complete-collection reads.
12. Maintain rollback by keeping old admin read-only and current published curriculum pointer restorable until acceptance.

## Open Questions

- Will the owner provide a separate Firebase project and billing ownership, or must phase 1 remain under the shared project?
- Is there any approved Bitunix API or export that can support UID evidence, or is verification permanently manual?
- What learner-contact channel is available for future follow-up, and has consent been obtained?
- Should an existing learner be forced to retake after a major safety lesson change, or should policy vary by publication?
- What scale is expected at 3, 12, and 24 months: registered learners, daily active learners, and admin staff?
- Which role may view full UID values, and which roles only need masked values?
- Does “advanced eligible” require only beginner completion, UID verification, teacher approval, or a combination?
