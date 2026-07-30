import { describe, expect, it } from "vitest";

import { can, permissions, roles } from "./permissions";

describe("permission matrix", () => {
  it("gives the owner every defined permission", () => {
    expect(permissions.every((permission) => can("owner", permission))).toBe(true);
  });

  it("keeps every required role in the matrix", () => {
    expect(roles).toEqual([
      "owner",
      "lead-teacher",
      "assistant",
      "content-editor",
      "analyst",
    ]);
  });

  it("allows an assistant to verify UID without exporting learners", () => {
    expect(can("assistant", "uid.verify")).toBe(true);
    expect(can("assistant", "learner.export")).toBe(false);
  });

  it("prevents analysts from publishing curriculum", () => {
    expect(can("analyst", "dashboard.view")).toBe(true);
    expect(can("analyst", "curriculum.publish")).toBe(false);
  });

  it("limits administrator and settings management to the owner", () => {
    for (const role of roles.filter((role) => role !== "owner")) {
      expect(can(role, "administrator.manage")).toBe(false);
      expect(can(role, "settings.manage")).toBe(false);
    }
  });
});
