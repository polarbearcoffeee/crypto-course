import {
  can,
  permissions,
  roles,
  type Permission,
  type Role,
} from "../domain/permissions";

export type SyntheticAcceptanceFixture = Readonly<{
  learner: Readonly<{
    learnerId: string;
    nickname: string;
  }>;
  uid: Readonly<{
    verificationId: string;
    value: string;
    status: "pending";
  }>;
}>;

export type RoleAcceptanceCheck = Readonly<{
  role: Role;
  permission: Permission;
  expected: boolean;
  actual: boolean;
  passed: boolean;
}>;

export type RoleAcceptanceResult = Readonly<{
  checks: readonly RoleAcceptanceCheck[];
  uidProjection: Readonly<Record<Role, string>>;
  passed: boolean;
}>;

const expectedPermissions: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  owner: new Set(permissions),
  "lead-teacher": new Set([
    "dashboard.view",
    "learner.pii.view",
    "uid.verify",
    "learner.edit",
    "learner.export",
    "curriculum.edit",
    "curriculum.publish",
    "curriculum.rollback",
    "audit.view",
  ]),
  assistant: new Set([
    "dashboard.view",
    "learner.pii.view",
    "uid.verify",
    "learner.edit",
  ]),
  "content-editor": new Set(["dashboard.view", "curriculum.edit"]),
  analyst: new Set(["dashboard.view", "learner.export"]),
};

export function runSyntheticRoleAcceptance(
  fixture: SyntheticAcceptanceFixture,
): RoleAcceptanceResult {
  requireSyntheticId(fixture.learner.learnerId, "learner ID");
  requireSyntheticId(fixture.uid.verificationId, "verification ID");
  if (!fixture.learner.nickname.trim()) {
    throw new Error("Synthetic learner nickname is required.");
  }
  if (!fixture.uid.value.trim()) {
    throw new Error("Synthetic UID is required.");
  }

  const checks = roles.flatMap((role) =>
    permissions.map((permission): RoleAcceptanceCheck => {
      const expected = expectedPermissions[role].has(permission);
      const actual = can(role, permission);
      return Object.freeze({
        role,
        permission,
        expected,
        actual,
        passed: expected === actual,
      });
    }),
  );
  const uidProjection = Object.fromEntries(
    roles.map((role) => [
      role,
      can(role, "learner.pii.view") ? fixture.uid.value : maskUid(fixture.uid.value),
    ]),
  ) as Record<Role, string>;

  return Object.freeze({
    checks: Object.freeze(checks),
    uidProjection: Object.freeze(uidProjection),
    passed: checks.every((check) => check.passed),
  });
}

function maskUid(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 4) return "••••";
  return `${"•".repeat(normalized.length - 4)}${normalized.slice(-4)}`;
}

function requireSyntheticId(value: string, label: string) {
  if (!value.startsWith("synthetic-")) {
    throw new Error(`${label} must use the synthetic- prefix.`);
  }
}
