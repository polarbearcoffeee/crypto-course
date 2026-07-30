import { z } from "zod";
import { learningEventSchema } from "./events";

const idSchema = z.string().trim().min(1).max(128);
const labelSchema = z.string().trim().min(1).max(200);
const dateTimeSchema = z.string().datetime({ offset: true });
const versionSchema = z.string().trim().min(1).max(64);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const learnerSchema = z.object({
  learnerId: idSchema,
  legacyLearnerId: idSchema.optional(),
  nickname: labelSchema,
  sourceFirst: idSchema,
  sourceLatest: idSchema,
  status: z.enum(["active", "paused", "blocked", "deleted-pending-retention"]),
  learningState: z.enum([
    "registered",
    "activated",
    "in-progress",
    "stuck",
    "completed",
    "inactive",
  ]),
  uidStatus: z.enum(["pending", "verified", "rejected", "needs-correction"]),
  currentCourseId: idSchema.optional(),
  currentLessonId: idSchema.optional(),
  lastActiveAt: dateTimeSchema.optional(),
  tags: z.array(idSchema).default([]),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const privateLearnerSchema = z.object({
  learnerId: idSchema,
  uidCurrent: idSchema.optional(),
  uidNormalized: idSchema.optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(5).max(32).optional(),
  contactConsentAt: dateTimeSchema.optional(),
  updatedAt: dateTimeSchema,
});

export const uidVerificationSchema = z
  .object({
    verificationId: idSchema,
    learnerId: idSchema,
    status: z.enum(["pending", "verified", "rejected", "needs-correction"]),
    uidValue: idSchema,
    uidNormalized: idSchema,
    evidenceReference: z.string().trim().min(1).max(500).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
    verifierId: idSchema.optional(),
    submittedAt: dateTimeSchema,
    verifiedAt: dateTimeSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "verified" && (!value.verifierId || !value.verifiedAt)) {
      context.addIssue({
        code: "custom",
        message: "Verified UID requires verifierId and verifiedAt.",
      });
    }
    if (
      (value.status === "rejected" || value.status === "needs-correction") &&
      !value.reason
    ) {
      context.addIssue({
        code: "custom",
        message: "Rejected or correction-required UID needs a reason.",
      });
    }
  });

export { learningEventSchema };

export const xpLedgerEntrySchema = z.object({
  ledgerEntryId: idSchema,
  learnerId: idSchema,
  ruleId: idSchema,
  ruleVersion: versionSchema,
  eventId: idSchema.optional(),
  idempotencyKey: idSchema,
  amount: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  reason: labelSchema,
  createdAt: dateTimeSchema,
});

export const learnerProgressSchema = z.object({
  learnerId: idSchema,
  courseId: idSchema,
  courseVersion: versionSchema,
  lessonId: idSchema,
  quizVersion: versionSchema.optional(),
  watchedAt: dateTimeSchema.optional(),
  passedAt: dateTimeSchema.optional(),
  completedAt: dateTimeSchema.optional(),
  attempts: z.number().int().nonnegative(),
  evidence: z.enum(["event-backed", "legacy-import"]),
  updatedAt: dateTimeSchema,
});

const quizQuestionSchema = z.object({
  questionId: idSchema,
  prompt: labelSchema,
  options: z.array(labelSchema).min(2),
  correctOptionIndex: z.number().int().nonnegative(),
  explanation: labelSchema,
});

const lessonSchema = z.object({
  lessonId: idSchema,
  title: labelSchema,
  order: z.number().int().nonnegative(),
  videoUrl: z.string().url(),
  durationSeconds: z.number().int().positive(),
  questions: z.array(quizQuestionSchema).min(1),
});

const curriculumContentSchema = z.object({
  courseId: idSchema,
  title: labelSchema,
  description: z.string().trim().min(1).max(2_000),
  passingScore: z.number().min(0).max(100),
  lessons: z.array(lessonSchema).min(1),
});

export const curriculumDraftSchema = z.object({
  draftId: idSchema,
  courseId: idSchema,
  baseVersion: versionSchema.optional(),
  status: z.enum(["draft", "in-review", "scheduled", "archived"]),
  content: curriculumContentSchema,
  editorId: idSchema,
  scheduledAt: dateTimeSchema.optional(),
  updatedAt: dateTimeSchema,
});

export const curriculumVersionSchema = z.object({
  versionId: versionSchema,
  courseId: idSchema,
  content: curriculumContentSchema,
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  publisherId: idSchema,
  publishedAt: dateTimeSchema,
  note: z.string().trim().max(500).default(""),
});

export const adminUserSchema = z.object({
  uid: idSchema,
  displayName: labelSchema,
  roles: z
    .array(z.enum(["owner", "lead-teacher", "assistant", "content-editor", "analyst"]))
    .min(1),
  status: z.enum(["invited", "active", "suspended", "revoked"]),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const auditLogSchema = z.object({
  auditId: idSchema,
  actorId: idSchema,
  action: idSchema,
  targetType: idSchema,
  targetId: idSchema,
  before: jsonObjectSchema.nullable(),
  after: jsonObjectSchema.nullable(),
  reason: labelSchema,
  requestId: idSchema,
  result: z.enum(["success", "failure", "partial"]),
  occurredAt: dateTimeSchema,
});

export const settingsVersionSchema = z.object({
  version: versionSchema,
  rules: z.object({
    passingScore: z.number().min(0).max(100),
    stuckAfterDays: z.number().int().positive(),
    activeWindowDays: z.number().int().positive(),
    requireVideoCompletion: z.boolean(),
    xp: z.record(z.string(), z.number().int().nonnegative()),
  }),
  actorId: idSchema,
  reason: labelSchema,
  activatedAt: dateTimeSchema,
});

export const metricAggregateSchema = z.object({
  metricId: idSchema,
  metricName: z.enum([
    "registered",
    "uid-verification-rate",
    "activated",
    "seven-day-active",
    "beginner-completion",
    "stuck",
    "advanced-eligible",
    "retention",
    "source-performance",
    "lesson-performance",
    "question-performance",
  ]),
  metricVersion: versionSchema,
  granularity: z.enum(["daily", "cohort", "lesson"]),
  dimensions: z.record(z.string(), z.string()),
  numerator: z.number().nonnegative(),
  denominator: z.number().nonnegative().optional(),
  value: z.number().nonnegative(),
  asOf: dateTimeSchema,
});

export const alertSchema = z.object({
  alertId: idSchema,
  type: z.enum([
    "failed-sync",
    "stale-metrics",
    "media-failure",
    "publish-failure",
    "abnormal-xp",
    "reconciliation-mismatch",
    "pending-uid-growth",
  ]),
  severity: z.enum(["info", "warning", "critical"]),
  state: z.enum(["open", "acknowledged", "resolved"]),
  count: z.number().int().positive(),
  firstSeenAt: dateTimeSchema,
  lastSeenAt: dateTimeSchema,
  ownerRole: z.enum(["owner", "lead-teacher", "content-editor"]),
  link: z.string().startsWith("/"),
});

export const dataQualityIssueSchema = z.object({
  issueId: idSchema,
  type: z.enum([
    "malformed-learner",
    "missing-source",
    "unknown-lesson",
    "duplicate-uid-candidate",
    "summary-ledger-mismatch",
    "failed-migration",
  ]),
  recordId: idSchema,
  severity: z.enum(["low", "medium", "high", "critical"]),
  state: z.enum(["open", "investigating", "resolved", "ignored"]),
  sample: jsonObjectSchema.optional(),
  detectedAt: dateTimeSchema,
  resolvedAt: dateTimeSchema.optional(),
});

export type Learner = z.infer<typeof learnerSchema>;
export type PrivateLearner = z.infer<typeof privateLearnerSchema>;
export type UidVerification = z.infer<typeof uidVerificationSchema>;
export type XpLedgerEntry = z.infer<typeof xpLedgerEntrySchema>;
export type LearnerProgress = z.infer<typeof learnerProgressSchema>;
export type CurriculumDraft = z.infer<typeof curriculumDraftSchema>;
export type CurriculumVersion = z.infer<typeof curriculumVersionSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type SettingsVersion = z.infer<typeof settingsVersionSchema>;
export type MetricAggregate = z.infer<typeof metricAggregateSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type DataQualityIssue = z.infer<typeof dataQualityIssueSchema>;
