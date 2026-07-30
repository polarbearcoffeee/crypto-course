import type { AdministrativeAuditInput } from "./adminAudit";
import type { Role } from "./permissions";

export type AuthEnvironment = "development" | "test" | "production";
export type AdministratorStatus =
  | "invited"
  | "active"
  | "suspended"
  | "revoked";

export type ProviderIdentity = Readonly<{
  subject: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}>;

export interface AdminIdentityProvider<Credential = unknown> {
  readonly providerName: string;
  authenticate(credential: Credential): Promise<ProviderIdentity>;
}

export type Administrator = Readonly<{
  administratorId: string;
  providerName: string;
  providerSubject: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  role: Role;
  status: AdministratorStatus;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminSession = Readonly<{
  sessionId: string;
  administratorId: string;
  createdAt: string;
  authenticatedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  invalidatedAt?: string;
  invalidationReason?: "logout" | "suspended" | "revoked";
}>;

export interface AdminAuditSink {
  record(input: AdministrativeAuditInput): unknown;
}

export type AdminAuthConfig = Readonly<{
  environment: AuthEnvironment;
  inactivityTimeoutMs: number;
  absoluteSessionTimeoutMs: number;
  sensitiveReauthenticationMs: number;
}>;

type LifecycleInput = Readonly<{
  actorSessionId: string;
  administratorId: string;
  requestId: string;
  reason: string;
}>;

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function asIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class NamedAdministratorAuth<Credential = unknown> {
  readonly #administrators = new Map<string, Administrator>();
  readonly #administratorIdBySubject = new Map<string, string>();
  readonly #sessions = new Map<string, AdminSession>();

  constructor(
    private readonly provider: AdminIdentityProvider<Credential>,
    private readonly audit: AdminAuditSink,
    private readonly config: AdminAuthConfig,
    private readonly now: () => number,
    private readonly createAdministratorId: () => string,
    private readonly createSessionId: () => string,
  ) {
    for (const [field, value] of Object.entries({
      inactivityTimeoutMs: config.inactivityTimeoutMs,
      absoluteSessionTimeoutMs: config.absoluteSessionTimeoutMs,
      sensitiveReauthenticationMs: config.sensitiveReauthenticationMs,
    })) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${field} must be a positive duration.`);
      }
    }
  }

  bootstrapDevelopmentOwner(identity: ProviderIdentity): Administrator {
    if (this.config.environment !== "development") {
      throw new Error("Owner bootstrap is only available in development.");
    }
    if (!identity.emailVerified) {
      throw new Error("Development owner email must be verified.");
    }
    if (this.#administrators.size > 0) {
      throw new Error("Development owner bootstrap can only run once.");
    }
    return this.#createAdministrator(identity, "owner", "active");
  }

  async signIn(credential: Credential): Promise<AdminSession> {
    const identity = await this.provider.authenticate(credential);
    if (!identity.emailVerified) throw new Error("Verified email is required.");
    const administratorId = this.#administratorIdBySubject.get(identity.subject);
    const administrator = administratorId
      ? this.#administrators.get(administratorId)
      : undefined;
    if (!administrator) throw new Error("Administrator account is not registered.");
    if (administrator.status !== "active") {
      throw new Error(`Administrator account is ${administrator.status}.`);
    }
    if (administrator.email.toLowerCase() !== identity.email.toLowerCase()) {
      throw new Error("Provider identity does not match the administrator account.");
    }

    const now = this.now();
    const session: AdminSession = {
      sessionId: requireText(this.createSessionId(), "Session ID"),
      administratorId: administrator.administratorId,
      createdAt: asIso(now),
      authenticatedAt: asIso(now),
      lastActiveAt: asIso(now),
      expiresAt: asIso(now + this.config.absoluteSessionTimeoutMs),
    };
    this.#sessions.set(session.sessionId, session);
    return clone(session);
  }

  assertSession(
    sessionId: string,
    options: Readonly<{ sensitive?: boolean }> = {},
  ): Administrator {
    const session = this.#sessions.get(sessionId);
    if (!session || session.invalidatedAt) throw new Error("Session is invalid.");
    const administrator = this.#administrators.get(session.administratorId);
    if (!administrator || administrator.status !== "active") {
      throw new Error("Administrator account is not active.");
    }

    const now = this.now();
    if (
      now >= Date.parse(session.expiresAt) ||
      now - Date.parse(session.lastActiveAt) >= this.config.inactivityTimeoutMs
    ) {
      throw new Error("Session has expired.");
    }
    if (
      options.sensitive &&
      now - Date.parse(session.authenticatedAt) >=
        this.config.sensitiveReauthenticationMs
    ) {
      throw new Error("Re-authentication is required.");
    }

    this.#sessions.set(sessionId, {
      ...session,
      lastActiveAt: asIso(now),
    });
    return clone(administrator);
  }

  async reauthenticate(
    sessionId: string,
    credential: Credential,
  ): Promise<AdminSession> {
    const administrator = this.assertSession(sessionId);
    const identity = await this.provider.authenticate(credential);
    if (
      !identity.emailVerified ||
      identity.subject !== administrator.providerSubject
    ) {
      throw new Error("Re-authentication identity does not match the session.");
    }
    const current = this.#sessions.get(sessionId);
    if (!current) throw new Error("Session is invalid.");
    const now = this.now();
    const refreshed: AdminSession = {
      ...current,
      authenticatedAt: asIso(now),
      lastActiveAt: asIso(now),
    };
    this.#sessions.set(sessionId, refreshed);
    return clone(refreshed);
  }

  logout(sessionId: string): void {
    this.#invalidateSession(sessionId, "logout");
  }

  inviteAdministrator(
    input: Readonly<{
      actorSessionId: string;
      identity: ProviderIdentity;
      role: Exclude<Role, "owner"> | "owner";
      requestId: string;
      reason: string;
    }>,
  ): Administrator {
    const actor = this.#assertOwner(input.actorSessionId);
    if (!input.identity.emailVerified) {
      throw new Error("Invited administrator email must be verified.");
    }
    if (this.#administratorIdBySubject.has(input.identity.subject)) {
      throw new Error("Provider identity is already registered.");
    }
    const administrator = this.#newAdministrator(
      input.identity,
      input.role,
      "invited",
    );
    this.audit.record({
      actorId: actor.administratorId,
      action: "administrator.invite",
      targetType: "administrator",
      targetId: administrator.administratorId,
      reason: requireText(input.reason, "Reason"),
      requestId: requireText(input.requestId, "Request ID"),
      result: "success",
      before: null,
      after: this.#auditState(administrator),
    });
    this.#saveAdministrator(administrator);
    return clone(administrator);
  }

  activateAdministrator(input: LifecycleInput): Administrator {
    return this.#transition(input, "active", ["invited"], "activate");
  }

  suspendAdministrator(input: LifecycleInput): Administrator {
    return this.#transition(input, "suspended", ["active"], "suspend");
  }

  revokeAdministrator(input: LifecycleInput): Administrator {
    return this.#transition(
      input,
      "revoked",
      ["invited", "active", "suspended"],
      "revoke",
    );
  }

  getAdministrator(administratorId: string): Administrator | undefined {
    const administrator = this.#administrators.get(administratorId);
    return administrator ? clone(administrator) : undefined;
  }

  getSession(sessionId: string): AdminSession | undefined {
    const session = this.#sessions.get(sessionId);
    return session ? clone(session) : undefined;
  }

  #assertOwner(sessionId: string): Administrator {
    const actor = this.assertSession(sessionId, { sensitive: true });
    if (actor.role !== "owner") {
      throw new Error("Only an owner can manage administrators.");
    }
    return actor;
  }

  #transition(
    input: LifecycleInput,
    nextStatus: AdministratorStatus,
    allowedStatuses: readonly AdministratorStatus[],
    action: string,
  ): Administrator {
    const actor = this.#assertOwner(input.actorSessionId);
    const current = this.#administrators.get(input.administratorId);
    if (!current) throw new Error("Administrator account was not found.");
    if (!allowedStatuses.includes(current.status)) {
      const pastTense = `${action}${action.endsWith("e") ? "d" : "ed"}`;
      throw new Error(
        `Administrator cannot be ${pastTense} from ${current.status}.`,
      );
    }
    if (current.administratorId === actor.administratorId) {
      throw new Error("Owners cannot change their own account lifecycle.");
    }

    const updated: Administrator = {
      ...current,
      status: nextStatus,
      updatedAt: asIso(this.now()),
    };
    this.audit.record({
      actorId: actor.administratorId,
      action: `administrator.${action}`,
      targetType: "administrator",
      targetId: current.administratorId,
      reason: requireText(input.reason, "Reason"),
      requestId: requireText(input.requestId, "Request ID"),
      result: "success",
      before: this.#auditState(current),
      after: this.#auditState(updated),
    });
    this.#saveAdministrator(updated);

    if (nextStatus === "suspended" || nextStatus === "revoked") {
      for (const session of this.#sessions.values()) {
        if (
          session.administratorId === current.administratorId &&
          !session.invalidatedAt
        ) {
          this.#invalidateSession(session.sessionId, nextStatus);
        }
      }
    }
    return clone(updated);
  }

  #createAdministrator(
    identity: ProviderIdentity,
    role: Role,
    status: AdministratorStatus,
  ): Administrator {
    const administrator = this.#newAdministrator(identity, role, status);
    this.#saveAdministrator(administrator);
    return clone(administrator);
  }

  #newAdministrator(
    identity: ProviderIdentity,
    role: Role,
    status: AdministratorStatus,
  ): Administrator {
    const now = asIso(this.now());
    return {
      administratorId: requireText(
        this.createAdministratorId(),
        "Administrator ID",
      ),
      providerName: requireText(this.provider.providerName, "Provider name"),
      providerSubject: requireText(identity.subject, "Provider subject"),
      email: requireText(identity.email, "Email").toLowerCase(),
      displayName: requireText(identity.displayName, "Display name"),
      emailVerified: identity.emailVerified,
      role,
      status,
      createdAt: now,
      updatedAt: now,
    };
  }

  #saveAdministrator(administrator: Administrator): void {
    this.#administrators.set(administrator.administratorId, administrator);
    this.#administratorIdBySubject.set(
      administrator.providerSubject,
      administrator.administratorId,
    );
  }

  #invalidateSession(
    sessionId: string,
    reason: NonNullable<AdminSession["invalidationReason"]>,
  ): void {
    const session = this.#sessions.get(sessionId);
    if (!session || session.invalidatedAt) return;
    this.#sessions.set(sessionId, {
      ...session,
      invalidatedAt: asIso(this.now()),
      invalidationReason: reason,
    });
  }

  #auditState(administrator: Administrator) {
    return {
      administratorId: administrator.administratorId,
      providerName: administrator.providerName,
      email: administrator.email,
      role: administrator.role,
      status: administrator.status,
    };
  }
}

export type SharedPinMigrationState = Readonly<{
  namedOwnerId?: string;
  ownerAccessVerifiedAt?: string;
  pinWritesEnabled: boolean;
  sharedPinSecretPresent: boolean;
  fallback?: Readonly<{ expiresAt: string; enabledBy: string }>;
  completedAt?: string;
}>;

type MigrationEvidence = Readonly<{
  actorId: string;
  reason: string;
  requestId: string;
}>;

/**
 * Enforces the safe sequence: named owner -> verified access -> disable writes
 * -> remove emergency fallback -> remove the shared secret.
 */
export class SharedPinMigration {
  #state: SharedPinMigrationState = {
    pinWritesEnabled: true,
    sharedPinSecretPresent: true,
  };

  constructor(
    private readonly audit: AdminAuditSink,
    private readonly now: () => number,
    private readonly maximumFallbackMs = 24 * 60 * 60 * 1000,
  ) {}

  getState(): SharedPinMigrationState {
    return clone(this.#state);
  }

  registerNamedOwner(
    owner: Administrator,
    evidence: MigrationEvidence,
  ): SharedPinMigrationState {
    if (
      owner.role !== "owner" ||
      owner.status !== "active" ||
      !owner.emailVerified
    ) {
      throw new Error("Migration requires an active verified named owner.");
    }
    return this.#change(
      evidence,
      "shared-pin.owner.register",
      { ...this.#state, namedOwnerId: owner.administratorId },
    );
  }

  confirmNamedOwnerAccess(
    ownerId: string,
    evidence: MigrationEvidence,
  ): SharedPinMigrationState {
    if (!this.#state.namedOwnerId || this.#state.namedOwnerId !== ownerId) {
      throw new Error("Registered named owner must confirm access.");
    }
    return this.#change(evidence, "shared-pin.owner.verify", {
      ...this.#state,
      ownerAccessVerifiedAt: asIso(this.now()),
    });
  }

  disablePinWrites(evidence: MigrationEvidence): SharedPinMigrationState {
    if (!this.#state.ownerAccessVerifiedAt) {
      throw new Error("Named owner access must be verified before disabling PIN writes.");
    }
    return this.#change(evidence, "shared-pin.write.disable", {
      ...this.#state,
      pinWritesEnabled: false,
    });
  }

  enableEmergencyFallback(
    expiresAt: string,
    evidence: MigrationEvidence,
  ): SharedPinMigrationState {
    const expiry = Date.parse(expiresAt);
    const now = this.now();
    if (this.#state.pinWritesEnabled) {
      throw new Error("Fallback is only available after normal PIN writes are disabled.");
    }
    if (
      !Number.isFinite(expiry) ||
      expiry <= now ||
      expiry - now > this.maximumFallbackMs
    ) {
      throw new Error("Emergency fallback must be time-limited.");
    }
    return this.#change(evidence, "shared-pin.fallback.enable", {
      ...this.#state,
      fallback: { expiresAt: asIso(expiry), enabledBy: evidence.actorId },
    });
  }

  removeEmergencyFallback(
    evidence: MigrationEvidence,
  ): SharedPinMigrationState {
    if (!this.#state.fallback) {
      throw new Error("Emergency fallback is not enabled.");
    }
    const { fallback: _fallback, ...withoutFallback } = this.#state;
    return this.#change(
      evidence,
      "shared-pin.fallback.remove",
      withoutFallback,
    );
  }

  removeSharedPinSecret(
    evidence: MigrationEvidence,
  ): SharedPinMigrationState {
    if (this.#state.pinWritesEnabled || !this.#state.ownerAccessVerifiedAt) {
      throw new Error("PIN writes must be disabled after owner verification.");
    }
    if (
      this.#state.fallback &&
      Date.parse(this.#state.fallback.expiresAt) > this.now()
    ) {
      throw new Error("Active emergency fallback must be removed first.");
    }
    return this.#change(evidence, "shared-pin.secret.remove", {
      ...this.#state,
      fallback: undefined,
      sharedPinSecretPresent: false,
      completedAt: asIso(this.now()),
    });
  }

  #change(
    evidence: MigrationEvidence,
    action: string,
    nextState: SharedPinMigrationState,
  ): SharedPinMigrationState {
    this.audit.record({
      actorId: requireText(evidence.actorId, "Actor ID"),
      action,
      targetType: "authentication-method",
      targetId: "shared-pin",
      reason: requireText(evidence.reason, "Reason"),
      requestId: requireText(evidence.requestId, "Request ID"),
      result: "success",
      before: this.#state,
      after: nextState,
    });
    this.#state = clone(nextState);
    return this.getState();
  }
}
