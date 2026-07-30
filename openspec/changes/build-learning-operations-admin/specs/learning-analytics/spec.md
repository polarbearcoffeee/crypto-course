## ADDED Requirements

### Requirement: Canonical learning event model
The platform SHALL record immutable learning events with event ID, event type, learner ID, anonymous session ID, occurred-at server time, received-at time, course version, lesson ID, quiz version, source attribution, device class, and event-specific properties. Repeated submission of the same event ID SHALL be idempotent.

#### Scenario: Duplicate event retry
- **WHEN** the client retries an already accepted `quiz_submitted` event with the same event ID
- **THEN** the system stores one event and returns the existing result without double-counting XP or attempts

### Requirement: Required event types
The platform SHALL support `referral_landing`, `registration_submitted`, `uid_status_changed`, `lesson_started`, `video_marked_watched`, `quiz_started`, `quiz_submitted`, `lesson_completed`, `checkin_recorded`, `xp_awarded`, `badge_unlocked`, `beginner_course_completed`, and `advanced_eligible`.

#### Scenario: Complete first lesson
- **WHEN** a learner starts a lesson, marks a valid video watched, submits a passing quiz, and completes the lesson
- **THEN** the corresponding events appear once in chronological order with the same learner and course version

### Requirement: Metric definitions
The system SHALL maintain a data dictionary defining every dashboard metric’s event source, numerator, denominator, inclusion window, timezone, late-event policy, and refresh frequency.

#### Scenario: Open metric definition
- **WHEN** an administrator opens the completion-rate tooltip
- **THEN** it displays the exact cohort, numerator, denominator, timezone, and last refresh

### Requirement: Course and question analytics
The system SHALL calculate per lesson and per question starts, attempts, unique learners, first-attempt correctness, overall correctness, pass rate, median attempts, median completion time, and abandonment after attempt.

#### Scenario: Analyze weak question
- **WHEN** a question has a first-attempt correctness below the configured threshold
- **THEN** the analytics page flags it and allows drill-down by course version and source without revealing answers to unauthorized roles

### Requirement: Learner engagement state
The system SHALL calculate learner state `registered`, `activated`, `in-progress`, `stuck`, `completed`, or `inactive` from configurable rules while preserving raw events.

#### Scenario: Mark learner stuck
- **WHEN** a learner has started a lesson, has not completed it, and has no progress event for the configured stuck period
- **THEN** the learner becomes `stuck` and enters the operational queue

### Requirement: Source attribution
The platform SHALL store first-touch and latest-touch source values separately. Source SHALL persist from referral landing through registration and learning events, and unknown source SHALL remain explicit rather than being replaced with a guessed source.

#### Scenario: Returning learner from a new source
- **WHEN** a learner first registers from source A and later returns from source B
- **THEN** first-touch remains A, latest-touch becomes B, and reports can select either attribution model

### Requirement: Cohort and retention analysis
The system SHALL group learners by registration date, UID verification date, or first lesson date and calculate activity and completion at standard day offsets.

#### Scenario: View day-7 retention
- **WHEN** an administrator selects registration-week cohorts
- **THEN** day-7 retention uses learners with a valid activity event on the defined seventh-day window and displays cohort size

### Requirement: XP integrity
Every XP award SHALL reference a rule ID and source event, SHALL be awarded at most once for an idempotency key, and SHALL support compensating adjustments without deleting history.

#### Scenario: Duplicate watch action
- **WHEN** a learner repeatedly triggers the watched action for the same lesson and version
- **THEN** one watch XP award exists and subsequent actions award zero additional XP

### Requirement: Analytics freshness and reconciliation
The system SHALL expose event ingestion lag, aggregation freshness, failed event count, and reconciliation status. Daily reconciliation SHALL compare learner summaries with the event ledger and flag differences.

#### Scenario: Summary does not match event ledger
- **WHEN** a learner summary shows 300 XP but valid ledger entries total 250
- **THEN** the learner is flagged for reconciliation and dashboards identify affected metrics as partial

### Requirement: Historical metric stability
Published reports SHALL be reproducible from immutable events and versioned metric definitions. A metric-definition change SHALL not silently rewrite previously exported reports.

#### Scenario: Completion definition changes
- **WHEN** the completion definition changes from quiz-only to video-plus-quiz
- **THEN** the new definition receives a version and historical reports retain their original definition label
