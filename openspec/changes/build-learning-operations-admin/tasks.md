## 1. Project and environment foundation

- [ ] 1.1 Create a migration branch and record current repository, curriculum, settings, and learner-data backup identifiers.
- [ ] 1.2 Create dedicated crypto-course Firebase development and staging projects with named owners and billing visibility.
- [x] 1.3 Define production-project decision and document whether the shared `airport-car` project is temporary or retired.
- [x] 1.4 Create environment-specific configuration files without copying production credentials or learner data.
- [x] 1.5 Scaffold the TypeScript admin SPA with routing, query caching, form validation, table, chart, test, and accessibility tooling.
- [x] 1.6 Add CI checks for type checking, unit tests, component tests, build, and OpenSpec validation.
- [ ] 1.7 Add a staging deployment and verify it cannot access production Firestore collections.

## 2. Data contracts and security boundary

- [x] 2.1 Define typed schemas for learners, private learner data, UID verification, learning events, XP ledger, progress, curriculum, admins, audit, settings, metrics, alerts, and data-quality issues.
- [x] 2.2 Implement schema validation and reject malformed writes at trusted boundaries.
- [x] 2.3 Define Firestore indexes for learner queues, UID workflow, source filters, course stage, activity, and paginated admin views.
- [x] 2.4 Implement named administrator authentication and owner bootstrap in development.
- [x] 2.5 Implement role and permission matrix for owner, lead-teacher, assistant, content-editor, and analyst.
- [x] 2.6 Enforce field-level and operation-level permissions through Security Rules and trusted functions.
- [x] 2.7 Add emulator tests proving unauthorized roles cannot read UID/private notes, publish, export, change roles, or edit settings.
- [x] 2.8 Implement administrator activation, suspension, revocation, session expiry, and re-authentication for sensitive actions.
- [x] 2.9 Implement immutable administrative audit events with before/after values, reason, request ID, and result.
- [x] 2.10 Define and test the shared-PIN migration and removal sequence.

## 3. Learning event and XP foundation

- [x] 3.1 Define canonical event names, required fields, property schemas, and metric-definition version.
- [x] 3.2 Implement trusted event ingestion with server timestamp, authentication context, payload validation, and idempotent event IDs.
- [x] 3.3 Implement versioned XP rules and an immutable XP ledger with idempotency keys.
- [x] 3.4 Implement learner progress summaries derived from valid event and ledger data.
- [x] 3.5 Add tests for duplicate watch, duplicate quiz submit, stale client time, malformed lesson ID, and out-of-order events.
- [x] 3.6 Implement daily summary-to-ledger reconciliation and data-quality issue creation.
- [x] 3.7 Add event ingestion lag, failure count, and reconciliation status to the health model.

## 4. Legacy data migration

- [ ] 4.1 Export a redacted legacy dataset to staging and document field mapping from `ta_students`, `ta_content`, and `ta_settings`.
- [x] 4.2 Implement a dry-run migration report showing valid, malformed, duplicate-UID, missing-source, and unknown-progress records.
- [x] 4.3 Import current curriculum as immutable legacy version v1 and preserve the original checksum.
- [x] 4.4 Import learner summaries with `legacyLearnerId`, `legacy-import` XP adjustments, pending UID status, and unknown source fallback.
- [x] 4.5 Verify the migration does not fabricate historical learning events.
- [x] 4.6 Reconcile source counts, learner counts, XP totals, completion counts, and representative learner records.
- [x] 4.7 Document rollback and deletion of staging test imports.

## 5. Curriculum publishing

- [x] 5.1 Implement curriculum draft, review, schedule, publish, archive, and current-version pointer models.
- [x] 5.2 Implement the structured lesson and quiz editor with all required fields.
- [x] 5.3 Implement shared validation for title, objectives, content, media URL, four options, correct-answer bounds, explanations, prerequisites, and threshold.
- [x] 5.4 Implement desktop and mobile preview for locked, unlocked, failed, passed, empty, and error states.
- [x] 5.5 Implement dirty-draft protection for internal navigation, refresh, close, save failure, and incoming remote updates.
- [x] 5.6 Implement optimistic-concurrency detection with reload, compare, or save-as-new-draft actions.
- [x] 5.7 Implement immutable publish versions, version notes, checksum, publisher, and full comparison.
- [x] 5.8 Implement quiz-version policies and affected-learner preview before publishing.
- [x] 5.9 Implement rollback as a new published version without deleting history.
- [x] 5.10 Implement scheduled publishing, cancellation, final validation, and failure alert.
- [x] 5.11 Implement media health checks and the content-health queue.
- [x] 5.12 Add end-to-end tests for invalid publish, valid publish, conflict, rollback, schedule failure, and learner-current-version isolation.

## 6. Learner operations

- [x] 6.1 Implement paginated server-side learner directory with result count and URL-persisted filters.
- [x] 6.2 Implement search by nickname, learner ID, and authorized exact UID.
- [x] 6.3 Implement filters for UID status, source, dates, activity, lesson, completion, stuck state, tag, owner, and account status.
- [x] 6.4 Implement saved private and team views with configurable columns and sorting.
- [x] 6.5 Implement learner 360-degree detail with progress, event timeline, quiz attempts, XP ledger, streak, badges, notes, tags, status, and audit.
- [x] 6.6 Implement UID pending, verified, rejected, and needs-correction workflow with reason, actor, timestamp, and evidence reference.
- [x] 6.7 Implement learner correction workflow preserving old values and resetting corrected UID to pending.
- [x] 6.8 Implement notes, controlled tags, and follow-up owner.
- [x] 6.9 Implement active, paused, blocked, and deleted-pending-retention statuses with reason and access behavior.
- [x] 6.10 Implement bulk tag, owner assignment, status update, and export with preview and partial-failure report.
- [x] 6.11 Implement role-masked UTF-8 CSV exports with filter summary and audit.
- [x] 6.12 Add tests for exact UID permission, cross-page bulk selection, export masking, malformed learner row, and blocked learner writes.

## 7. Aggregations and metric definitions

- [x] 7.1 Publish the metric dictionary for registration, verification, activation, active, completion, stuck, advanced eligibility, retention, source, lesson, and question metrics.
- [x] 7.2 Implement daily metric aggregation with metric version, dimensions, `asOf`, and late-event handling.
- [x] 7.3 Implement registration, UID, activation, completion, and advanced funnel aggregation.
- [x] 7.4 Implement registration-week and registration-month cohort aggregation.
- [x] 7.5 Implement lesson and question aggregation for attempts, correctness, pass, time, and drop-off.
- [x] 7.6 Implement first-touch and latest-touch source attribution aggregation.
- [x] 7.7 Implement drill-down contracts that return paginated learner populations matching aggregate definitions.
- [x] 7.8 Add reconciliation tests proving KPI cards and drill-down populations have matching counts.
- [x] 7.9 Add stale, partial, error, and historical-tracking-start metadata to aggregates.

## 8. Detailed administration dashboard

- [x] 8.1 Implement global date, source, cohort, learner-state, course-stage, and UID-status filters with URL persistence and chips.
- [x] 8.2 Implement KPI cards for registered, pending UID, verified, activation, seven-day active, completion, stuck, and advanced eligible.
- [x] 8.3 Add numerator, denominator, prior-period comparison, definition, freshness, and drill-down to every KPI.
- [x] 8.4 Implement the recruitment-to-completion funnel with previous-stage and total conversion plus median time.
- [x] 8.5 Implement registration, verification, activation, active, and completion trend charts with day/week granularity.
- [x] 8.6 Implement registration-cohort activation, retention, and completion matrix.
- [x] 8.7 Implement source performance table with volume, verification, activation, completion, activity, and median-time metrics.
- [x] 8.8 Implement lesson performance table with starts, watch marks, attempts, first-pass, overall pass, attempts-to-pass, completion time, and drop-off.
- [x] 8.9 Implement operational queue cards for UID, correction, not activated, stuck, failed sync, invalid content, unpublished draft, and alerts.
- [x] 8.10 Implement loading, ready, empty, partial, stale, and error state for every dashboard component.
- [x] 8.11 Verify every learner-related card, stage, point, and row drills down to the identical filtered learner set.
- [x] 8.12 Add responsive and keyboard-accessible dashboard behavior at desktop, tablet, and mobile widths.
- [x] 8.13 Add visual regression and component tests for zero denominator, missing historical event tracking, stale aggregates, and permission masking.

## 9. Operations settings and health

- [x] 9.1 Implement versioned settings for XP, passing threshold, unlock, streak, stuck period, and activity windows.
- [x] 9.2 Implement affected-count preview and rollback for settings changes.
- [x] 9.3 Implement traffic source registry with code, name, owner, status, dates, and referral URL.
- [x] 9.4 Implement environment-scoped feature flags and learner maintenance mode.
- [x] 9.5 Implement alert rules for sync, stale metrics, media, schedules, XP, reconciliation, and UID queue age/count.
- [x] 9.6 Implement system health page for connectivity, authentication, ingestion, aggregation, jobs, media, backup, restore test, deployment, and incidents.
- [x] 9.7 Implement data-quality center for malformed records, unknown source/lesson, duplicate UID candidates, ledger mismatch, and migration failures.
- [x] 9.8 Add tests proving settings, flags, and alerts cannot cross environments or bypass role permissions.

## 10. Cutover and acceptance

- [ ] 10.1 Pilot the new admin in staging with owner, lead teacher, assistant, editor, and analyst test accounts.
- [x] 10.2 Run complete role-based acceptance using synthetic learner and UID data.
- [ ] 10.3 Compare old and new learner, progress, XP, UID, source, and course counts and document explained differences.
- [ ] 10.4 Verify staging backup restore and curriculum rollback before any production write is enabled.
- [ ] 10.5 Deploy production admin read-only and observe authentication, queries, freshness, and errors.
- [ ] 10.6 Enable UID workflow, notes/tags, curriculum publishing, and settings in separate reversible gates.
- [ ] 10.7 Verify an owner account, disable shared-PIN production writes, and confirm revocation.
- [ ] 10.8 Replace learner full-collection subscription and render-triggered write paths with the new contracts.
- [ ] 10.9 Run full regression, accessibility, performance, data reconciliation, and authorized security testing.
- [x] 10.10 Record final acceptance, remaining risks, rollback window, and post-launch monitoring ownership.

## 11. GitHub Pages demo consolidation

- [x] 11.1 Add a browser-only demonstration login and clearly label that it is not production authentication.
- [x] 11.2 Import all six legacy lessons and all eighteen legacy quiz questions into the new curriculum editor.
- [x] 11.3 Integrate learner search, UID review, learning status, internal notes, and UTF-8 CSV export into the new admin.
- [x] 11.4 Add a browser-local shared-PIN migration and disablement tool without treating it as production authorization.
- [x] 11.5 Add a platform-links page covering public pages, direct admin routes, repository, Actions, Pages settings, OpenSpec, and acceptance evidence.
- [x] 11.6 Add regression tests for demo authentication, legacy content, learner operations, settings migration, and link inventory.
- [x] 11.7 Document demo credentials, persistence limits, and the boundary between GitHub Pages and a real backend.
- [x] 11.8 Add a reproducible committed production bundle for the repository's legacy branch-based Pages source.
- [ ] 11.9 Replace browser-local demonstration state with named Firebase Authentication, Firestore, Security Rules, and trusted APIs before production use.
