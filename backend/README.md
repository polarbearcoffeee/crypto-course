# Backend security boundary

This isolated package covers OpenSpec tasks 2.3, 2.6, and 2.7 without
connecting to a real Firebase project.

## What is enforced

- `firestore.indexes.json` defines operational queue and paginated-view indexes.
- `firestore.rules` separates UID/contact fields and private notes from public
  learner operations data.
- Published curriculum, export jobs, role changes, settings changes, audit
  logs, metrics, and current pointers are server-write-only.
- `src/trusted-boundary.ts` requires a named active administrator, agreement
  between token roles and the server profile, per-operation permission,
  confirmation, reason, and recent authentication for owner-level actions.
- Analyst export is allowed only through the trusted boundary and masks UID;
  private notes are never included.

## Local verification

The Firestore emulator is local-only and uses the synthetic project ID
`demo-crypto-course`.

```powershell
npm.cmd install
npm.cmd run test:all
```

The latest Firestore emulator requires Java 21 or newer.
