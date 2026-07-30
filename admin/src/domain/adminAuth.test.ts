import { describe, expect, it } from "vitest";

import { ImmutableAdminAuditLog } from "./adminAudit";
import {
  NamedAdministratorAuth,
  SharedPinMigration,
  type AdminIdentityProvider,
  type ProviderIdentity,
} from "./adminAuth";

const ownerIdentity: ProviderIdentity = {
  subject: "provider-owner",
  email: "owner@example.com",
  displayName: "Course Owner",
  emailVerified: true,
};

const assistantIdentity: ProviderIdentity = {
  subject: "provider-assistant",
  email: "assistant@example.com",
  displayName: "Course Assistant",
  emailVerified: true,
};

function createHarness(environment: "development" | "production" = "development") {
  let now = Date.parse("2026-07-30T08:00:00.000Z");
  let administratorSequence = 0;
  let sessionSequence = 0;
  let auditSequence = 0;
  const identities = new Map<string, ProviderIdentity>([
    ["owner-credential", ownerIdentity],
    ["assistant-credential", assistantIdentity],
  ]);
  const provider: AdminIdentityProvider<string> = {
    providerName: "test-oidc",
    async authenticate(credential) {
      const identity = identities.get(credential);
      if (!identity) throw new Error("Invalid provider credential.");
      return identity;
    },
  };
  const audit = new ImmutableAdminAuditLog(
    () => new Date(now).toISOString(),
    () => `audit-${++auditSequence}`,
  );
  const auth = new NamedAdministratorAuth(
    provider,
    audit,
    {
      environment,
      inactivityTimeoutMs: 15 * 60 * 1000,
      absoluteSessionTimeoutMs: 8 * 60 * 60 * 1000,
      sensitiveReauthenticationMs: 5 * 60 * 1000,
    },
    () => now,
    () => `admin-${++administratorSequence}`,
    () => `session-${++sessionSequence}`,
  );
  return {
    auth,
    audit,
    advance(milliseconds: number) {
      now += milliseconds;
    },
    now: () => now,
  };
}

async function activeOwnerHarness() {
  const harness = createHarness();
  const owner = harness.auth.bootstrapDevelopmentOwner(ownerIdentity);
  const ownerSession = await harness.auth.signIn("owner-credential");
  return { ...harness, owner, ownerSession };
}

async function createActiveAssistant() {
  const harness = await activeOwnerHarness();
  const invited = harness.auth.inviteAdministrator({
    actorSessionId: harness.ownerSession.sessionId,
    identity: assistantIdentity,
    role: "assistant",
    requestId: "invite-assistant",
    reason: "Support learner UID reviews",
  });
  const active = harness.auth.activateAdministrator({
    actorSessionId: harness.ownerSession.sessionId,
    administratorId: invited.administratorId,
    requestId: "activate-assistant",
    reason: "Invitation accepted",
  });
  return { ...harness, assistant: active };
}

describe("named administrator authentication", () => {
  it("bootstraps exactly one verified owner in development", () => {
    const { auth } = createHarness();
    expect(auth.bootstrapDevelopmentOwner(ownerIdentity)).toMatchObject({
      providerName: "test-oidc",
      providerSubject: "provider-owner",
      email: "owner@example.com",
      role: "owner",
      status: "active",
    });
    expect(() => auth.bootstrapDevelopmentOwner(ownerIdentity)).toThrow(
      "only run once",
    );
  });

  it("does not expose development owner bootstrap in production", () => {
    const { auth } = createHarness("production");
    expect(() => auth.bootstrapDevelopmentOwner(ownerIdentity)).toThrow(
      "only available in development",
    );
  });

  it("signs in only a registered, verified, active named identity", async () => {
    const { auth } = createHarness();
    auth.bootstrapDevelopmentOwner(ownerIdentity);
    await expect(auth.signIn("owner-credential")).resolves.toMatchObject({
      administratorId: "admin-1",
    });
    await expect(auth.signIn("assistant-credential")).rejects.toThrow(
      "not registered",
    );
  });
});

describe("administrator lifecycle", () => {
  it("invites and activates a named administrator with immutable audits", async () => {
    const { assistant, audit } = await createActiveAssistant();
    expect(assistant.status).toBe("active");
    expect(audit.list().map((event) => event.action)).toEqual([
      "administrator.invite",
      "administrator.activate",
    ]);
    expect(audit.list()[1]).toMatchObject({
      actorId: "admin-1",
      targetId: assistant.administratorId,
      before: { status: "invited" },
      after: { status: "active" },
      reason: "Invitation accepted",
      requestId: "activate-assistant",
      result: "success",
    });
  });

  it("suspends an account and invalidates its active sessions immediately", async () => {
    const harness = await createActiveAssistant();
    const assistantSession = await harness.auth.signIn("assistant-credential");

    harness.auth.suspendAdministrator({
      actorSessionId: harness.ownerSession.sessionId,
      administratorId: harness.assistant.administratorId,
      requestId: "suspend-assistant",
      reason: "Temporary leave",
    });

    expect(() =>
      harness.auth.assertSession(assistantSession.sessionId),
    ).toThrow("invalid");
    expect(harness.auth.getSession(assistantSession.sessionId)).toMatchObject({
      invalidationReason: "suspended",
    });
    await expect(harness.auth.signIn("assistant-credential")).rejects.toThrow(
      "suspended",
    );
  });

  it("revokes a suspended account permanently and audits before/after values", async () => {
    const harness = await createActiveAssistant();
    harness.auth.suspendAdministrator({
      actorSessionId: harness.ownerSession.sessionId,
      administratorId: harness.assistant.administratorId,
      requestId: "suspend-before-revoke",
      reason: "Investigate access",
    });
    const revoked = harness.auth.revokeAdministrator({
      actorSessionId: harness.ownerSession.sessionId,
      administratorId: harness.assistant.administratorId,
      requestId: "revoke-assistant",
      reason: "Staff departure",
    });

    expect(revoked.status).toBe("revoked");
    expect(harness.audit.findByRequestId("revoke-assistant")).toMatchObject({
      action: "administrator.revoke",
      before: { status: "suspended" },
      after: { status: "revoked" },
      result: "success",
    });
    await expect(harness.auth.signIn("assistant-credential")).rejects.toThrow(
      "revoked",
    );
  });

  it("prevents non-owners and owners acting on their own lifecycle", async () => {
    const harness = await createActiveAssistant();
    const assistantSession = await harness.auth.signIn("assistant-credential");
    expect(() =>
      harness.auth.suspendAdministrator({
        actorSessionId: assistantSession.sessionId,
        administratorId: harness.owner.administratorId,
        requestId: "unauthorized-suspend",
        reason: "Not permitted",
      }),
    ).toThrow("Only an owner");
    expect(() =>
      harness.auth.revokeAdministrator({
        actorSessionId: harness.ownerSession.sessionId,
        administratorId: harness.owner.administratorId,
        requestId: "self-revoke",
        reason: "Mistake",
      }),
    ).toThrow("own account");
  });
});

describe("bounded sessions and re-authentication", () => {
  it("expires a session after the inactivity window", async () => {
    const harness = await activeOwnerHarness();
    harness.advance(15 * 60 * 1000);
    expect(() =>
      harness.auth.assertSession(harness.ownerSession.sessionId),
    ).toThrow("expired");
  });

  it("expires a session at the absolute limit despite recent activity", async () => {
    const harness = await activeOwnerHarness();
    for (let count = 0; count < 34; count += 1) {
      harness.advance(14 * 60 * 1000);
      harness.auth.assertSession(harness.ownerSession.sessionId);
    }
    harness.advance(4 * 60 * 1000);
    expect(() =>
      harness.auth.assertSession(harness.ownerSession.sessionId),
    ).toThrow("expired");
  });

  it("requires and accepts fresh provider authentication for sensitive actions", async () => {
    const harness = await activeOwnerHarness();
    harness.advance(5 * 60 * 1000);
    expect(() =>
      harness.auth.assertSession(harness.ownerSession.sessionId, {
        sensitive: true,
      }),
    ).toThrow("Re-authentication");

    await harness.auth.reauthenticate(
      harness.ownerSession.sessionId,
      "owner-credential",
    );
    expect(
      harness.auth.assertSession(harness.ownerSession.sessionId, {
        sensitive: true,
      }).role,
    ).toBe("owner");
  });

  it("rejects re-authentication with another administrator identity", async () => {
    const harness = await createActiveAssistant();
    await expect(
      harness.auth.reauthenticate(
        harness.ownerSession.sessionId,
        "assistant-credential",
      ),
    ).rejects.toThrow("does not match");
  });

  it("supports explicit logout", async () => {
    const harness = await activeOwnerHarness();
    harness.auth.logout(harness.ownerSession.sessionId);
    expect(() =>
      harness.auth.assertSession(harness.ownerSession.sessionId),
    ).toThrow("invalid");
  });
});

describe("shared PIN migration and removal", () => {
  it("enforces owner creation and access verification before disabling PIN writes", async () => {
    const harness = await activeOwnerHarness();
    const migration = new SharedPinMigration(
      harness.audit,
      harness.now,
    );
    expect(() =>
      migration.disablePinWrites({
        actorId: harness.owner.administratorId,
        reason: "Start migration",
        requestId: "pin-too-early",
      }),
    ).toThrow("must be verified");

    migration.registerNamedOwner(harness.owner, {
      actorId: harness.owner.administratorId,
      reason: "Register named owner",
      requestId: "pin-owner-register",
    });
    expect(() =>
      migration.disablePinWrites({
        actorId: harness.owner.administratorId,
        reason: "Disable PIN",
        requestId: "pin-before-access",
      }),
    ).toThrow("must be verified");

    migration.confirmNamedOwnerAccess(harness.owner.administratorId, {
      actorId: harness.owner.administratorId,
      reason: "Named sign-in confirmed",
      requestId: "pin-owner-confirm",
    });
    expect(
      migration.disablePinWrites({
        actorId: harness.owner.administratorId,
        reason: "Named administration is working",
        requestId: "pin-disable-write",
      }).pinWritesEnabled,
    ).toBe(false);
  });

  it("documents every transition and removes fallback before the shared secret", async () => {
    const harness = await activeOwnerHarness();
    const migration = new SharedPinMigration(harness.audit, harness.now);
    const evidence = (
      requestId: string,
      reason: string,
    ) => ({
      actorId: harness.owner.administratorId,
      requestId,
      reason,
    });

    migration.registerNamedOwner(
      harness.owner,
      evidence("pin-owner", "Register named owner"),
    );
    migration.confirmNamedOwnerAccess(
      harness.owner.administratorId,
      evidence("pin-verify", "Owner completed named sign-in"),
    );
    migration.disablePinWrites(
      evidence("pin-disable", "Stop ordinary shared PIN administration"),
    );
    migration.enableEmergencyFallback(
      new Date(harness.now() + 60 * 60 * 1000).toISOString(),
      evidence("pin-fallback", "One-hour rollback safety window"),
    );
    expect(() =>
      migration.removeSharedPinSecret(
        evidence("pin-remove-too-early", "Remove legacy secret"),
      ),
    ).toThrow("fallback must be removed");

    migration.removeEmergencyFallback(
      evidence("pin-fallback-remove", "Named access verified stable"),
    );
    const completed = migration.removeSharedPinSecret(
      evidence("pin-secret-remove", "Migration accepted"),
    );

    expect(completed).toMatchObject({
      pinWritesEnabled: false,
      sharedPinSecretPresent: false,
    });
    expect(completed.completedAt).toBeDefined();
    expect(harness.audit.list().slice(-5).map((event) => event.action)).toEqual([
      "shared-pin.owner.register",
      "shared-pin.owner.verify",
      "shared-pin.write.disable",
      "shared-pin.fallback.enable",
      "shared-pin.fallback.remove",
      "shared-pin.secret.remove",
    ].slice(-5));
  });

  it("rejects an unlimited emergency fallback", async () => {
    const harness = await activeOwnerHarness();
    const migration = new SharedPinMigration(harness.audit, harness.now);
    const evidence = (requestId: string) => ({
      actorId: harness.owner.administratorId,
      requestId,
      reason: "Migration test",
    });
    migration.registerNamedOwner(harness.owner, evidence("owner"));
    migration.confirmNamedOwnerAccess(
      harness.owner.administratorId,
      evidence("verify"),
    );
    migration.disablePinWrites(evidence("disable"));

    expect(() =>
      migration.enableEmergencyFallback(
        new Date(harness.now() + 25 * 60 * 60 * 1000).toISOString(),
        evidence("fallback-too-long"),
      ),
    ).toThrow("time-limited");
  });
});
