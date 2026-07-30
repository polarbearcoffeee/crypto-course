import { describe, expect, it } from "vitest";
import {
  adminUserSchema,
  alertSchema,
  auditLogSchema,
  curriculumDraftSchema,
  dataQualityIssueSchema,
  learnerProgressSchema,
  learnerSchema,
  metricAggregateSchema,
  privateLearnerSchema,
  settingsVersionSchema,
  uidVerificationSchema,
  xpLedgerEntrySchema,
} from "./schemas";

const now = "2026-07-30T02:00:00+00:00";

describe("domain schemas", () => {
  it("accepts valid learner, private learner and UID records", () => {
    expect(
      learnerSchema.safeParse({
        learnerId: "learner-1",
        nickname: "小明",
        sourceFirst: "youtube",
        sourceLatest: "discord",
        status: "active",
        learningState: "in-progress",
        uidStatus: "verified",
        tags: ["本週追蹤"],
        createdAt: now,
        updatedAt: now,
      }).success,
    ).toBe(true);

    expect(
      privateLearnerSchema.safeParse({
        learnerId: "learner-1",
        uidCurrent: "123456",
        uidNormalized: "123456",
        email: "learner@example.com",
        updatedAt: now,
      }).success,
    ).toBe(true);

    expect(
      uidVerificationSchema.safeParse({
        verificationId: "verification-1",
        learnerId: "learner-1",
        status: "verified",
        uidValue: "123456",
        uidNormalized: "123456",
        verifierId: "admin-1",
        submittedAt: now,
        verifiedAt: now,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid learner and incomplete UID decisions", () => {
    expect(
      learnerSchema.safeParse({
        learnerId: "",
        nickname: "",
        status: "unknown",
      }).success,
    ).toBe(false);

    expect(
      uidVerificationSchema.safeParse({
        verificationId: "verification-1",
        learnerId: "learner-1",
        status: "rejected",
        uidValue: "123456",
        uidNormalized: "123456",
        submittedAt: now,
      }).success,
    ).toBe(false);
  });

  it("accepts progress, XP and curriculum records", () => {
    expect(
      xpLedgerEntrySchema.safeParse({
        ledgerEntryId: "xp-1",
        learnerId: "learner-1",
        ruleId: "quiz-pass",
        ruleVersion: "v1",
        eventId: "event-1",
        idempotencyKey: "xp-event-1",
        amount: 20,
        balanceAfter: 120,
        reason: "測驗通過",
        createdAt: now,
      }).success,
    ).toBe(true);

    expect(
      learnerProgressSchema.safeParse({
        learnerId: "learner-1",
        courseId: "beginner",
        courseVersion: "v1",
        lessonId: "lesson-1",
        attempts: 1,
        evidence: "event-backed",
        updatedAt: now,
      }).success,
    ).toBe(true);

    expect(
      curriculumDraftSchema.safeParse({
        draftId: "draft-1",
        courseId: "beginner",
        status: "draft",
        editorId: "admin-1",
        updatedAt: now,
        content: {
          courseId: "beginner",
          title: "新手課程",
          description: "交易基礎知識",
          passingScore: 80,
          lessons: [
            {
              lessonId: "lesson-1",
              title: "第一課",
              order: 0,
              videoUrl: "https://example.com/video",
              durationSeconds: 600,
              questions: [
                {
                  questionId: "question-1",
                  prompt: "風險是什麼？",
                  options: ["可能損失", "保證獲利"],
                  correctOptionIndex: 0,
                  explanation: "任何交易都有風險。",
                },
              ],
            },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it("accepts governance, metric, alert and data-quality records", () => {
    const cases = [
      adminUserSchema.safeParse({
        uid: "admin-1",
        displayName: "站長",
        roles: ["owner"],
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
      auditLogSchema.safeParse({
        auditId: "audit-1",
        actorId: "admin-1",
        action: "uid.verify",
        targetType: "uid-verification",
        targetId: "verification-1",
        before: { status: "pending" },
        after: { status: "verified" },
        reason: "人工核對完成",
        requestId: "request-1",
        result: "success",
        occurredAt: now,
      }),
      settingsVersionSchema.safeParse({
        version: "v1",
        rules: {
          passingScore: 80,
          stuckAfterDays: 7,
          activeWindowDays: 7,
          requireVideoCompletion: true,
          xp: { quizPass: 20 },
        },
        actorId: "admin-1",
        reason: "初始設定",
        activatedAt: now,
      }),
      metricAggregateSchema.safeParse({
        metricId: "2026-07-30_registered",
        metricName: "registered",
        metricVersion: "1.0.0",
        granularity: "daily",
        dimensions: { date: "2026-07-30" },
        numerator: 15,
        value: 15,
        asOf: now,
      }),
      alertSchema.safeParse({
        alertId: "alert-1",
        type: "stale-metrics",
        severity: "warning",
        state: "open",
        count: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        ownerRole: "owner",
        link: "/settings/health",
      }),
      dataQualityIssueSchema.safeParse({
        issueId: "issue-1",
        type: "unknown-lesson",
        recordId: "learner-1",
        severity: "high",
        state: "open",
        detectedAt: now,
      }),
    ];

    expect(cases.every((result) => result.success)).toBe(true);
  });

  it("rejects malformed domain records", () => {
    expect(
      xpLedgerEntrySchema.safeParse({
        ledgerEntryId: "xp-1",
        learnerId: "learner-1",
        amount: 10.5,
        balanceAfter: -1,
      }).success,
    ).toBe(false);
    expect(
      metricAggregateSchema.safeParse({
        metricId: "metric-1",
        metricName: "registered",
        metricVersion: "",
        granularity: "hourly",
        numerator: -1,
        value: -1,
        asOf: "yesterday",
      }).success,
    ).toBe(false);
    expect(
      alertSchema.safeParse({
        alertId: "alert-1",
        type: "stale-metrics",
        severity: "urgent",
        state: "open",
        count: 0,
        firstSeenAt: now,
        lastSeenAt: now,
        ownerRole: "owner",
        link: "https://unsafe.example.com",
      }).success,
    ).toBe(false);
  });
});
