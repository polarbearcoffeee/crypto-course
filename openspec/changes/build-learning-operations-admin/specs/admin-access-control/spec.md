## ADDED Requirements

### Requirement: Named administrator authentication
Every administrator SHALL sign in with a named account through Firebase Authentication or an equivalent identity provider. Shared PIN access SHALL not grant production administration privileges after migration.

#### Scenario: Sign in as administrator
- **WHEN** an enabled administrator successfully authenticates
- **THEN** the system creates a bounded session and loads only capabilities permitted for that account

### Requirement: Administrative roles
The system SHALL provide at least `owner`, `lead-teacher`, `assistant`, `content-editor`, and `analyst` roles. Permissions SHALL be evaluated server-side or in Security Rules, not only by hiding UI.

#### Scenario: Analyst attempts content publish
- **WHEN** an analyst calls the publish operation directly
- **THEN** the request is denied even if the analyst bypasses the user interface

### Requirement: Permission matrix
The system SHALL separately control permissions for dashboard viewing, learner PII viewing, UID verification, learner editing, export, curriculum editing, curriculum publishing, rollback, settings, administrator management, and audit viewing.

#### Scenario: Assistant verifies UID
- **WHEN** an assistant has `uid.verify` but not `learner.export`
- **THEN** UID verification succeeds and data export remains unavailable

### Requirement: Administrator lifecycle
Owners SHALL be able to invite, activate, suspend, and revoke administrator accounts. Revocation SHALL invalidate active administrative sessions within a defined maximum delay.

#### Scenario: Revoke departed staff
- **WHEN** an owner revokes an administrator
- **THEN** new requests from that account are denied and the revocation is audited

### Requirement: Sensitive action confirmation
Publishing, rollback, bulk status change, UID correction, export containing UID, role change, and settings change SHALL require explicit confirmation and an optional or required reason based on risk.

#### Scenario: Export UID data
- **WHEN** an authorized user requests a UID-containing export
- **THEN** the system shows row count and fields, requires confirmation and reason, and records the export audit event

### Requirement: Immutable administrative audit log
The system SHALL record actor, action, target type, target ID, timestamp, reason, request ID, result, and before/after values for sensitive changes. Application roles SHALL not be able to edit or delete audit records.

#### Scenario: Review course rollback
- **WHEN** an owner opens the rollback audit entry
- **THEN** the entry identifies the publisher, restored version, replaced version, reason, timestamp, and result

### Requirement: Session security
Administrative sessions SHALL expire after inactivity, support explicit logout, and require re-authentication for owner-level security changes. Failed sign-in attempts and suspicious sessions SHALL be visible to owners.

#### Scenario: Inactive session expires
- **WHEN** an administrator exceeds the configured inactivity window
- **THEN** the next sensitive action requires a fresh sign-in and unsaved draft protection still applies

### Requirement: Shared PIN migration
The migration SHALL create at least one verified owner account before disabling shared PIN administration. A time-limited emergency fallback SHALL be documented, logged, and removable.

#### Scenario: Complete PIN migration
- **WHEN** the verified owner confirms account access
- **THEN** production PIN write privileges are disabled and all subsequent administration identifies a named actor

### Requirement: Least-data client payload
Administrative APIs and Firestore queries SHALL return only fields authorized for the current role. Field masking SHALL occur before data reaches an unauthorized client.

#### Scenario: Analyst loads learner list
- **WHEN** an analyst without PII permission opens the directory
- **THEN** UID and sensitive notes are absent from the response payload, not merely hidden with CSS
