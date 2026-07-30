import { describe, expect, it } from "vitest";

import type { AnalyticsEvent } from "./aggregates";
import {
  buildLessonPerformanceTable,
  buildOperationalQueueCards,
  buildRegistrationCohortMatrix,
  buildSourcePerformanceTable,
  operationalQueueIds,
  type OperationalQueueItem,
} from "./dashboardTables";

function event(
  eventId: string,
  learnerId: string,
  type: AnalyticsEvent["type"],
  occurredAt: string,
  extra: Partial<AnalyticsEvent> = {},
): AnalyticsEvent {
  return { eventId, learnerId, type, occurredAt, ...extra };
}

describe("registration cohort matrix", () => {
  it("calculates mature day-one activation, D7 retention, and completion", () => {
    const rows = buildRegistrationCohortMatrix(
      [
        event("r1", "a", "registration_submitted", "2026-07-06T01:00:00Z"),
        event("r2", "b", "registration_submitted", "2026-07-06T02:00:00Z"),
        event("a1", "a", "lesson_started", "2026-07-06T03:00:00Z"),
        event("a2", "b", "lesson_started", "2026-07-07T03:00:00Z"),
        event("d7", "a", "quiz_submitted", "2026-07-13T01:30:00Z"),
        event("done", "b", "course_completed", "2026-07-20T01:00:00Z"),
      ],
      {
        granularity: "week",
        asOf: "2026-07-21T00:00:00Z",
      },
    );

    expect(rows).toEqual([
      {
        cohort: "2026-07-06",
        registeredLearners: 2,
        dayOneActivation: {
          numerator: 1,
          denominator: 2,
          rate: { status: "available", value: 0.5 },
        },
        daySevenRetention: {
          numerator: 1,
          denominator: 2,
          rate: { status: "available", value: 0.5 },
        },
        completion: {
          numerator: 1,
          denominator: 2,
          rate: { status: "available", value: 0.5 },
        },
      },
    ]);
  });

  it("uses Asia/Taipei month boundaries and excludes immature learners", () => {
    const rows = buildRegistrationCohortMatrix(
      [
        event("july", "a", "registration_submitted", "2026-07-31T15:59:59Z"),
        event("aug", "b", "registration_submitted", "2026-07-31T16:00:00Z"),
      ],
      { granularity: "month", asOf: "2026-08-01T00:00:00Z" },
    );

    expect(rows.map((row) => row.cohort)).toEqual(["2026-07", "2026-08"]);
    expect(rows[1].dayOneActivation).toEqual({
      numerator: 0,
      denominator: 0,
      rate: {
        status: "unavailable",
        value: null,
        reason: "zero-denominator",
      },
    });
  });

  it("deduplicates registrations and returns no artificial empty cohort", () => {
    const duplicate = event(
      "r2",
      "a",
      "registration_submitted",
      "2026-07-07T00:00:00Z",
    );
    expect(
      buildRegistrationCohortMatrix(
        [
          event("r1", "a", "registration_submitted", "2026-07-06T00:00:00Z"),
          duplicate,
        ],
        { granularity: "week", asOf: "2026-07-20T00:00:00Z" },
      )[0].registeredLearners,
    ).toBe(1);
    expect(
      buildRegistrationCohortMatrix([], {
        granularity: "week",
        asOf: "2026-07-20T00:00:00Z",
      }),
    ).toEqual([]);
  });
});

describe("source performance table", () => {
  const events: AnalyticsEvent[] = [
    event("r1", "a", "registration_submitted", "2026-07-01T00:00:00Z", {
      sourceFirst: "youtube",
      sourceLatest: "line",
    }),
    event("r2", "b", "registration_submitted", "2026-07-01T01:00:00Z", {
      sourceFirst: "youtube",
      sourceLatest: "youtube",
    }),
    event("v1", "a", "uid_verified", "2026-07-01T02:00:00Z"),
    event("s1", "a", "lesson_started", "2026-07-01T00:30:00Z"),
    event("s2", "b", "lesson_started", "2026-07-01T02:30:00Z"),
    event("c1", "a", "course_completed", "2026-07-09T00:00:00Z"),
    event(
      "adv1",
      "a",
      "advanced_eligibility_granted",
      "2026-07-09T00:01:00Z",
    ),
  ];

  it("shows source volume, quality, activity, advanced status, and median time", () => {
    const youtube = buildSourcePerformanceTable(events, {
      asOf: "2026-07-10T00:00:00Z",
    }).find((row) => row.source === "youtube");

    expect(youtube).toMatchObject({
      registeredLearners: 2,
      verification: { numerator: 1, denominator: 2 },
      activation: {
        numerator: 2,
        denominator: 2,
        rate: { status: "available", value: 1 },
      },
      completion: { numerator: 1, denominator: 2 },
      sevenDayActivity: { numerator: 1, denominator: 2 },
      advancedEligibility: { numerator: 1, denominator: 2 },
      medianMinutesToFirstLesson: 60,
    });
  });

  it("keeps first-touch and latest-touch attribution separate", () => {
    const latest = buildSourcePerformanceTable(events, {
      asOf: "2026-07-10T00:00:00Z",
      attribution: "latest-touch",
    });
    expect(latest.find((row) => row.source === "line")?.registeredLearners).toBe(
      1,
    );
    expect(
      latest.find((row) => row.source === "youtube")?.registeredLearners,
    ).toBe(1);
  });

  it("always exposes direct and unknown rows with unavailable zero rates", () => {
    const rows = buildSourcePerformanceTable([], {
      asOf: "2026-07-10T00:00:00Z",
    });
    expect(rows.map((row) => row.source)).toEqual(["direct", "unknown"]);
    expect(rows[0].activation.rate).toEqual({
      status: "unavailable",
      value: null,
      reason: "zero-denominator",
    });
  });

  it("does not count learning activity that predates registration", () => {
    const unknown = buildSourcePerformanceTable(
      [
        event("before", "a", "lesson_started", "2026-07-08T00:00:00Z"),
        event("register", "a", "registration_submitted", "2026-07-09T00:00:00Z"),
      ],
      { asOf: "2026-07-10T00:00:00Z" },
    ).find((row) => row.source === "unknown");

    expect(unknown?.sevenDayActivity.numerator).toBe(0);
  });

  it("validates the activity window", () => {
    expect(() =>
      buildSourcePerformanceTable([], {
        asOf: "2026-07-10T00:00:00Z",
        activeWindowDays: 0,
      }),
    ).toThrow("activeWindowDays must be a positive integer");
  });
});

describe("lesson performance table", () => {
  const lessonEvents: AnalyticsEvent[] = [
    event("s1", "a", "lesson_started", "2026-07-01T00:00:00Z", {
      lessonId: "l1",
    }),
    event("s2", "b", "lesson_started", "2026-07-01T00:00:00Z", {
      lessonId: "l1",
    }),
    event("v1", "a", "video_completed", "2026-07-01T00:05:00Z", {
      lessonId: "l1",
    }),
    event("q1", "a", "quiz_submitted", "2026-07-01T00:10:00Z", {
      lessonId: "l1",
      attempt: 1,
      passed: false,
    }),
    event("q2", "a", "quiz_submitted", "2026-07-01T00:15:00Z", {
      lessonId: "l1",
      attempt: 2,
      passed: true,
    }),
    event("q3", "b", "quiz_submitted", "2026-07-01T00:11:00Z", {
      lessonId: "l1",
      attempt: 1,
      passed: true,
    }),
    event("c1", "a", "lesson_completed", "2026-07-01T00:20:00Z", {
      lessonId: "l1",
    }),
    event("c2", "b", "lesson_completed", "2026-07-01T00:40:00Z", {
      lessonId: "l1",
    }),
    event("next", "a", "lesson_started", "2026-07-02T00:00:00Z", {
      lessonId: "l2",
    }),
  ];

  it("calculates starts, marks, attempts, pass, time, and next-lesson drop-off", () => {
    const [lesson] = buildLessonPerformanceTable(lessonEvents, ["l1", "l2"]);
    expect(lesson).toEqual({
      lessonId: "l1",
      nextLessonId: "l2",
      startedLearners: 2,
      videoMarkedLearners: 1,
      quizAttempts: 3,
      firstAttemptPass: {
        numerator: 1,
        denominator: 2,
        rate: { status: "available", value: 0.5 },
      },
      overallPass: {
        numerator: 2,
        denominator: 2,
        rate: { status: "available", value: 1 },
      },
      averageAttemptsToPass: 1.5,
      medianCompletionMinutes: 30,
      dropOffLearners: 1,
      dropOffRate: { status: "available", value: 0.5 },
    });
  });

  it("uses event time when attempt numbers are absent", () => {
    const [lesson] = buildLessonPerformanceTable([
      event("late", "a", "quiz_submitted", "2026-07-01T00:02:00Z", {
        lessonId: "l1",
        passed: true,
      }),
      event("early", "a", "quiz_submitted", "2026-07-01T00:01:00Z", {
        lessonId: "l1",
        passed: false,
      }),
    ]);
    expect(lesson.firstAttemptPass.numerator).toBe(0);
    expect(lesson.averageAttemptsToPass).toBe(2);
  });

  it("represents absent attempts and completion as unavailable", () => {
    const [lesson] = buildLessonPerformanceTable(
      [
        event("start", "a", "lesson_started", "2026-07-01T00:00:00Z", {
          lessonId: "l1",
        }),
      ],
      ["l1"],
    );
    expect(lesson.firstAttemptPass.rate).toMatchObject({
      status: "unavailable",
      reason: "zero-denominator",
    });
    expect(lesson.averageAttemptsToPass).toBeNull();
    expect(lesson.medianCompletionMinutes).toBeNull();
    expect(lesson.dropOffLearners).toBe(1);
  });

  it("returns an empty table with no lessons", () => {
    expect(buildLessonPerformanceTable([])).toEqual([]);
  });
});

describe("operational queue cards", () => {
  it("publishes all eight queues, counts unique items, and reports oldest age", () => {
    const items: OperationalQueueItem[] = [
      {
        queueId: "pending-uid",
        itemId: "a",
        createdAt: "2026-07-30T08:00:00Z",
      },
      {
        queueId: "pending-uid",
        itemId: "b",
        createdAt: "2026-07-30T09:30:00Z",
      },
      {
        queueId: "pending-uid",
        itemId: "a",
        createdAt: "2026-07-30T08:30:00Z",
      },
      {
        queueId: "alerts",
        itemId: "alert-1",
        createdAt: "2026-07-30T09:00:00Z",
      },
    ];
    const cards = buildOperationalQueueCards(
      items,
      "2026-07-30T10:00:00Z",
    );

    expect(cards.map((card) => card.id)).toEqual(operationalQueueIds);
    expect(cards).toHaveLength(8);
    expect(cards[0]).toMatchObject({
      id: "pending-uid",
      count: 2,
      oldestAgeMinutes: 120,
      responsibleRole: "assistant",
      actionPath: "/learners?uid-status=pending&sort=oldest",
    });
    expect(cards.find((card) => card.id === "alerts")).toMatchObject({
      count: 1,
      oldestAgeMinutes: 60,
      responsibleRole: "owner",
    });
  });

  it("keeps empty queues visible", () => {
    const cards = buildOperationalQueueCards([], "2026-07-30T10:00:00Z");
    expect(cards.every((card) => card.count === 0)).toBe(true);
    expect(cards.every((card) => card.oldestAgeMinutes === null)).toBe(true);
  });

  it("rejects malformed and future queue items", () => {
    expect(() =>
      buildOperationalQueueCards(
        [
          {
            queueId: "alerts",
            itemId: "",
            createdAt: "2026-07-30T09:00:00Z",
          },
        ],
        "2026-07-30T10:00:00Z",
      ),
    ).toThrow("itemId is required");
    expect(() =>
      buildOperationalQueueCards(
        [
          {
            queueId: "alerts",
            itemId: "future",
            createdAt: "2026-07-30T11:00:00Z",
          },
        ],
        "2026-07-30T10:00:00Z",
      ),
    ).toThrow("cannot be after asOf");
  });
});
