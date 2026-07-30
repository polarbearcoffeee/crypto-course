# Production project decision

This document completes the decision portion of OpenSpec task 1.3.

## Decision

The shared Firebase project `airport-car` is retired as a production boundary
for crypto-course.

Crypto-course requires a dedicated production Firebase project. Development,
staging and production must use separate projects and separate data boundaries.
No new crypto-course production feature, administrator write path or learner
migration may target `airport-car`.

## Why

- `airport-car` is unrelated to the crypto-course product and does not provide a
  clear ownership or billing boundary.
- A dedicated project allows staging tests without access to production
  curriculum, settings, UID or learner collections.
- Named ownership, auditability, revocation and cost visibility are required
  before production administration can be enabled.

## Transition rule

`airport-car` may be used only as a read-only legacy source during an approved,
logged migration window. This exception requires:

1. a named migration operator and approver;
2. a verified backup manifest and isolated restore result;
3. least-privilege, time-limited access;
4. no staging or demo client access;
5. reconciliation of source and destination counts/hashes; and
6. revocation of migration access after acceptance.

After migration acceptance, the old crypto-course collections are retained or
removed only under the approved retention plan. This decision does not
authorize deletion.

## Required production ownership

| Responsibility | Required value | Current status |
| --- | --- | --- |
| Business owner | Named person accountable for learner operations | `TBD` |
| Technical owner | Named person accountable for Firebase and incidents | `TBD` |
| Security/recovery approver | Named person approving access and restore tests | `TBD` |
| Billing owner | Named person receiving budget and billing alerts | `TBD` |
| Firebase production project ID | Dedicated crypto-course project | `TBD` |
| Billing account and monthly budget | Approved account, budget and alert thresholds | `TBD` |
| Data region and retention | Approved region, retention and deletion policy | `TBD` |

## Production gate

Production provisioning and writes stay blocked until every `TBD` field has an
approved value, the environment boundary is tested, the owner account is
verified, and backup/restore evidence is recorded. No credentials or learner
data belong in this document.
