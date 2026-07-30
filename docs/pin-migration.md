# Shared PIN migration runbook

This runbook removes shared-PIN administration without leaving the platform
without an owner. It applies to development validation first and to production
only after the identity provider, audit storage, and authorization rules are
deployed.

## Required evidence

Every step must create an immutable audit event containing the named actor,
action, target, timestamp, reason, request ID, result, and before/after values.
Do not place the PIN, provider credential, session token, or recovery secret in
an audit event, ticket, screenshot, or source file.

## Migration sequence

1. Configure the named identity provider and verify its issuer, audience,
   callback URL, and administrator email-verification policy.
2. In development only, bootstrap one named `owner`. Confirm that production
   rejects the bootstrap operation.
3. Sign in as that owner, sign out, and sign in again. Confirm the session has
   inactivity and absolute expiry limits.
4. Register the verified owner in the PIN migration state and record the
   `shared-pin.owner.register` audit event.
5. Confirm owner access through a real named session and record
   `shared-pin.owner.verify`.
6. Disable ordinary shared-PIN write privileges. Keep PIN reads disabled unless
   a separately approved diagnostic requires them. Record
   `shared-pin.write.disable`.
7. Verify that:
   - a shared PIN cannot perform an administrative write;
   - the named owner can invite, activate, suspend, and revoke a test account;
   - suspension and revocation invalidate active sessions;
   - owner-level changes require recent re-authentication;
   - each change has an immutable audit event.
8. If a rollback window is required, enable the emergency fallback for no more
   than 24 hours. Record its expiry and owner in
   `shared-pin.fallback.enable`. Never extend it silently.
9. After the observation window, remove the fallback and record
   `shared-pin.fallback.remove`.
10. Remove the shared PIN secret from runtime configuration and the secret
    manager, then redeploy. Record `shared-pin.secret.remove`.
11. Search the current deployment configuration for the old PIN setting name,
    without printing secret values. The search must return no active reference.
12. Perform a final named-owner sign-in and a denied shared-PIN write test.

## Emergency fallback

The fallback is only for restoring named-account administration during the
approved migration window. It must:

- start only after ordinary PIN writes are disabled;
- expire automatically within 24 hours;
- identify the named owner who enabled and used it;
- generate immutable audit events;
- never expose or restore the old PIN in client-side code;
- be removed before the shared secret is deleted.

If named authentication fails, stop administrative changes, record the incident,
and use the approved fallback only while it is unexpired. Fix the identity
provider or authorization configuration, verify named access again, and remove
the fallback. Do not re-enable permanent shared-PIN administration.

## Acceptance checklist

- At least one active, email-verified named owner exists.
- Named owner sign-in, logout, inactivity expiry, and re-authentication pass.
- Suspended and revoked administrators cannot reuse existing sessions.
- Shared-PIN writes are denied.
- Emergency fallback is absent or expired.
- The shared PIN secret is absent from active runtime configuration.
- Audit storage contains the complete ordered migration trail.
- No credential or secret value appears in audit payloads or source control.
