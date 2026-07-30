import { describe, expect, it } from "vitest";
import {
  canonicalEventNames,
  eventRequiredFields,
  learningEventSchema,
  METRIC_DEFINITION_VERSION,
} from "./events";

const envelope = {
  eventId: "event-1",
  learnerId: "learner-1",
  occurredAt: "2026-07-30T02:00:00+00:00",
  receivedAt: "2026-07-30T02:00:01+00:00",
  schemaVersion: 1 as const,
  metricDefinitionVersion: METRIC_DEFINITION_VERSION,
  source: "learner-web" as const,
  idempotencyKey: "device-event-1",
};

describe("learning event contract", () => {
  it("accepts a canonical lesson event", () => {
    const result = learningEventSchema.safeParse({
      ...envelope,
      type: "lesson_started",
      properties: {
        courseId: "beginner",
        courseVersion: "v1",
        lessonId: "lesson-1",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an event missing type-specific required fields", () => {
    const result = learningEventSchema.safeParse({
      ...envelope,
      type: "quiz_passed",
      properties: {
        courseId: "beginner",
        courseVersion: "v1",
        lessonId: "lesson-1",
        score: 90,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown event or metric version", () => {
    expect(
      learningEventSchema.safeParse({
        ...envelope,
        type: "page_clicked",
        properties: {},
      }).success,
    ).toBe(false);

    expect(
      learningEventSchema.safeParse({
        ...envelope,
        metricDefinitionVersion: "2.0.0",
        type: "lesson_completed",
        properties: {
          courseId: "beginner",
          courseVersion: "v1",
          lessonId: "lesson-1",
        },
      }).success,
    ).toBe(false);
  });

  it("publishes required-field metadata for every event name", () => {
    expect(Object.keys(eventRequiredFields).sort()).toEqual(
      [...canonicalEventNames].sort(),
    );
  });
});
