export const roles = [
  "owner",
  "lead-teacher",
  "assistant",
  "content-editor",
  "analyst",
] as const;

export type Role = (typeof roles)[number];

export const trustedOperations = [
  "curriculum.publish",
  "learner.export",
  "administrator.changeRoles",
  "settings.edit",
] as const;

export type TrustedOperation = (typeof trustedOperations)[number];

export type ActiveAdminRecord = {
  status: "invited" | "active" | "suspended" | "revoked";
  roles: Role[];
};

export type TrustedAuthContext = {
  uid: string;
  tokenRoles: Role[];
  authTimeSeconds: number;
};

export type AuthorizationRequest = {
  operation: TrustedOperation;
  auth: TrustedAuthContext | null;
  admin: ActiveAdminRecord | null;
  nowSeconds: number;
  confirmed: boolean;
  reason?: string;
};

export type AuthorizationGrant = {
  actorId: string;
  operation: TrustedOperation;
  effectiveRoles: Role[];
};

export class AuthorizationError extends Error {
  readonly code:
    | "unauthenticated"
    | "inactive-admin"
    | "permission-denied"
    | "confirmation-required"
    | "reason-required"
    | "reauthentication-required";

  constructor(code: AuthorizationError["code"], message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

const allowedRoles: Readonly<Record<TrustedOperation, readonly Role[]>> = {
  "curriculum.publish": ["owner", "lead-teacher"],
  "learner.export": ["owner", "lead-teacher", "analyst"],
  "administrator.changeRoles": ["owner"],
  "settings.edit": ["owner"],
};

const reasonRequired = new Set<TrustedOperation>([
  "curriculum.publish",
  "learner.export",
  "administrator.changeRoles",
  "settings.edit",
]);

const freshAuthenticationRequired = new Set<TrustedOperation>([
  "administrator.changeRoles",
  "settings.edit",
]);

const MAX_SENSITIVE_AUTH_AGE_SECONDS = 5 * 60;

export function authorizeTrustedOperation(
  request: AuthorizationRequest,
): AuthorizationGrant {
  if (!request.auth) {
    throw new AuthorizationError(
      "unauthenticated",
      "A named administrator session is required.",
    );
  }

  if (!request.admin || request.admin.status !== "active") {
    throw new AuthorizationError(
      "inactive-admin",
      "The administrator profile is not active.",
    );
  }

  // Both sources must agree. This prevents a stale custom claim from retaining
  // a role removed from the server-owned administrator profile.
  const effectiveRoles = request.auth.tokenRoles.filter((role) =>
    request.admin?.roles.includes(role),
  );
  const permitted = effectiveRoles.some((role) =>
    allowedRoles[request.operation].includes(role),
  );

  if (!permitted) {
    throw new AuthorizationError(
      "permission-denied",
      `The administrator cannot perform ${request.operation}.`,
    );
  }

  if (!request.confirmed) {
    throw new AuthorizationError(
      "confirmation-required",
      "The sensitive operation requires explicit confirmation.",
    );
  }

  if (
    reasonRequired.has(request.operation) &&
    (!request.reason || request.reason.trim().length < 3)
  ) {
    throw new AuthorizationError(
      "reason-required",
      "The sensitive operation requires a meaningful reason.",
    );
  }

  if (
    freshAuthenticationRequired.has(request.operation) &&
    request.nowSeconds - request.auth.authTimeSeconds >
      MAX_SENSITIVE_AUTH_AGE_SECONDS
  ) {
    throw new AuthorizationError(
      "reauthentication-required",
      "A fresh sign-in is required for this owner-level operation.",
    );
  }

  return {
    actorId: request.auth.uid,
    operation: request.operation,
    effectiveRoles,
  };
}

export type LearnerExportRow = {
  learnerId: string;
  nickname: string;
  uid?: string;
  privateNote?: string;
};

export type SafeLearnerExportRow = {
  learnerId: string;
  nickname: string;
  uid: string;
};

export function maskLearnerExport(
  rows: readonly LearnerExportRow[],
  grant: AuthorizationGrant,
): SafeLearnerExportRow[] {
  const canViewPii = grant.effectiveRoles.some((role) =>
    (["owner", "lead-teacher"] as Role[]).includes(role),
  );

  return rows.map((row) => ({
    learnerId: row.learnerId,
    nickname: row.nickname,
    uid:
      canViewPii && row.uid
        ? row.uid
        : row.uid
          ? `***${row.uid.slice(-4)}`
          : "",
  }));
}
