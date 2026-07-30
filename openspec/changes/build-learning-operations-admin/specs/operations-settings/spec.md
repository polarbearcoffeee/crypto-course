## ADDED Requirements

### Requirement: Versioned learning rules
Authorized administrators SHALL configure XP awards, passing threshold defaults, unlock requirements, streak milestones, stuck-day threshold, and activity windows through versioned settings. A rule change SHALL show affected behavior before activation.

#### Scenario: Change stuck threshold
- **WHEN** an owner changes the stuck threshold from seven to five days
- **THEN** the system previews the newly affected learner count, records a new settings version, and recalculates queues after confirmation

### Requirement: Traffic source registry
The system SHALL maintain a registry of source codes, display names, campaign owner, status, start/end dates, and destination URL. Unknown historical source codes SHALL remain reportable.

#### Scenario: Disable campaign source
- **WHEN** an administrator disables a source
- **THEN** existing attribution remains intact and new referral links for that source are no longer generated

### Requirement: Feature flags and maintenance mode
Owners SHALL be able to enable or disable learner and admin capabilities by environment. Maintenance mode SHALL preserve administrator access and display a configured learner message.

#### Scenario: Disable check-in
- **WHEN** an owner disables the check-in feature
- **THEN** learners cannot record check-ins, the UI explains the temporary state, and existing streak history is preserved

### Requirement: Alert rules
Administrators SHALL configure thresholds and recipients for failed sync, stale dashboard data, content media failure, scheduled publish failure, abnormal XP, reconciliation mismatch, and growing pending UID queues.

#### Scenario: Pending UID queue exceeds threshold
- **WHEN** pending UID count or oldest age exceeds the configured rule
- **THEN** an alert is created once per alert window with a direct link to the filtered queue

### Requirement: System health page
The admin system SHALL show Firebase connectivity, authentication, event ingestion, aggregation freshness, scheduled jobs, media checks, latest backup, latest restore test, deployment version, and active incidents.

#### Scenario: Aggregation becomes stale
- **WHEN** dashboard aggregates exceed the freshness threshold
- **THEN** health status becomes degraded and affected dashboard metrics display stale state

### Requirement: Data quality center
The system SHALL list malformed learner records, missing source, unknown lesson IDs, duplicate UID candidates, summary-ledger mismatch, and failed migrations. Each issue SHALL show count, sample, first detected time, and resolution status.

#### Scenario: Duplicate UID candidates
- **WHEN** two learners submit the same normalized UID
- **THEN** the data-quality center creates a review item without automatically merging accounts

### Requirement: Configuration audit and rollback
Every settings change SHALL create an immutable version with actor, reason, before/after values, and activation time. Owners SHALL be able to restore a previous valid configuration as a new version.

#### Scenario: Roll back XP rule
- **WHEN** an owner restores the prior XP configuration
- **THEN** a new settings version is activated, past ledger entries are unchanged, and future awards use the restored rule

### Requirement: Environment separation
The platform SHALL distinguish development, test, staging, and production configuration. Test actions SHALL not write production learner, curriculum, UID, or audit data.

#### Scenario: Run staging test
- **WHEN** a tester publishes a staging curriculum
- **THEN** only staging learners and staging dashboards are affected
