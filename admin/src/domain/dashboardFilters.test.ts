import { describe, expect, it } from "vitest";

import {
  clearAllDashboardFilters,
  clearDashboardFilter,
  decodeDashboardFilters,
  encodeDashboardFilters,
  getDashboardFilterChips,
  type DashboardFilters,
} from "./dashboardFilters";

const filters: DashboardFilters = {
  datePreset: "custom",
  dateFrom: "2026-07-01",
  dateTo: "2026-07-30",
  sources: ["instagram-a", "直接 / direct"],
  cohorts: ["2026-W27"],
  learnerStates: ["in-progress", "stuck"],
  courseStages: ["lesson-started"],
  uidStatuses: ["pending", "needs-correction"],
};

describe("dashboard filters", () => {
  it("round-trips every global filter through the URL", () => {
    const encoded = encodeDashboardFilters(filters);

    expect(encoded).toContain("source=instagram-a");
    expect(encoded).toContain("%E7%9B%B4%E6%8E%A5");
    expect(decodeDashboardFilters(`?${encoded}`)).toEqual(filters);
  });

  it("creates removable chips for the active date and dimensions", () => {
    expect(getDashboardFilterChips(filters)).toEqual([
      { key: "date", value: "custom", label: "日期：2026-07-01～2026-07-30" },
      { key: "source", value: "instagram-a", label: "來源：instagram-a" },
      { key: "source", value: "直接 / direct", label: "來源：直接 / direct" },
      { key: "cohort", value: "2026-W27", label: "同期群：2026-W27" },
      {
        key: "learner-state",
        value: "in-progress",
        label: "學員狀態：in-progress",
      },
      { key: "learner-state", value: "stuck", label: "學員狀態：stuck" },
      {
        key: "course-stage",
        value: "lesson-started",
        label: "課程階段：lesson-started",
      },
      { key: "uid-status", value: "pending", label: "UID 狀態：pending" },
      {
        key: "uid-status",
        value: "needs-correction",
        label: "UID 狀態：needs-correction",
      },
    ]);
  });

  it("clears either one chip, one filter group, or all filters", () => {
    expect(clearDashboardFilter(filters, "source", "instagram-a").sources).toEqual([
      "直接 / direct",
    ]);
    expect(clearDashboardFilter(filters, "uid-status").uidStatuses).toEqual([]);
    expect(clearDashboardFilter(filters, "date")).toMatchObject({
      datePreset: "30d",
      dateFrom: undefined,
      dateTo: undefined,
    });
    expect(clearAllDashboardFilters()).toEqual({
      datePreset: "30d",
      sources: [],
      cohorts: [],
      learnerStates: [],
      courseStages: [],
      uidStatuses: [],
    });
  });

  it("falls back safely when URL values are invalid", () => {
    expect(
      decodeDashboardFilters(
        "?date=custom&from=2026-02-30&to=2026-01-01" +
          "&source=%3Cscript%3E&source=instagram-a" +
          "&learner-state=unknown&learner-state=stuck" +
          "&course-stage=nope&uid-status=wrong",
      ),
    ).toEqual({
      datePreset: "30d",
      sources: ["instagram-a"],
      cohorts: [],
      learnerStates: ["stuck"],
      courseStages: [],
      uidStatuses: [],
    });
  });

  it("deduplicates URL values while preserving their first order", () => {
    expect(
      decodeDashboardFilters(
        "?date=7d&source=a&source=a&cohort=2026-W27&cohort=2026-W27",
      ),
    ).toMatchObject({
      datePreset: "7d",
      sources: ["a"],
      cohorts: ["2026-W27"],
    });
  });
});
