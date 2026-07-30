import { describe, expect, it } from "vitest";

import type { AnalyticsEvent } from "./aggregates";
import {
  buildDashboardTrends,
  dashboardTrendMetrics,
} from "./dashboardTrends";

function event(
  eventId: string,
  learnerId: string,
  type: AnalyticsEvent["type"],
  occurredAt: string,
): AnalyticsEvent {
  return { eventId, learnerId, type, occurredAt };
}

describe("dashboard trends", () => {
  it("builds all five daily trends and counts a learner once per metric", () => {
    const events = [
      event("r1", "learner-1", "registration_submitted", "2026-07-30T01:00:00Z"),
      event("r2", "learner-1", "registration_submitted", "2026-07-30T02:00:00Z"),
      event("r3", "learner-2", "registration_submitted", "2026-07-30T03:00:00Z"),
      event("v1", "learner-1", "uid_verified", "2026-07-30T04:00:00Z"),
      event("a1", "learner-1", "lesson_started", "2026-07-30T05:00:00Z"),
      event("a2", "learner-1", "quiz_submitted", "2026-07-30T06:00:00Z"),
      event("c1", "learner-1", "course_completed", "2026-07-30T07:00:00Z"),
    ];

    const [point] = buildDashboardTrends(events, {
      startDate: "2026-07-30",
      endDate: "2026-07-30",
      granularity: "day",
      trackingStartedAt: "2026-07-29T16:00:00Z",
    });

    expect(Object.keys(point.metrics)).toEqual(dashboardTrendMetrics);
    expect(point.metrics.registration.value).toBe(2);
    expect(point.metrics.verification.value).toBe(1);
    expect(point.metrics.activation.value).toBe(1);
    expect(point.metrics.active.value).toBe(1);
    expect(point.metrics.completion.value).toBe(1);
  });

  it("uses midnight in Asia/Taipei as the daily boundary", () => {
    const points = buildDashboardTrends(
      [
        event("before", "learner-1", "registration_submitted", "2026-07-29T15:59:59Z"),
        event("after", "learner-2", "registration_submitted", "2026-07-29T16:00:00Z"),
      ],
      {
        startDate: "2026-07-29",
        endDate: "2026-07-30",
        granularity: "day",
        trackingStartedAt: "2026-07-28T16:00:00Z",
      },
    );

    expect(points.map((point) => point.metrics.registration.value)).toEqual([
      1, 1,
    ]);
  });

  it("fills missing tracked days with measured zero", () => {
    const points = buildDashboardTrends([], {
      startDate: "2026-07-28",
      endDate: "2026-07-30",
      granularity: "day",
      trackingStartedAt: "2026-07-27T16:00:00Z",
    });

    expect(points).toHaveLength(3);
    expect(points[1].metrics.active).toEqual({
      status: "measured",
      value: 0,
    });
  });

  it("marks periods before tracking separately from a real zero", () => {
    const points = buildDashboardTrends(
      [
        event(
          "legacy",
          "learner-before-tracking",
          "registration_submitted",
          "2026-07-29T10:00:00Z",
        ),
      ],
      {
        startDate: "2026-07-28",
        endDate: "2026-07-30",
        granularity: "day",
        trackingStartedAt: "2026-07-29T20:00:00+08:00",
      },
    );

    expect(points[0].metrics.registration).toEqual({
      status: "tracking-not-started",
      value: null,
    });
    expect(points[1].metrics.registration).toEqual({
      status: "measured",
      value: 0,
    });
    expect(points[2].metrics.registration).toEqual({
      status: "measured",
      value: 0,
    });
  });

  it("groups weekly points from Monday through Sunday in Asia/Taipei", () => {
    const points = buildDashboardTrends(
      [
        event("sun", "learner-1", "uid_verified", "2026-08-02T15:59:59Z"),
        event("mon", "learner-2", "uid_verified", "2026-08-02T16:00:00Z"),
      ],
      {
        startDate: "2026-08-02",
        endDate: "2026-08-03",
        granularity: "week",
        trackingStartedAt: "2026-07-01T00:00:00+08:00",
      },
    );

    expect(points).toEqual([
      expect.objectContaining({
        periodStart: "2026-08-02",
        periodEnd: "2026-08-02",
        metrics: expect.objectContaining({
          verification: { status: "measured", value: 1 },
        }),
      }),
      expect.objectContaining({
        periodStart: "2026-08-03",
        periodEnd: "2026-08-03",
        metrics: expect.objectContaining({
          verification: { status: "measured", value: 1 },
        }),
      }),
    ]);
  });

  it("rejects invalid date ranges and invalid tracking timestamps", () => {
    expect(() =>
      buildDashboardTrends([], {
        startDate: "2026-07-31",
        endDate: "2026-07-30",
        granularity: "day",
        trackingStartedAt: "2026-07-01T00:00:00Z",
      }),
    ).toThrow("startDate must not be after endDate");
    expect(() =>
      buildDashboardTrends([], {
        startDate: "2026-07-30",
        endDate: "2026-07-30",
        granularity: "day",
        trackingStartedAt: "not-a-date",
      }),
    ).toThrow("trackingStartedAt must be an ISO date-time");
  });
});
