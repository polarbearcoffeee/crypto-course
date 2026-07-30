import { describe, expect, it } from "vitest";

import {
  buildDashboardKpi,
  buildRecruitmentFunnel,
  calculateRatio,
  dashboardKpiIds,
  funnelStageIds,
  type DashboardFreshness,
  type FunnelStageInput,
} from "./dashboardModel";

const freshness: DashboardFreshness = {
  asOf: "2026-07-30T09:00:00.000Z",
  refreshedAt: "2026-07-30T09:05:00.000Z",
  status: "fresh",
};

function makeFunnel(
  counts: readonly (number | null)[],
): readonly FunnelStageInput[] {
  return funnelStageIds.map((id, index) => ({
    id,
    count: counts[index],
    medianTimeToStageMinutes: index * 60,
    drilldown: {
      path: "/learners",
      filters: { funnelStage: id },
    },
  }));
}

describe("dashboard KPIs", () => {
  it("publishes the eight required KPIs", () => {
    expect(dashboardKpiIds).toEqual([
      "registered",
      "pending-uid",
      "verified",
      "activation",
      "7d-active",
      "completion",
      "stuck",
      "advanced-eligible",
    ]);
  });

  it.each(dashboardKpiIds)(
    "builds %s with comparison, definition, freshness, and drilldown",
    (id) => {
      const kpi = buildDashboardKpi(id, {
        numerator: 62,
        denominator: 100,
        previousNumerator: 50,
        definition: `${id} exact definition`,
        freshness,
        drilldown: {
          path: "/learners",
          filters: { metric: id, cohort: "2026-W30" },
        },
      });

      expect(kpi).toMatchObject({
        id,
        numerator: 62,
        denominator: 100,
        value: 0.62,
        rate: { status: "available", value: 0.62 },
        comparison: {
          previousNumerator: 50,
          absoluteChange: 12,
          percentageChange: { status: "available", value: 0.24 },
        },
        definition: `${id} exact definition`,
        freshness,
        drilldown: {
          path: "/learners",
          filters: { metric: id, cohort: "2026-W30" },
        },
      });
    },
  );

  it("represents a zero denominator as unavailable instead of zero percent", () => {
    const kpi = buildDashboardKpi("activation", {
      numerator: 0,
      denominator: 0,
      previousNumerator: 0,
      definition: "Activated learners divided by registered learners.",
      freshness,
      drilldown: { path: "/learners", filters: { metric: "activation" } },
    });

    expect(kpi.rate).toEqual({
      status: "unavailable",
      value: null,
      reason: "zero-denominator",
    });
    expect(kpi.value).toBe(0);
    expect(kpi.comparison.percentageChange).toEqual({
      status: "unavailable",
      value: null,
      reason: "zero-denominator",
    });
  });

  it("supports count KPIs without inventing a denominator", () => {
    const kpi = buildDashboardKpi("registered", {
      numerator: 42,
      previousNumerator: 40,
      definition: "Unique registered learners.",
      freshness,
      drilldown: { path: "/learners", filters: { metric: "registered" } },
    });

    expect(kpi.denominator).toBeNull();
    expect(kpi.value).toBe(42);
    expect(kpi.rate).toEqual({
      status: "unavailable",
      value: null,
      reason: "not-applicable",
    });
  });

  it("rejects invalid counts and incomplete metadata", () => {
    const base = {
      previousNumerator: 0,
      definition: "Definition",
      freshness,
      drilldown: { path: "/learners", filters: {} },
    };

    expect(() =>
      buildDashboardKpi("registered", { ...base, numerator: -1 }),
    ).toThrow("numerator must be a non-negative integer");
    expect(() =>
      buildDashboardKpi("activation", {
        ...base,
        numerator: 2,
        denominator: 1,
      }),
    ).toThrow("numerator cannot exceed denominator");
    expect(() =>
      buildDashboardKpi("registered", {
        ...base,
        numerator: 1,
        definition: " ",
      }),
    ).toThrow("definition is required");
  });
});

describe("recruitment-to-completion funnel", () => {
  it("calculates previous-stage and total conversion plus median time", () => {
    const funnel = buildRecruitmentFunnel(
      makeFunnel([200, 100, 80, 60, 48, 30, 15]),
    );

    expect(funnel[3]).toMatchObject({
      id: "first-lesson-started",
      count: 60,
      medianTimeToStageMinutes: 180,
      conversionFromPrevious: { status: "available", value: 0.75 },
      conversionFromFirstMeasured: { status: "available", value: 0.3 },
      drilldown: {
        path: "/learners",
        filters: { funnelStage: "first-lesson-started" },
      },
    });
  });

  it("starts total conversion at registration when referral tracking is absent", () => {
    const funnel = buildRecruitmentFunnel(
      makeFunnel([null, 100, 80, 60, 48, 30, 15]),
    );

    expect(funnel[0].conversionFromFirstMeasured).toEqual({
      status: "unavailable",
      value: null,
      reason: "not-tracked",
    });
    expect(funnel[1].conversionFromFirstMeasured).toEqual({
      status: "available",
      value: 1,
    });
    expect(funnel[2].conversionFromFirstMeasured).toEqual({
      status: "available",
      value: 0.8,
    });
  });

  it("does not convert a zero denominator into zero percent", () => {
    const funnel = buildRecruitmentFunnel(
      makeFunnel([100, 0, 0, 0, 0, 0, 0]),
    );

    expect(funnel[2].conversionFromPrevious).toEqual({
      status: "unavailable",
      value: null,
      reason: "zero-denominator",
    });
    expect(funnel[2].conversionFromFirstMeasured).toEqual({
      status: "available",
      value: 0,
    });
  });

  it("rejects missing, duplicated, or reordered stages", () => {
    expect(() =>
      buildRecruitmentFunnel(
        makeFunnel([100, 80, 70, 60, 50, 40, 30]).slice(0, -1),
      ),
    ).toThrow("every stage exactly once");

    const reordered = [...makeFunnel([100, 80, 70, 60, 50, 40, 30])];
    [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
    expect(() => buildRecruitmentFunnel(reordered)).toThrow(
      "canonical order",
    );
  });

  it("validates count and median-time inputs", () => {
    const invalidCount = [...makeFunnel([100, 80, 70, 60, 50, 40, 30])];
    invalidCount[1] = { ...invalidCount[1], count: -1 };
    expect(() => buildRecruitmentFunnel(invalidCount)).toThrow(
      "registration-submitted.count must be a non-negative integer",
    );

    const invalidTime = [...makeFunnel([100, 80, 70, 60, 50, 40, 30])];
    invalidTime[1] = {
      ...invalidTime[1],
      medianTimeToStageMinutes: -1,
    };
    expect(() => buildRecruitmentFunnel(invalidTime)).toThrow(
      "medianTimeToStageMinutes must be non-negative",
    );
  });
});

describe("calculateRatio", () => {
  it("calculates a ratio and identifies a missing metric", () => {
    expect(calculateRatio(1, 4)).toEqual({
      status: "available",
      value: 0.25,
    });
    expect(calculateRatio(0, null, "not-tracked")).toEqual({
      status: "unavailable",
      value: null,
      reason: "not-tracked",
    });
  });
});
