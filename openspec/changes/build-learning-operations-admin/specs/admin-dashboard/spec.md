## ADDED Requirements

### Requirement: Dashboard global filters
The admin dashboard SHALL provide global filters for date range, traffic source, registration cohort, learner status, course stage, and UID verification status. Applied filters SHALL affect all compatible KPI cards, charts, funnels, queues, and exports, SHALL be visible as removable chips, and SHALL persist in the URL.

#### Scenario: Apply multiple filters
- **WHEN** an administrator selects the last 30 days, source `instagram-a`, and UID status `pending`
- **THEN** every compatible dashboard component updates to the same filtered population and the URL can reproduce that view

#### Scenario: Component does not support a filter
- **WHEN** a dashboard component cannot use one of the active global filters
- **THEN** the component clearly labels the ignored filter and does not silently display an incomparable number

### Requirement: Executive KPI summary
The dashboard SHALL show registered learners, pending UID verifications, verified learners, learning activation rate, seven-day active learners, beginner-course completion rate, stuck learners, and advanced-course eligible learners. Every KPI SHALL display its numerator, denominator where applicable, comparison with the previous equivalent period, data timestamp, and a definition tooltip.

#### Scenario: View activation rate
- **WHEN** 100 learners registered in the selected cohort and 62 generated a valid `lesson_started` event
- **THEN** the activation card displays `62%`, numerator `62`, denominator `100`, prior-period comparison, and the exact activation definition

#### Scenario: Zero denominator
- **WHEN** the selected filter produces zero eligible learners
- **THEN** rate cards display `—` and “沒有符合條件的母數” instead of `0%` or an arithmetic error

### Requirement: Recruitment-to-completion funnel
The dashboard SHALL show a funnel with referral landing, registration submitted, UID verified, first lesson started, first lesson passed, all beginner lessons completed, and advanced-course eligible stages. Each stage SHALL show count, conversion from the previous stage, total conversion from the first measurable stage, and median time to reach the stage.

#### Scenario: Drill into funnel loss
- **WHEN** an administrator clicks the “UID verified → first lesson started” loss segment
- **THEN** the system opens a filtered learner list containing verified learners who have not started a lesson

#### Scenario: Referral landing is unavailable
- **WHEN** historical records predate referral landing event tracking
- **THEN** the funnel starts at registration for that period and labels referral landing as “尚未追蹤”, without treating missing events as zero

### Requirement: Learning trend and cohort analysis
The dashboard SHALL provide daily or weekly trends for registrations, verified UIDs, activated learners, completions, and active learners. It SHALL also provide cohort retention and completion views grouped by registration week or month.

#### Scenario: Compare cohorts
- **WHEN** an administrator switches to weekly cohort view
- **THEN** each row represents a registration week and shows day-1 activation, day-7 activity, and beginner-course completion

### Requirement: Course performance overview
The dashboard SHALL show each lesson’s eligible learners, starts, video marks, quiz attempts, pass rate, first-attempt pass rate, average attempts to pass, median completion time, and drop-off to the next lesson.

#### Scenario: Identify a difficult lesson
- **WHEN** lesson 4 has the lowest first-attempt pass rate
- **THEN** the lesson table highlights it and clicking it opens lesson-level question and learner analysis

### Requirement: Operational work queues
The dashboard SHALL show actionable queues for pending UID verification, rejected UID needing correction, registered but not activated, stuck learners, failed data sync, content validation failures, unpublished draft changes, and unresolved system alerts. Each queue SHALL show count, oldest age, responsible role, and a direct action link.

#### Scenario: Open pending UID queue
- **WHEN** an administrator clicks the pending UID card
- **THEN** the system opens the learner work queue filtered to `uidStatus=pending`, oldest first

### Requirement: Source performance table
The dashboard SHALL compare each traffic source by registrations, UID verification rate, activation rate, completion rate, seven-day activity, median time to first lesson, and advanced eligibility. Unknown and direct traffic SHALL be explicit rows.

#### Scenario: Compare campaign quality
- **WHEN** source A has more registrations but source B has a higher completion rate
- **THEN** both volume and quality metrics remain visible so the administrator does not rank sources by registrations alone

### Requirement: Dashboard drill-down consistency
Every KPI card, funnel stage, chart point, course row, and source row that represents learners SHALL support drill-down to the same underlying learner population with the active filters preserved.

#### Scenario: Drill down from a chart point
- **WHEN** an administrator clicks the 12 completions shown for a specific day
- **THEN** the learner list contains exactly those 12 learners and displays the filter context

### Requirement: Dashboard data states
Each dashboard component SHALL distinguish loading, ready, empty, partial, stale, and error states. The system SHALL retain last-known successful data during a refresh error and label its timestamp.

#### Scenario: Aggregation service fails
- **WHEN** the latest KPI request fails after a previous successful load
- **THEN** the dashboard keeps the last-known values, marks them stale, shows the last update time, and provides retry

### Requirement: Dashboard role-aware visibility
Dashboard data SHALL be limited by the administrator’s role. Sensitive learner identifiers and UID verification details SHALL not be included in cards, drill-downs, or exports for roles without the corresponding permission.

#### Scenario: Analyst opens UID queue
- **WHEN** a read-only analyst without UID permission attempts to open a UID verification drill-down
- **THEN** the system denies access and does not expose UID values in client payloads
