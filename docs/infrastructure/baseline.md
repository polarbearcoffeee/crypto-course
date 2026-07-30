# Migration baseline

This document records the locally verifiable portion of OpenSpec task 1.1. It
does not prove that a remote backup exists and it does not contain credentials
or learner records.

## Repository baseline

| Field | Recorded value |
| --- | --- |
| Recorded on | 2026-07-30 (Asia/Taipei) |
| Current branch | `main` |
| Git commit | `b41d8d645723f8fc709bed22fd35b5e4466afa09` |
| Git tree | `02660b0581fc6af1f0a854701e398fae8d057538` |
| Working tree | Dirty; the admin/OpenSpec implementation is not represented by the commit above |
| Intended migration branch | `migration/learning-operations-admin` (not created by this documentation task) |

The commit and tree are the immutable committed baseline. Before a remote
migration begins, the migration owner must create the migration branch from the
reviewed implementation commit and rerun `scripts/record-baseline.ps1`.

## Current data identifiers

| Data area | Current source identifier | Version status | Backup identifier |
| --- | --- | --- | --- |
| Curriculum | Firestore document `ta_content/curriculum` | The legacy document has no explicit version ID | `PENDING_AUTHORIZED_EXPORT` |
| Curriculum fallback | `index.html::DEFAULT_MODULES` | Versioned only by the Git commit/tree above | Git commit and tree above |
| Settings | Firestore document `ta_settings/app` | The legacy document has no explicit version ID | `PENDING_AUTHORIZED_EXPORT` |
| Learners | Firestore collection `ta_students` | Individual documents have no migration snapshot ID | `PENDING_AUTHORIZED_EXPORT` |

`PENDING_AUTHORIZED_EXPORT` is deliberate. No Firebase credential was accessed
and no production learner data was read during this task. A backup is not
considered complete until the authorized export, manifest, storage and restore
checks below all exist.

## Backup and manifest method

1. An authorized owner exports curriculum, settings and learner data separately
   to an encrypted, access-controlled location outside this Git repository.
2. The learner export uses the approved minimum fields. Any staging copy must be
   redacted before it leaves the protected backup location.
3. For each artifact, record a logical identifier, UTC export time, byte size
   and SHA-256 hash. Do not put record contents, UID values, PIN values, tokens,
   service-account material or absolute storage paths in the manifest.
4. Generate a local manifest preview:

   ```powershell
   pwsh -File scripts/record-baseline.ps1 -DryRun `
     -CurriculumBackupIdentifier "<approved-id>" `
     -SettingsBackupIdentifier "<approved-id>" `
     -LearnerBackupIdentifier "<approved-id>"
   ```

5. After review, omit `-DryRun` to write the manifest to an approved path. A
   suggested logical ID format is:

   ```text
   <source-identifier>@<UTC timestamp>:sha256:<artifact hash>
   ```

6. A second authorized operator verifies the SHA-256 hashes and performs a
   restore into an isolated staging project. The manifest then records the
   restore evidence ID; production writes remain disabled until that check
   passes.

The manifest is metadata only. Actual backups and any manifest that exposes
operational storage details must not be committed.

## Completion gate

OpenSpec task 1.1 is only partially complete locally. It becomes complete when:

- the reviewed migration branch and implementation commit/tree are recorded;
- all three `PENDING_AUTHORIZED_EXPORT` values are replaced by real manifest
  identifiers;
- encrypted backup location, access owner and retention policy are recorded in
  the restricted runbook; and
- an isolated restore test has a successful evidence ID.
