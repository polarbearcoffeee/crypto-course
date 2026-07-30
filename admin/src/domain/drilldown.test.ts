import { describe, expect, it } from "vitest";

import {
  countAggregatePopulation,
  createAggregateDefinition,
  createAggregateMetadata,
  getDrilldownPage,
  type AggregateStatus,
  type LearnerPopulationRecord,
} from "./drilldown";

const records: readonly LearnerPopulationRecord[] = [
  {
    learnerId: "learner-03",
    metrics: ["7d-active", "activation"],
    dimensions: { source: "youtube", cohort: "2026-07" },
  },
  {
    learnerId: "learner-01",
    metrics: ["7d-active"],
    dimensions: { source: "youtube", cohort: "2026-07" },
  },
  {
    learnerId: "learner-02",
    metrics: ["7d-active"],
    dimensions: { source: "discord", cohort: "2026-07" },
  },
  {
    learnerId: "learner-04",
    metrics: ["completion"],
    dimensions: { source: "youtube", cohort: "2026-07" },
  },
];

describe("aggregate drill-down contract", () => {
  it("uses the aggregate definition for the paginated learner population", () => {
    const definition = createAggregateDefinition("7d-active");
    const firstPage = getDrilldownPage(records, definition, {
      metricId: "7d-active",
      dimensions: { source: "youtube" },
      pageSize: 1,
    });
    const secondPage = getDrilldownPage(records, definition, {
      metricId: "7d-active",
      dimensions: { source: "youtube" },
      pageSize: 1,
      cursor: firstPage.nextCursor,
    });

    expect(firstPage.learnerIds).toEqual(["learner-01"]);
    expect(secondPage.learnerIds).toEqual(["learner-03"]);
    expect(secondPage.nextCursor).toBeUndefined();
  });

  it("reconciles the KPI count with all drill-down pages", () => {
    const definition = createAggregateDefinition("7d-active");
    const query = {
      metricId: "7d-active" as const,
      dimensions: { cohort: "2026-07" },
    };
    const expectedCount = countAggregatePopulation(records, definition, query);
    const learnerIds: string[] = [];
    let cursor: string | undefined;

    do {
      const page = getDrilldownPage(records, definition, {
        ...query,
        pageSize: 2,
        cursor,
      });
      learnerIds.push(...page.learnerIds);
      expect(page.totalCount).toBe(expectedCount);
      cursor = page.nextCursor;
    } while (cursor);

    expect(new Set(learnerIds).size).toBe(expectedCount);
    expect(learnerIds).toEqual(["learner-01", "learner-02", "learner-03"]);
  });

  it("rejects a metric that does not match the aggregate definition", () => {
    const definition = createAggregateDefinition("completion");

    expect(() =>
      getDrilldownPage(records, definition, {
        metricId: "activation",
        pageSize: 20,
      }),
    ).toThrow("cannot serve activation");
  });
});

describe("aggregate metadata", () => {
  const statusCases: readonly AggregateStatus[] = [
    "fresh",
    "stale",
    "partial",
    "error",
  ];

  it.each(statusCases)("tracks %s aggregate state and history start", (status) => {
    const metadata = createAggregateMetadata({
      status,
      asOf: "2026-07-30T02:00:00+08:00",
      refreshedAt: "2026-07-30T02:05:00+08:00",
      historicalTrackingStart: "2026-06-01T00:00:00+08:00",
      completeThrough:
        status === "partial" ? "2026-07-29T18:00:00+08:00" : undefined,
      errorMessage: status === "error" ? "Warehouse timeout." : undefined,
    });

    expect(metadata.status).toBe(status);
    expect(metadata.historicalTrackingStart).toBe(
      "2026-06-01T00:00:00+08:00",
    );
  });

  it("requires diagnostic details for partial and error aggregates", () => {
    const shared = {
      asOf: "2026-07-30T02:00:00+08:00",
      refreshedAt: "2026-07-30T02:05:00+08:00",
      historicalTrackingStart: "2026-06-01T00:00:00+08:00",
    } as const;

    expect(() =>
      createAggregateMetadata({ ...shared, status: "partial" }),
    ).toThrow("completeThrough");
    expect(() =>
      createAggregateMetadata({ ...shared, status: "error" }),
    ).toThrow("errorMessage");
  });
});
