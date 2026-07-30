## ADDED Requirements

### Requirement: Learner directory
The admin system SHALL provide a paginated learner directory with server-side search, filters, sorting, saved views, visible result count, and configurable columns. Search SHALL support nickname, learner ID, and exact UID; filters SHALL include UID status, source, registration date, last active date, current lesson, completion status, stuck status, tag, and account status.

#### Scenario: Search exact UID
- **WHEN** an authorized administrator searches an exact UID
- **THEN** the matching learner appears without downloading unrelated learner records

#### Scenario: No search result
- **WHEN** no learner matches the filters
- **THEN** the page shows an empty-state explanation, active filters, and a one-click filter reset

### Requirement: Learner 360-degree detail
The learner detail page SHALL show identity summary, UID verification, source attribution, learning progress, lesson timeline, quiz attempts, XP ledger, streak, badges, last activity, notes, tags, status history, and administrative audit history.

#### Scenario: Review a stuck learner
- **WHEN** an administrator opens a learner flagged as stuck
- **THEN** the page shows the current lesson, last learning event, days inactive, quiz attempts, and recommended next administrative action

### Requirement: UID verification workflow
Each learner SHALL have UID status `pending`, `verified`, `rejected`, or `needs-correction`. The system SHALL record verified UID, rejection or correction reason, verifier, verification timestamp, and source evidence reference. Only authorized roles SHALL change this status.

#### Scenario: Verify a UID
- **WHEN** an authorized administrator confirms a pending UID
- **THEN** status becomes `verified`, verifier and timestamp are recorded, the learner leaves the pending queue, and an audit entry is created

#### Scenario: Reject with reason
- **WHEN** an administrator rejects a UID without entering a reason
- **THEN** the system blocks the action and requests a reason

### Requirement: Learner data correction
Authorized administrators SHALL be able to correct nickname, UID, traffic source, and selected operational fields. The system SHALL require a reason for UID or source changes, SHALL preserve old and new values, and SHALL never silently overwrite learning history.

#### Scenario: Correct a mistyped UID
- **WHEN** an authorized administrator changes a learner UID and provides a correction reason
- **THEN** the new UID is saved as pending verification, the previous UID remains in history, and the change is audited

### Requirement: Notes and tags
Administrators SHALL be able to add timestamped internal notes and controlled tags to a learner. Notes SHALL identify the author and SHALL not be visible to learners unless explicitly marked as learner-visible in a future capability.

#### Scenario: Add follow-up note
- **WHEN** a teacher records “已提醒完成第 2 課”
- **THEN** the note appears chronologically with author and timestamp and is searchable by authorized staff

### Requirement: Learner lifecycle status
The system SHALL support learner status `active`, `paused`, `blocked`, and `deleted-pending-retention`. Status changes SHALL require a reason, SHALL affect access according to policy, and SHALL be auditable.

#### Scenario: Block abusive learner
- **WHEN** an owner or lead teacher blocks a learner with a reason
- **THEN** the learner can no longer write learning progress, the status is visible in admin, and the change is recorded

### Requirement: Bulk operations
Authorized administrators SHALL be able to select learners across pages and apply approved bulk actions: add tag, assign follow-up owner, export, and update operational status. Destructive or sensitive bulk actions SHALL require a preview and confirmation.

#### Scenario: Bulk tag stuck learners
- **WHEN** an administrator selects all filtered stuck learners and applies tag `本週追蹤`
- **THEN** the system previews the affected count, applies the tag once per learner, and reports successes and failures

### Requirement: Learner export
The system SHALL export the current filtered result as UTF-8 CSV with an export timestamp, filter summary, stable column headers, and role-based field masking. Large exports SHALL run asynchronously and provide status.

#### Scenario: Export pending UID list
- **WHEN** an authorized teacher exports the pending UID saved view
- **THEN** the CSV contains only matching learners and includes learner ID, nickname, UID, source, registration time, and current status

### Requirement: Saved views and ownership
Administrators SHALL be able to save commonly used filter and column configurations as private or role-shared views. Shared views SHALL record owner and last update.

#### Scenario: Save daily verification view
- **WHEN** a lead teacher saves `待核對 UID－最舊優先` as a team view
- **THEN** authorized team members can open the same filters, columns, and sort order

### Requirement: Learner data error states
The learner directory and detail page SHALL distinguish missing data, permission denial, stale data, invalid date, and query failure. Invalid records SHALL remain inspectable without breaking the full list.

#### Scenario: One learner has malformed progress
- **WHEN** a learner record contains an unknown lesson ID
- **THEN** the row remains visible with a data-quality warning and other learners continue loading
