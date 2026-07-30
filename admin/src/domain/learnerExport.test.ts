import { describe, expect, it } from "vitest";

import {
  assertLearnerWriteAllowed,
  canExportFullUid,
  createBulkSelection,
  exportLearnersToCsv,
  LEARNER_EXPORT_HEADERS,
  updateBulkSelection,
} from "./learnerExport";

const learner = {
  learnerId: "learner-01",
  nickname: '小明, "Trader"',
  sourceFirst: "youtube",
  sourceLatest: "discord",
  status: "active" as const,
  learningState: "in-progress" as const,
  uidStatus: "verified" as const,
  tags: [],
  createdAt: "2026-07-01T09:00:00+08:00",
  updatedAt: "2026-07-30T09:00:00+08:00",
};

const privateLearner = {
  learnerId: "learner-01",
  uidCurrent: "9876543210",
  uidNormalized: "9876543210",
  email: "student@example.com",
  updatedAt: "2026-07-30T09:00:00+08:00",
};

const sharedRequest = {
  actorId: "admin-01",
  reason: "Pending UID follow-up",
  exportedAt: "2026-07-30T10:00:00+08:00",
  auditId: "audit-export-01",
  requestId: "request-01",
  filters: {
    uidStatus: ["pending", "needs-correction"],
    source: "youtube",
  },
  rows: [{ learner, privateLearner }],
} as const;

describe("learner CSV export", () => {
  it("requires the exact export permission and only reveals UID with PII permission", () => {
    expect(canExportFullUid("lead-teacher")).toBe(true);
    expect(canExportFullUid("analyst")).toBe(false);
    expect(canExportFullUid("assistant")).toBe(false);

    expect(() =>
      exportLearnersToCsv({ ...sharedRequest, role: "assistant" }),
    ).toThrow("cannot export");

    const full = exportLearnersToCsv({
      ...sharedRequest,
      role: "lead-teacher",
    });
    const masked = exportLearnersToCsv({
      ...sharedRequest,
      role: "analyst",
    });

    expect(full.csv).toContain('"9876543210"');
    expect(masked.csv).not.toContain('"9876543210"');
    expect(masked.csv).toContain('"****3210"');
  });

  it("uses UTF-8 BOM, stable headers, escaped values, filter summary and audit", () => {
    const result = exportLearnersToCsv({
      ...sharedRequest,
      role: "lead-teacher",
    });

    expect(result.csv.startsWith("\uFEFF")).toBe(true);
    expect(result.csv.split("\r\n")[0]).toBe(
      `\uFEFF${LEARNER_EXPORT_HEADERS.map((header) => `"${header}"`).join(",")}`,
    );
    expect(result.csv).toContain('"小明, ""Trader"""');
    expect(result.filterSummary).toBe(
      "source=youtube; uidStatus=needs-correction|pending",
    );
    expect(result.audit).toMatchObject({
      action: "learner.export",
      result: "success",
      reason: "Pending UID follow-up",
      after: {
        exportedCount: 1,
        rejectedCount: 0,
        uidAccess: "full",
      },
    });
  });

  it("rejects malformed rows without corrupting valid CSV rows", () => {
    const result = exportLearnersToCsv({
      ...sharedRequest,
      role: "lead-teacher",
      rows: [
        { learner, privateLearner },
        {
          learner: {
            learnerId: "broken-01",
            nickname: "",
          },
        },
      ],
    });

    expect(result.exportedCount).toBe(1);
    expect(result.rejectedRows).toEqual([
      {
        rowIndex: 1,
        learnerId: "broken-01",
        reason: "Malformed learner row.",
      },
    ]);
    expect(result.audit.result).toBe("partial");
    expect(result.csv).not.toContain("broken-01");
  });
});

describe("learner selection and write guards", () => {
  it("preserves bulk selection while moving across pages", () => {
    const firstPage = updateBulkSelection(
      createBulkSelection(),
      ["learner-01", "learner-02"],
      true,
    );
    const secondPage = updateBulkSelection(
      firstPage,
      ["learner-03", "learner-04"],
      true,
    );
    const deselectedOnFirstPage = updateBulkSelection(
      secondPage,
      ["learner-02"],
      false,
    );

    expect([...deselectedOnFirstPage].sort()).toEqual([
      "learner-01",
      "learner-03",
      "learner-04",
    ]);
  });

  it("blocks learner writes but permits an administrator to change blocked status", () => {
    const blockedLearner = {
      learnerId: "learner-blocked",
      status: "blocked" as const,
    };

    expect(() =>
      assertLearnerWriteAllowed(blockedLearner, "learning-event"),
    ).toThrow("blocked from writes");
    expect(() =>
      assertLearnerWriteAllowed(blockedLearner, "profile-update"),
    ).toThrow("blocked from writes");
    expect(() =>
      assertLearnerWriteAllowed(blockedLearner, "admin-status-update"),
    ).not.toThrow();
  });
});
