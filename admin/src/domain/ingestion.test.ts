import { describe, expect, it } from "vitest";
import { METRIC_DEFINITION_VERSION } from "./events";
import {
  ingestLearningEvent,
  validateTrustedWrite,
} from "./ingestion";
import { learnerSchema } from "./schemas";

const authentication = {
  actorId: "auth-user-1",
  learnerId: "learner-1",
  source: "learner-web" as const,
};

const payload = {
  type: "lesson_started" as const,
  occurredAt: "2026-07-30T02:00:00+00:00",
  schemaVersion: 1 as const,
  metricDefinitionVersion: METRIC_DEFINITION_VERSION,
  idempotencyKey: "device-event-1",
  properties: {
    courseId: "beginner",
    courseVersion: "v1",
    lessonId: "lesson-1",
  },
};

describe("trusted write validation", () => {
  it("accepts valid records using the existing domain schemas", () => {
    const learner = validateTrustedWrite(learnerSchema, {
      learnerId: "learner-1",
      nickname: "學員一",
      sourceFirst: "youtube",
      sourceLatest: "youtube",
      status: "active",
      learningState: "registered",
      uidStatus: "pending",
      createdAt: "2026-07-30T02:00:00+00:00",
      updatedAt: "2026-07-30T02:00:00+00:00",
    });

    expect(learner.learnerId).toBe("learner-1");
  });

  it("rejects malformed records at the trusted boundary", () => {
    expect(() =>
      validateTrustedWrite(learnerSchema, {
        learnerId: "",
        nickname: "學員一",
      }),
    ).toThrow();
  });
});

describe("trusted learning-event ingestion", () => {
  it("adds authenticated identity and a server-controlled timestamp", () => {
    const event = ingestLearningEvent(
      payload,
      authentication,
      new Date("2026-07-30T02:00:05.000Z"),
    );

    expect(event).toMatchObject({
      learnerId: "learner-1",
      source: "learner-web",
      receivedAt: "2026-07-30T02:00:05.000Z",
      type: "lesson_started",
      properties: payload.properties,
    });
    expect(event.eventId).toMatch(/^event-[a-f0-9]{8}$/);
  });

  it("creates the same event ID for retries of the same authenticated event", () => {
    const first = ingestLearningEvent(payload, authentication);
    const retry = ingestLearningEvent(payload, authentication);
    const anotherLearner = ingestLearningEvent(payload, {
      ...authentication,
      learnerId: "learner-2",
    });

    expect(retry.eventId).toBe(first.eventId);
    expect(anotherLearner.eventId).not.toBe(first.eventId);
  });

  it("rejects malformed event properties", () => {
    expect(() =>
      ingestLearningEvent(
        {
          ...payload,
          type: "quiz_passed",
          properties: { score: 90 },
        },
        authentication,
      ),
    ).toThrow();
  });

  it("rejects unauthenticated or malformed authentication context", () => {
    expect(() => ingestLearningEvent(payload, undefined)).toThrow();
    expect(() =>
      ingestLearningEvent(payload, {
        actorId: "",
        learnerId: "learner-1",
        source: "learner-web",
      }),
    ).toThrow();
  });

  it("rejects attempts to spoof server-controlled fields", () => {
    expect(() =>
      ingestLearningEvent(
        {
          ...payload,
          eventId: "chosen-by-client",
          learnerId: "victim",
          receivedAt: "2020-01-01T00:00:00.000Z",
          source: "system",
        },
        authentication,
      ),
    ).toThrow();
  });

  it("rejects invalid server timestamps", () => {
    expect(() =>
      ingestLearningEvent(payload, authentication, new Date("invalid")),
    ).toThrow("Server timestamp must be a valid Date.");
  });
});
