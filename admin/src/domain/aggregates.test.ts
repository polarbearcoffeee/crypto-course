import { describe, expect, it } from "vitest";

import {
  aggregateDailyMetrics,
  aggregateFunnel,
  aggregateLessonAndQuestionPerformance,
  aggregateRegistrationCohorts,
  aggregateSourceAttribution,
  type AnalyticsEvent,
} from "./aggregates";

const event = (
  type: AnalyticsEvent["type"],
  learnerId: string,
  occurredAt: string,
  extra: Partial<AnalyticsEvent> = {},
): AnalyticsEvent => ({
  eventId: `${type}-${learnerId}-${occurredAt}`,
  learnerId,
  type,
  occurredAt,
  ...extra,
});

describe("daily metric aggregation", () => {
  it("preserves metadata, dimensions, distinct learners, and late events", () => {
    const result = aggregateDailyMetrics(
      [
        event("lesson_started", "a", "2026-07-01T00:00:00Z", {
          receivedAt: "2026-07-09T00:00:01Z",
        }),
        event("lesson_started", "a", "2026-07-01T23:59:59Z", {
          receivedAt: "2026-07-02T00:00:00Z",
        }),
      ],
      {
        metricVersion: "1.0.0",
        asOf: "2026-07-10T00:00:00Z",
        dimensions: { source: "youtube" },
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        date: "2026-07-01",
        eventCount: 2,
        learnerCount: 1,
        lateEventCount: 1,
        metricVersion: "1.0.0",
        dimensions: { source: "youtube" },
      }),
    ]);
  });

  it("returns an empty list for no events", () => {
    expect(
      aggregateDailyMetrics([], {
        metricVersion: "1.0.0",
        asOf: "2026-07-10T00:00:00Z",
      }),
    ).toEqual([]);
  });
});

describe("funnel aggregation", () => {
  it("deduplicates learners and protects zero denominators", () => {
    const result = aggregateFunnel([
      event("registration_submitted", "a", "2026-07-01T00:00:00Z"),
      event("registration_submitted", "a", "2026-07-01T01:00:00Z"),
      event("uid_submitted", "a", "2026-07-01T02:00:00Z"),
      event("uid_verified", "a", "2026-07-01T03:00:00Z"),
      event("lesson_started", "a", "2026-07-01T04:00:00Z"),
      event("course_completed", "a", "2026-07-02T00:00:00Z"),
    ]);

    expect(result.map((stage) => stage.learners)).toEqual([1, 1, 1, 1, 1, 0]);
    expect(result.at(-1)?.conversionFromPrevious).toBe(0);
    expect(aggregateFunnel([]).every((stage) => stage.conversionFromPrevious === 0)).toBe(true);
  });
});

describe("registration cohorts", () => {
  const events = [
    event("registration_submitted", "a", "2026-01-04T23:59:59Z"),
    event("registration_submitted", "b", "2026-01-05T00:00:00Z"),
    event("lesson_started", "a", "2026-02-01T00:00:00Z"),
    event("course_completed", "b", "2026-02-01T00:00:00Z"),
  ];

  it("uses Monday UTC as the registration-week boundary", () => {
    expect(aggregateRegistrationCohorts(events, "week")).toEqual([
      expect.objectContaining({ cohort: "2025-12-29", registered: 1, activated: 1 }),
      expect.objectContaining({ cohort: "2026-01-05", registered: 1, completed: 1 }),
    ]);
  });

  it("aggregates registration month and returns no empty cohorts", () => {
    expect(aggregateRegistrationCohorts(events, "month")).toEqual([
      expect.objectContaining({
        cohort: "2026-01",
        registered: 2,
        activationRate: 0.5,
        completionRate: 0.5,
      }),
    ]);
    expect(aggregateRegistrationCohorts([], "month")).toEqual([]);
  });
});

describe("lesson and question performance", () => {
  it("reports attempts, correctness, pass, time, and learner drop-off", () => {
    const result = aggregateLessonAndQuestionPerformance([
      event("lesson_started", "a", "2026-01-01T00:00:00Z", { lessonId: "l1" }),
      event("lesson_started", "b", "2026-01-01T00:00:00Z", { lessonId: "l1" }),
      event("quiz_submitted", "a", "2026-01-01T00:05:00Z", {
        lessonId: "l1",
        questionId: "q1",
        correct: true,
        passed: true,
        durationSeconds: 30,
      }),
      event("quiz_submitted", "b", "2026-01-01T00:05:00Z", {
        lessonId: "l1",
        questionId: "q1",
        correct: false,
        passed: false,
        durationSeconds: 10,
      }),
      event("lesson_completed", "a", "2026-01-01T00:06:00Z", { lessonId: "l1" }),
    ]);

    expect(result.lessons[0]).toEqual({
      lessonId: "l1",
      starts: 2,
      attempts: 2,
      passedAttempts: 1,
      passRate: 0.5,
      averageAttemptSeconds: 20,
      dropOffLearners: 1,
    });
    expect(result.questions[0]).toEqual({
      lessonId: "l1",
      questionId: "q1",
      attempts: 2,
      correctAttempts: 1,
      correctnessRate: 0.5,
      averageAttemptSeconds: 20,
    });
  });

  it("returns empty tables for no activity", () => {
    expect(aggregateLessonAndQuestionPerformance([])).toEqual({
      lessons: [],
      questions: [],
    });
  });
});

describe("source attribution", () => {
  it("keeps first-touch and latest-touch attribution separate", () => {
    const result = aggregateSourceAttribution([
      event("registration_submitted", "a", "2026-01-01T00:00:00Z", {
        sourceFirst: "youtube",
        sourceLatest: "line",
      }),
      event("course_completed", "a", "2026-01-03T00:00:00Z"),
    ]);

    expect(result.firstTouch).toEqual([
      expect.objectContaining({ source: "youtube", completionRate: 1 }),
    ]);
    expect(result.latestTouch).toEqual([
      expect.objectContaining({ source: "line", completionRate: 1 }),
    ]);
    expect(aggregateSourceAttribution([])).toEqual({
      firstTouch: [],
      latestTouch: [],
    });
  });
});
