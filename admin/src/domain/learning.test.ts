import { describe, expect, it } from "vitest";
import {
  acceptLearningEvent,
  deriveLearnerProgress,
  emptyLearningState,
  type LearningEvent,
} from "./learning";

const baseEvent: LearningEvent = {
  eventId: "event-1",
  type: "lesson_started",
  learnerId: "learner-1",
  courseVersion: "course-v1",
  lessonId: "lesson-1",
  occurredAt: "2026-07-30T02:00:00.000Z",
  receivedAt: "2026-07-30T02:00:01.000Z",
};

function event(
  overrides: Partial<LearningEvent>,
): LearningEvent {
  return { ...baseEvent, ...overrides };
}

describe("learning event and XP domain", () => {
  it("awards watch XP only once even when separate duplicate actions arrive", () => {
    const first = acceptLearningEvent(
      emptyLearningState(),
      event({
        eventId: "watch-1",
        type: "video_marked_watched",
      }),
    );
    const duplicateAction = acceptLearningEvent(
      first.state,
      event({
        eventId: "watch-2",
        type: "video_marked_watched",
        receivedAt: "2026-07-30T02:00:02.000Z",
      }),
    );

    expect(first.result.xpAwarded).toBe(10);
    expect(duplicateAction.result.xpAwarded).toBe(0);
    expect(duplicateAction.state.events).toHaveLength(2);
    expect(duplicateAction.state.xpLedger).toHaveLength(1);
    expect(first.state.events).toHaveLength(1);
  });

  it("makes a retried quiz submission idempotent", () => {
    const quiz = event({
      eventId: "quiz-1",
      type: "quiz_submitted",
      quizVersion: "quiz-v2",
      properties: { passed: true, score: 90 },
    });
    const first = acceptLearningEvent(emptyLearningState(), quiz);
    const retry = acceptLearningEvent(first.state, quiz);
    const newEventSameAttempt = acceptLearningEvent(
      retry.state,
      event({
        ...quiz,
        eventId: "quiz-2",
        receivedAt: "2026-07-30T02:00:03.000Z",
      }),
    );

    expect(first.result.xpAwarded).toBe(30);
    expect(retry.result.duplicate).toBe(true);
    expect(retry.state).toBe(first.state);
    expect(newEventSameAttempt.result.xpAwarded).toBe(0);
    expect(newEventSameAttempt.state.xpLedger).toHaveLength(1);
  });

  it("ignores stale client time and uses accepted server time", () => {
    const accepted = acceptLearningEvent(
      emptyLearningState(),
      event({
        eventId: "watch-stale-client",
        type: "video_marked_watched",
        clientOccurredAt: "1999-01-01T00:00:00.000Z",
        occurredAt: "2026-07-30T04:00:00.000Z",
        receivedAt: "2026-07-30T04:00:01.000Z",
      }),
    );
    const summary = deriveLearnerProgress(
      accepted.state.events,
      accepted.state.xpLedger,
      "learner-1",
      "course-v1",
    );

    expect(summary.lessons[0]?.watchedAt).toBe(
      "2026-07-30T04:00:00.000Z",
    );
    expect(summary.lastProgressAt).toBe("2026-07-30T04:00:00.000Z");
  });

  it("rejects malformed lesson IDs before changing state", () => {
    const initial = emptyLearningState();

    expect(() =>
      acceptLearningEvent(
        initial,
        event({ lessonId: "../lesson/1" }),
      ),
    ).toThrow("Malformed lesson ID");
    expect(initial.events).toHaveLength(0);
    expect(initial.xpLedger).toHaveLength(0);
  });

  it("derives stable progress from out-of-order accepted events", () => {
    const completed = event({
      eventId: "complete-1",
      type: "lesson_completed",
      occurredAt: "2026-07-30T05:00:00.000Z",
      receivedAt: "2026-07-30T05:00:05.000Z",
    });
    const started = event({
      eventId: "start-1",
      occurredAt: "2026-07-30T03:00:00.000Z",
      receivedAt: "2026-07-30T05:00:06.000Z",
    });
    const passed = event({
      eventId: "quiz-pass-1",
      type: "quiz_submitted",
      quizVersion: "quiz-v1",
      properties: { passed: true },
      occurredAt: "2026-07-30T04:00:00.000Z",
      receivedAt: "2026-07-30T05:00:07.000Z",
    });

    const afterCompleted = acceptLearningEvent(
      emptyLearningState(),
      completed,
    );
    const afterStarted = acceptLearningEvent(afterCompleted.state, started);
    const afterPassed = acceptLearningEvent(afterStarted.state, passed);
    const summary = deriveLearnerProgress(
      afterPassed.state.events,
      afterPassed.state.xpLedger,
      "learner-1",
      "course-v1",
    );

    expect(summary.lessons[0]).toMatchObject({
      startedAt: "2026-07-30T03:00:00.000Z",
      passedAt: "2026-07-30T04:00:00.000Z",
      completedAt: "2026-07-30T05:00:00.000Z",
      completed: true,
      quizAttempts: 1,
    });
    expect(summary.completedLessonCount).toBe(1);
    expect(summary.lastProgressAt).toBe("2026-07-30T05:00:00.000Z");
    expect(summary.totalXp).toBe(50);
  });
});
