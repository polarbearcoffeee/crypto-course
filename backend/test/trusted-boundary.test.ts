import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  authorizeTrustedOperation,
  maskLearnerExport,
  type ActiveAdminRecord,
  type Role,
  type TrustedOperation,
} from "../src/trusted-boundary.js";

const nowSeconds = 1_900_000_000;

function requestFor(
  role: Role,
  operation: TrustedOperation,
  overrides: Partial<Parameters<typeof authorizeTrustedOperation>[0]> = {},
) {
  const admin: ActiveAdminRecord = { status: "active", roles: [role] };
  return {
    operation,
    auth: {
      uid: `${role}-1`,
      tokenRoles: [role],
      authTimeSeconds: nowSeconds,
    },
    admin,
    nowSeconds,
    confirmed: true,
    reason: "Approved operational request",
    ...overrides,
  };
}

function expectDenied(
  role: Role,
  operation: TrustedOperation,
  code: AuthorizationError["code"] = "permission-denied",
) {
  expect(() => authorizeTrustedOperation(requestFor(role, operation))).toThrowError(
    expect.objectContaining({ code }),
  );
}

describe("trusted operation permission boundary", () => {
  it("rejects anonymous and suspended administrators", () => {
    expect(() =>
      authorizeTrustedOperation(
        requestFor("owner", "settings.edit", { auth: null }),
      ),
    ).toThrowError(expect.objectContaining({ code: "unauthenticated" }));

    expect(() =>
      authorizeTrustedOperation(
        requestFor("owner", "settings.edit", {
          admin: { status: "suspended", roles: ["owner"] },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "inactive-admin" }));
  });

  it("denies publish to analyst, assistant, and content editor", () => {
    expectDenied("analyst", "curriculum.publish");
    expectDenied("assistant", "curriculum.publish");
    expectDenied("content-editor", "curriculum.publish");
  });

  it("denies export to roles without learner.export", () => {
    expectDenied("assistant", "learner.export");
    expectDenied("content-editor", "learner.export");
  });

  it("allows analyst export but removes private notes and masks UID", () => {
    const grant = authorizeTrustedOperation(
      requestFor("analyst", "learner.export"),
    );
    const [row] = maskLearnerExport(
      [
        {
          learnerId: "learner-1",
          nickname: "Demo",
          uid: "1234567890",
          privateNote: "never export this",
        },
      ],
      grant,
    );

    expect(row).toEqual({
      learnerId: "learner-1",
      nickname: "Demo",
      uid: "***7890",
    });
    expect(row).not.toHaveProperty("privateNote");
  });

  it("allows lead teacher to publish and export full UID", () => {
    expect(
      authorizeTrustedOperation(
        requestFor("lead-teacher", "curriculum.publish"),
      ).operation,
    ).toBe("curriculum.publish");

    const grant = authorizeTrustedOperation(
      requestFor("lead-teacher", "learner.export"),
    );
    expect(
      maskLearnerExport(
        [{ learnerId: "learner-1", nickname: "Demo", uid: "1234567890" }],
        grant,
      )[0]?.uid,
    ).toBe("1234567890");
  });

  it("allows only owner to change roles and edit settings", () => {
    for (const role of [
      "lead-teacher",
      "assistant",
      "content-editor",
      "analyst",
    ] satisfies Role[]) {
      expectDenied(role, "administrator.changeRoles");
      expectDenied(role, "settings.edit");
    }

    expect(
      authorizeTrustedOperation(
        requestFor("owner", "administrator.changeRoles"),
      ).actorId,
    ).toBe("owner-1");
    expect(
      authorizeTrustedOperation(requestFor("owner", "settings.edit")).actorId,
    ).toBe("owner-1");
  });

  it("requires confirmation, reason, and fresh auth for high-risk actions", () => {
    expect(() =>
      authorizeTrustedOperation(
        requestFor("owner", "settings.edit", { confirmed: false }),
      ),
    ).toThrowError(expect.objectContaining({ code: "confirmation-required" }));

    expect(() =>
      authorizeTrustedOperation(
        requestFor("owner", "settings.edit", { reason: " " }),
      ),
    ).toThrowError(expect.objectContaining({ code: "reason-required" }));

    expect(() =>
      authorizeTrustedOperation(
        requestFor("owner", "settings.edit", {
          auth: {
            uid: "owner-1",
            tokenRoles: ["owner"],
            authTimeSeconds: nowSeconds - 301,
          },
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "reauthentication-required" }),
    );
  });

  it("rejects stale token roles removed from the server profile", () => {
    expect(() =>
      authorizeTrustedOperation(
        requestFor("owner", "settings.edit", {
          admin: { status: "active", roles: ["analyst"] },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "permission-denied" }));
  });
});
