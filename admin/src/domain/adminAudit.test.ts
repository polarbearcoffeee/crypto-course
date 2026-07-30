import { describe, expect, it } from "vitest";

import { ImmutableAdminAuditLog } from "./adminAudit";

function createLog() {
  let sequence = 0;
  return new ImmutableAdminAuditLog(
    () => "2026-07-30T10:00:00.000Z",
    () => `audit-${++sequence}`,
  );
}

describe("immutable administrator audit log", () => {
  it("records the complete sensitive-change evidence", () => {
    const log = createLog();
    const event = log.append({
      actorId: "owner-1",
      action: "administrator.role.change",
      targetType: "administrator",
      targetId: "admin-2",
      reason: "Promoted to lead teacher",
      requestId: "request-1",
      result: "success",
      before: { role: "assistant" },
      after: { role: "lead-teacher" },
    });

    expect(event).toEqual({
      eventId: "audit-1",
      occurredAt: "2026-07-30T10:00:00.000Z",
      actorId: "owner-1",
      action: "administrator.role.change",
      targetType: "administrator",
      targetId: "admin-2",
      reason: "Promoted to lead teacher",
      requestId: "request-1",
      result: "success",
      before: { role: "assistant" },
      after: { role: "lead-teacher" },
    });
  });

  it("keeps before and after snapshots unchanged when callers mutate inputs", () => {
    const log = createLog();
    const before = { status: "active", nested: { role: "assistant" } };
    const after = { status: "suspended", nested: { role: "assistant" } };

    const event = log.append({
      actorId: "owner-1",
      action: "administrator.suspend",
      targetType: "administrator",
      targetId: "admin-2",
      reason: "Leave of absence",
      requestId: "request-2",
      result: "success",
      before,
      after,
    });
    before.nested.role = "owner";
    after.status = "active";

    expect(event.before).toEqual({
      status: "active",
      nested: { role: "assistant" },
    });
    expect(event.after).toEqual({
      status: "suspended",
      nested: { role: "assistant" },
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.before)).toBe(true);
  });

  it("returns defensive immutable copies and rejects duplicate request IDs", () => {
    const log = createLog();
    const input = {
      actorId: "owner-1",
      action: "curriculum.rollback",
      targetType: "course",
      targetId: "course-1",
      reason: "Restore verified safety content",
      requestId: "request-3",
      result: "failure" as const,
      before: { version: "v2" },
      after: { version: "v2" },
    };
    log.append(input);

    const listed = log.list();
    expect(Object.isFrozen(listed)).toBe(true);
    expect(() => log.append(input)).toThrow("already been audited");
    expect(log.findByRequestId("request-3")).toMatchObject({
      result: "failure",
      before: { version: "v2" },
      after: { version: "v2" },
    });
  });

  it.each(["actorId", "action", "reason", "requestId"] as const)(
    "rejects a blank %s",
    (field) => {
      const log = createLog();
      expect(() =>
        log.append({
          actorId: "owner-1",
          action: "administrator.revoke",
          targetType: "administrator",
          targetId: "admin-2",
          reason: "Departed staff",
          requestId: "request-4",
          result: "success",
          before: { status: "active" },
          after: { status: "revoked" },
          [field]: " ",
        }),
      ).toThrow("required");
    },
  );
});
