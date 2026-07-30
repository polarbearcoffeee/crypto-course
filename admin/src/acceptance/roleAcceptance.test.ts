import { describe, expect, it } from "vitest";

import { permissions, roles } from "../domain/permissions";
import { runSyntheticRoleAcceptance } from "./roleAcceptance";

const fixture = {
  learner: {
    learnerId: "synthetic-learner-001",
    nickname: "測試企鵝",
  },
  uid: {
    verificationId: "synthetic-verification-001",
    value: "9876543210",
    status: "pending" as const,
  },
};

describe("synthetic role-based acceptance", () => {
  it("checks every permission for every administrator role", () => {
    const result = runSyntheticRoleAcceptance(fixture);

    expect(result.checks).toHaveLength(roles.length * permissions.length);
    expect(result.passed).toBe(true);
    expect(result.checks.filter((check) => !check.passed)).toEqual([]);
  });

  it("shows synthetic UID only to roles with private learner access", () => {
    const result = runSyntheticRoleAcceptance(fixture);

    expect(result.uidProjection.owner).toBe("9876543210");
    expect(result.uidProjection["lead-teacher"]).toBe("9876543210");
    expect(result.uidProjection.assistant).toBe("9876543210");
    expect(result.uidProjection["content-editor"]).toBe("••••••3210");
    expect(result.uidProjection.analyst).toBe("••••••3210");
  });

  it("refuses fixtures that could be mistaken for real learner data", () => {
    expect(() =>
      runSyntheticRoleAcceptance({
        ...fixture,
        learner: { ...fixture.learner, learnerId: "learner-001" },
      }),
    ).toThrow("synthetic-");
  });
});
