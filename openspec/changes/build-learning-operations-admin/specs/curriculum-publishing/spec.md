## ADDED Requirements

### Requirement: Curriculum lifecycle
Curriculum content SHALL move through `draft`, `in-review`, `scheduled`, `published`, and `archived` states. Learners SHALL only receive the current published version.

#### Scenario: Save draft
- **WHEN** an editor saves a draft
- **THEN** no learner-facing content changes and the draft records author and update time

#### Scenario: Publish approved version
- **WHEN** an authorized publisher publishes a valid reviewed version
- **THEN** it becomes the learner-facing version atomically and the previous published version remains recoverable

### Requirement: Structured lesson editor
The editor SHALL support lesson title, summary, estimated time, learning objectives, ordered content points, video URL, quiz questions, answer explanations, passing score, prerequisite, status, and version note.

#### Scenario: Edit lesson order
- **WHEN** an editor reorders lessons in a draft
- **THEN** prerequisites and affected learner progression are validated before publication

### Requirement: Curriculum validation
Publication SHALL be blocked unless every active lesson has a non-empty title, at least one learning objective, content, a valid allowed video URL when video is required, at least one valid quiz question, valid options, valid correct answers, answer explanations, and a passing threshold within range.

#### Scenario: Publish blank quiz question
- **WHEN** a draft contains an empty quiz question
- **THEN** publication is blocked and the editor scrolls to the exact invalid field

### Requirement: Preview
Editors SHALL be able to preview the complete learner experience at desktop and mobile sizes without publishing, including locked, unlocked, passed, failed, empty, and error states.

#### Scenario: Preview locked lesson
- **WHEN** an editor selects the locked state in preview
- **THEN** the page shows exactly how the prerequisite message will appear to a learner

### Requirement: Curriculum version history
Every published curriculum SHALL receive an immutable version ID and record publisher, publication time, version note, content checksum, and relation to the previous version. Administrators SHALL be able to compare two versions.

#### Scenario: Compare versions
- **WHEN** an administrator compares v3 and v4
- **THEN** the system highlights added, removed, reordered, and changed lessons, questions, answers, thresholds, and video URLs

### Requirement: Rollback
Authorized publishers SHALL be able to restore a previous published version as a new version after confirmation. Rollback SHALL not delete later history.

#### Scenario: Restore previous version
- **WHEN** a publisher restores v3 while v5 is live
- **THEN** the system creates v6 with v3 content, preserves v4 and v5 history, and records the rollback reason

### Requirement: Quiz version policy
Each lesson quiz SHALL have a version. A published quiz change SHALL require the publisher to select one progress policy: preserve previous pass, require only not-yet-completed learners to use the new version, or require all learners to retake. The choice SHALL be shown before publication and audited.

#### Scenario: Require all learners to retake
- **WHEN** a major safety question update is published with `retake-all`
- **THEN** existing passes remain in history but no longer satisfy current completion until the new quiz version is passed

### Requirement: Concurrent editing protection
The curriculum editor SHALL detect that the base draft changed since it was opened. It SHALL not silently overwrite a newer draft and SHALL offer reload, compare, or save as a separate draft.

#### Scenario: Two editors save same draft
- **WHEN** editor B saves after editor A has already changed the draft
- **THEN** editor B receives a conflict screen and A’s changes remain intact

### Requirement: Scheduled publishing
Authorized publishers SHALL be able to schedule a validated version for a future timezone-aware date and cancel it before execution. Failed scheduled publication SHALL create an alert and leave the current published version unchanged.

#### Scenario: Scheduled publication fails
- **WHEN** a scheduled version fails final validation
- **THEN** the current version stays live and responsible administrators receive an actionable alert

### Requirement: Media health
The system SHALL periodically validate referenced course media and show unavailable or invalid videos in a content-health queue without exposing learner data.

#### Scenario: Video becomes unavailable
- **WHEN** a published video fails health checks
- **THEN** the lesson is flagged, the content owner is alerted, and administrators can identify affected learners and lesson traffic
