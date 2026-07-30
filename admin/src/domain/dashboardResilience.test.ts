import { describe, expect, it } from "vitest";

import {
  assertIdenticalLearnerDrilldowns,
  authorizeLearnerDrilldown,
  bindLearnerDrilldown,
  createDashboardComponentState,
  createLearnerPopulation,
  dashboardComponentStatuses,
  dashboardRateDisplay,
  dashboardStatePresentation,
  dashboardTrackingDisplay,
  hasDashboardData,
  learnerDrilldownSurfaces,
  maskDashboardPayload,
  type DashboardComponentState,
} from "./dashboardResilience";

const updatedAt = "2026-07-30T10:00:00.000Z";

describe("dashboard component resilience states", () => {
  const states: readonly DashboardComponentState<readonly number[]>[] = [
    { status: "loading" },
    { status: "ready", data: [1], updatedAt },
    { status: "empty", updatedAt, message: "沒有符合條件的資料" },
    {
      status: "partial",
      data: [1],
      updatedAt,
      message: "部分來源尚未完成",
      completeThrough: "2026-07-30T09:00:00.000Z",
    },
    {
      status: "stale",
      data: [1],
      updatedAt,
      message: "本次更新失敗",
      lastSuccessfulAt: updatedAt,
    },
    { status: "error", message: "服務暫時無法使用", retryable: true },
  ];

  it("covers loading, ready, empty, partial, stale, and error explicitly", () => {
    expect(states.map((state) => state.status)).toEqual(
      dashboardComponentStatuses,
    );
  });

  it.each(states)("presents $status without confusing missing data with zero", (input) => {
    const state = createDashboardComponentState(input);
    const presentation = dashboardStatePresentation(state);

    expect(presentation.label).not.toBe("");
    expect(presentation.showsData).toBe(hasDashboardData(state));
    expect(presentation.canRetry).toBe(
      state.status === "partial" ||
        state.status === "stale" ||
        (state.status === "error" && state.retryable),
    );
  });

  it("retains last-known data and timestamp in a stale state", () => {
    const state = createDashboardComponentState({
      status: "stale",
      data: { count: 12 },
      updatedAt,
      lastSuccessfulAt: updatedAt,
      message: "彙總服務逾時",
    });

    expect(hasDashboardData(state) && state.data).toEqual({ count: 12 });
    expect(dashboardStatePresentation(state)).toEqual({
      label: "顯示上次資料",
      announcement: `彙總服務逾時，最後成功更新時間 ${updatedAt}`,
      showsData: true,
      canRetry: true,
    });
  });

  it("rejects incomplete diagnostic metadata", () => {
    expect(() =>
      createDashboardComponentState({
        status: "partial",
        data: [],
        updatedAt,
        message: " ",
        completeThrough: updatedAt,
      }),
    ).toThrow("message is required");
    expect(() =>
      createDashboardComponentState({
        status: "stale",
        data: [],
        updatedAt,
        message: "更新失敗",
        lastSuccessfulAt: "not-a-date",
      }),
    ).toThrow("lastSuccessfulAt must be an ISO date-time");
  });
});

describe("identical learner drill-down populations", () => {
  it("binds every learner-related surface to the exact same set and filters", () => {
    const population = createLearnerPopulation({
      key: "completion:2026-07-30",
      learnerIds: ["learner-03", "learner-01", "learner-02", "learner-02"],
      filters: { source: "youtube", date: "2026-07-30" },
    });
    const bindings = learnerDrilldownSurfaces.map((surface) =>
      bindLearnerDrilldown({
        surface,
        sourceId: `${surface}:completion`,
        population,
      }),
    );

    expect(() => assertIdenticalLearnerDrilldowns(bindings)).not.toThrow();
    expect(bindings.every((binding) => binding.displayedCount === 3)).toBe(true);
    expect(
      new Set(bindings.map((binding) => binding.population.fingerprint)).size,
    ).toBe(1);
  });

  it("rejects a displayed count or learner set that differs from its drill-down", () => {
    const first = createLearnerPopulation({
      key: "activation",
      learnerIds: ["learner-01", "learner-02"],
    });
    const different = createLearnerPopulation({
      key: "activation",
      learnerIds: ["learner-01"],
    });

    expect(() =>
      bindLearnerDrilldown({
        surface: "card",
        sourceId: "activation-card",
        displayedCount: 3,
        population: first,
      }),
    ).toThrow("does not match its learner population");

    expect(() =>
      assertIdenticalLearnerDrilldowns([
        bindLearnerDrilldown({
          surface: "card",
          sourceId: "activation-card",
          population: first,
        }),
        bindLearnerDrilldown({
          surface: "chart-point",
          sourceId: "activation-point",
          population: different,
        }),
      ]),
    ).toThrow("activation is inconsistent");
  });
});

describe("dashboard regression cases", () => {
  it("snapshots zero denominators and tracking that has not started", () => {
    expect({
      zeroDenominator: dashboardRateDisplay(0, 0),
      trackingNotStarted: dashboardTrackingDisplay(null, false),
      measuredZero: dashboardTrackingDisplay(0, true),
    }).toMatchInlineSnapshot(`
      {
        "measuredZero": "0",
        "trackingNotStarted": "尚未追蹤",
        "zeroDenominator": {
          "note": "沒有符合條件的母數",
          "value": "—",
        },
      }
    `);
  });

  it("removes sensitive identifiers from nested dashboard payloads", () => {
    const payload = {
      count: 1,
      uidStatus: "pending",
      learners: [
        {
          learnerId: "learner-01",
          uid: "12345678",
          email: "private@example.test",
          displayName: "測試學員",
        },
      ],
    };

    expect(maskDashboardPayload(payload, false)).toMatchInlineSnapshot(`
      {
        "count": 1,
        "learners": [
          {
            "displayName": "測試學員",
          },
        ],
      }
    `);
    expect(maskDashboardPayload(payload, true)).toBe(payload);
  });

  it("denies UID drill-down without returning learner identifiers", () => {
    const binding = bindLearnerDrilldown({
      surface: "card",
      sourceId: "pending-uid",
      requiredPermission: "learners.uid.view",
      population: createLearnerPopulation({
        key: "pending-uid",
        learnerIds: ["learner-01"],
        filters: { uidStatus: "pending" },
      }),
    });
    const denied = authorizeLearnerDrilldown(binding, new Set());

    expect(denied).toEqual({
      allowed: false,
      sourceId: "pending-uid",
      reason: "permission-denied",
    });
    expect("learnerIds" in denied).toBe(false);
  });
});
