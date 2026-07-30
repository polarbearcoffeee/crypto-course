export const roles = [
  "owner",
  "lead-teacher",
  "assistant",
  "content-editor",
  "analyst",
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "dashboard.view",
  "learner.pii.view",
  "uid.verify",
  "learner.edit",
  "learner.export",
  "curriculum.edit",
  "curriculum.publish",
  "curriculum.rollback",
  "settings.manage",
  "administrator.manage",
  "audit.view",
] as const;

export type Permission = (typeof permissions)[number];

const allPermissions = new Set<Permission>(permissions);

export const permissionMatrix: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  owner: allPermissions,
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
  "content-editor": new Set([
    "dashboard.view",
    "curriculum.edit",
  ]),
  analyst: new Set([
    "dashboard.view",
    "learner.export",
  ]),
};

export function can(role: Role, permission: Permission): boolean {
  return permissionMatrix[role].has(permission);
}
