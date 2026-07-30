import { describe, expect, it } from "vitest";
import {
  buildLearner360Detail,
  correctUidVerification,
  createPendingUidVerification,
  reviewUidVerification,
} from "./learnerWorkflows";

const T0 = "2026-07-30T01:00:00.000Z";
const T1 = "2026-07-30T02:00:00.000Z";
const T2 = "2026-07-30T03:00:00.000Z";

describe("learner 360 detail", () => {
  it("aggregates all required sections and sorts timeline newest first", () => {
    const detail = buildLearner360Detail({
      learnerId: "learner-1",
      nickname: " Penguin ",
      status: "active",
      tags: ["vip", "stuck", "vip", " "],
      progress: [{ lessonId: "lesson-1", completed: true }],
      timeline: [
        { id: "old", type: "joined", occurredAt: T0, summary: "joined" },
        { id: "new", type: "passed", occurredAt: T2, summary: "passed" },
      ],
      quizAttempts: [{ attempt: 1, score: 80 }],
      xpLedger: [{ amount: 30, reason: "quiz" }],
      streak: { currentDays: 3, longestDays: 8 },
      badges: [{ badgeId: "starter" }],
      notes: [{ noteId: "note-1", body: "follow up" }],
      audit: [{ auditId: "audit-1", action: "status.updated" }],
    });

    expect(detail.profile).toEqual({
      nickname: "Penguin",
      status: "active",
      tags: ["vip", "stuck"],
    });
    expect(detail.timeline.map((item) => item.id)).toEqual(["new", "old"]);
    expect(detail.progress).toHaveLength(1);
    expect(detail.quizAttempts).toHaveLength(1);
    expect(detail.xpLedger).toHaveLength(1);
    expect(detail.streak).toEqual({ currentDays: 3, longestDays: 8 });
    expect(detail.badges).toHaveLength(1);
    expect(detail.notes).toHaveLength(1);
    expect(detail.audit).toHaveLength(1);
    expect(Object.isFrozen(detail.profile.tags)).toBe(true);
  });

  it("rejects invalid identity and streak values", () => {
    const base = {
      learnerId: "learner-1",
      nickname: "Penguin",
      status: "active" as const,
      tags: [],
      progress: [],
      timeline: [],
      quizAttempts: [],
      xpLedger: [],
      streak: { currentDays: -1, longestDays: 0 },
      badges: [],
      notes: [],
      audit: [],
    };
    expect(() => buildLearner360Detail(base)).toThrow("streak");
  });
});

describe("UID verification workflow", () => {
  it.each(["verified", "rejected", "needs-correction"] as const)(
    "moves pending UID to %s with actor, time, reason and evidence",
    (action) => {
      const pending = createPendingUidVerification({
        verificationId: "verify-1",
        learnerId: "learner-1",
        uidValue: " ABC 123 ",
        submittedAt: T0,
        evidenceReference: " evidence://submission ",
      });
      const result = reviewUidVerification(pending, {
        transitionId: `transition-${action}`,
        action,
        actorId: "admin-1",
        occurredAt: T1,
        reason: action === "verified" ? undefined : "資料不符",
        evidenceReference: "evidence://review",
      });

      expect(result.status).toBe(action);
      expect(result.actorId).toBe("admin-1");
      expect(result.updatedAt).toBe(T1);
      expect(result.evidenceReference).toBe("evidence://review");
      expect(result.history[0]).toMatchObject({
        from: "pending",
        to: action,
        actorId: "admin-1",
        occurredAt: T1,
      });
    },
  );

  it("requires a reason for rejection and correction requests", () => {
    const pending = createPendingUidVerification({
      verificationId: "verify-1",
      learnerId: "learner-1",
      uidValue: "123",
      submittedAt: T0,
    });
    expect(() =>
      reviewUidVerification(pending, {
        transitionId: "transition-1",
        action: "rejected",
        actorId: "admin-1",
        occurredAt: T1,
      }),
    ).toThrow("requires a reason");
  });

  it("does not allow a completed review to be reviewed again", () => {
    const pending = createPendingUidVerification({
      verificationId: "verify-1",
      learnerId: "learner-1",
      uidValue: "123",
      submittedAt: T0,
    });
    const verified = reviewUidVerification(pending, {
      transitionId: "transition-1",
      action: "verified",
      actorId: "admin-1",
      occurredAt: T1,
    });
    expect(() =>
      reviewUidVerification(verified, {
        transitionId: "transition-2",
        action: "rejected",
        actorId: "admin-2",
        occurredAt: T2,
        reason: "late change",
      }),
    ).toThrow("Only pending");
  });
});

describe("UID correction workflow", () => {
  it("preserves old and new values and resets needs-correction to pending", () => {
    const pending = createPendingUidVerification({
      verificationId: "verify-1",
      learnerId: "learner-1",
      uidValue: "OLD-001",
      submittedAt: T0,
    });
    const needsCorrection = reviewUidVerification(pending, {
      transitionId: "transition-review",
      action: "needs-correction",
      actorId: "admin-1",
      occurredAt: T1,
      reason: "末碼錯誤",
    });
    const result = correctUidVerification(needsCorrection, {
      correctionId: "correction-1",
      transitionId: "transition-correction",
      newUidValue: " NEW-002 ",
      actorId: "learner-1",
      reason: "依提醒修正",
      occurredAt: T2,
      evidenceReference: "evidence://corrected",
    });

    expect(result.record).toMatchObject({
      uidValue: "NEW-002",
      uidNormalized: "new-002",
      status: "pending",
      reason: undefined,
      evidenceReference: "evidence://corrected",
    });
    expect(result.correction).toMatchObject({
      oldUidValue: "OLD-001",
      oldUidNormalized: "old-001",
      newUidValue: "NEW-002",
      newUidNormalized: "new-002",
      actorId: "learner-1",
    });
    expect(result.record.history.map((item) => item.to)).toEqual([
      "needs-correction",
      "pending",
    ]);
  });

  it("rejects correction from verified/pending state, identical UID, and backwards time", () => {
    const pending = createPendingUidVerification({
      verificationId: "verify-1",
      learnerId: "learner-1",
      uidValue: "ABC",
      submittedAt: T0,
    });
    expect(() =>
      correctUidVerification(pending, {
        correctionId: "correction-1",
        transitionId: "transition-1",
        newUidValue: "DEF",
        actorId: "learner-1",
        reason: "fix",
        occurredAt: T1,
      }),
    ).toThrow("requires rejected or needs-correction");

    const rejected = reviewUidVerification(pending, {
      transitionId: "transition-review",
      action: "rejected",
      actorId: "admin-1",
      occurredAt: T1,
      reason: "invalid",
    });
    expect(() =>
      correctUidVerification(rejected, {
        correctionId: "correction-2",
        transitionId: "transition-2",
        newUidValue: " a b c ",
        actorId: "learner-1",
        reason: "same",
        occurredAt: T2,
      }),
    ).toThrow("must differ");
    expect(() =>
      correctUidVerification(rejected, {
        correctionId: "correction-3",
        transitionId: "transition-3",
        newUidValue: "DEF",
        actorId: "learner-1",
        reason: "fix",
        occurredAt: T0,
      }),
    ).toThrow("cannot move backwards");
  });
});
