import { describe, expect, it } from "vitest";

import {
  compareLegacyAndNewCounts,
  formatCountComparisonMarkdown,
  type CountSnapshot,
} from "./countComparison";

const oldCounts: CountSnapshot = {
  learners: 20,
  progress: 16,
  xp: 800,
  uid: 18,
  sources: 4,
  courses: 1,
};

describe("legacy-to-new count comparison", () => {
  it("accepts matching counts across every required dimension", () => {
    const report = compareLegacyAndNewCounts({
      oldCounts,
      newCounts: oldCounts,
    });

    expect(report.accepted).toBe(true);
    expect(report.matchingCount).toBe(6);
    expect(report.unexplainedCount).toBe(0);
  });

  it("accepts a difference only when note and evidence explain it", () => {
    const report = compareLegacyAndNewCounts({
      oldCounts,
      newCounts: { ...oldCounts, learners: 19, sources: 3 },
      explanations: {
        learners: {
          reason: "duplicate-removed",
          note: "兩筆舊資料屬於同一位合成學員，已合併。",
          evidenceIds: ["synthetic-dry-run:duplicate-01"],
        },
        sources: {
          reason: "unknown-source-normalized",
          note: "空白來源統一併入 unknown。",
          evidenceIds: ["synthetic-dry-run:source-01"],
        },
      },
    });

    expect(report.accepted).toBe(true);
    expect(report.explainedCount).toBe(2);
    expect(formatCountComparisonMarkdown(report)).toContain(
      "synthetic-dry-run:duplicate-01",
    );
  });

  it("blocks acceptance when any difference is unexplained", () => {
    const report = compareLegacyAndNewCounts({
      oldCounts,
      newCounts: { ...oldCounts, xp: 770 },
    });

    expect(report.accepted).toBe(false);
    expect(report.unexplainedCount).toBe(1);
    expect(report.rows.find((row) => row.dimension === "xp")?.status).toBe(
      "unexplained",
    );
  });

  it("rejects invalid counts", () => {
    expect(() =>
      compareLegacyAndNewCounts({
        oldCounts,
        newCounts: { ...oldCounts, courses: -1 },
      }),
    ).toThrow("non-negative integer");
  });
});
