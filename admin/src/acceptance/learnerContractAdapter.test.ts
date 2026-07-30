import { describe, expect, it } from "vitest";

import {
  adaptLearnerAction,
  buildLearnerReadPlan,
  projectLearnerRenderModel,
} from "./learnerContractAdapter";

describe("learner read contract", () => {
  it("uses document reads and a bounded leaderboard instead of a full collection", () => {
    const plan = buildLearnerReadPlan("synthetic-learner-001", 25);

    expect(plan).toEqual([
      { type: "document", resource: "current-curriculum" },
      {
        type: "document",
        resource: "learner-summary",
        learnerId: "synthetic-learner-001",
      },
      {
        type: "bounded-query",
        resource: "leaderboard",
        orderBy: "xp-desc",
        limit: 25,
      },
    ]);
    expect(plan.some((request) => request.type === "bounded-query")).toBe(true);
    expect(() => buildLearnerReadPlan("synthetic-learner-001", 101)).toThrow(
      "1 to 100",
    );
  });
});

describe("learner write contract", () => {
  it("creates a user-action command with a stable idempotency key", () => {
    const command = adaptLearnerAction({
      learnerId: "synthetic-learner-001",
      courseId: "beginner",
      courseVersion: "v2",
      actionId: "click-watch-lesson-1",
      action: {
        type: "complete-video",
        lessonId: "lesson-1",
        watchedSeconds: 600,
        durationSeconds: 600,
      },
    });

    expect(command).toMatchObject({
      type: "submit-event",
      trigger: "user-action",
      idempotencyKey:
        "synthetic-learner-001:click-watch-lesson-1",
      event: {
        type: "video_completed",
        properties: {
          lessonId: "lesson-1",
          watchedSeconds: 600,
          durationSeconds: 600,
        },
      },
    });
    expect(Object.isFrozen(command)).toBe(true);
  });

  it("normalizes UID without writing a full learner snapshot", () => {
    const command = adaptLearnerAction({
      learnerId: "synthetic-learner-001",
      courseId: "beginner",
      courseVersion: "v2",
      actionId: "submit-uid-1",
      action: { type: "submit-uid", uid: " ABC 123 " },
    });

    expect(command.event).toEqual({
      type: "uid_submitted",
      properties: { uidNormalized: "abc123" },
    });
    expect(command).not.toHaveProperty("progress");
    expect(command).not.toHaveProperty("xp");
  });
});

describe("side-effect-free render projection", () => {
  it("can render repeatedly without producing a write command", () => {
    const snapshot = {
      learnerId: "synthetic-learner-001",
      nickname: "測試企鵝",
      xp: 120,
      completedLessonCount: 2,
      totalLessonCount: 6,
      uidStatus: "pending" as const,
    };

    const first = projectLearnerRenderModel(snapshot);
    const second = projectLearnerRenderModel(snapshot);

    expect(first).toEqual(second);
    expect(first).toEqual({
      nickname: "測試企鵝",
      xpLabel: "120 XP",
      progressLabel: "2 / 6",
      uidStatus: "pending",
    });
    expect(first).not.toHaveProperty("type", "submit-event");
  });
});
