import { z } from "zod";

export const METRIC_DEFINITION_VERSION = "1.0.0" as const;
export const EVENT_SCHEMA_VERSION = 1 as const;

const idSchema = z.string().trim().min(1).max(128);
const dateTimeSchema = z.string().datetime({ offset: true });

const eventEnvelopeSchema = z.object({
  eventId: idSchema,
  learnerId: idSchema,
  occurredAt: dateTimeSchema,
  receivedAt: dateTimeSchema,
  schemaVersion: z.literal(EVENT_SCHEMA_VERSION),
  metricDefinitionVersion: z.literal(METRIC_DEFINITION_VERSION),
  source: z.enum(["learner-web", "admin", "migration", "system"]),
  idempotencyKey: idSchema,
});

export const eventPropertySchemas = {
  registration_submitted: z.object({
    sourceFirst: idSchema,
    sourceLatest: idSchema,
  }),
  uid_submitted: z.object({
    uidNormalized: idSchema,
  }),
  uid_verified: z.object({
    verificationId: idSchema,
    verifierId: idSchema,
  }),
  lesson_started: z.object({
    courseId: idSchema,
    courseVersion: idSchema,
    lessonId: idSchema,
  }),
  video_completed: z.object({
    courseId: idSchema,
    courseVersion: idSchema,
    lessonId: idSchema,
    watchedSeconds: z.number().int().nonnegative(),
    durationSeconds: z.number().int().positive(),
  }),
  quiz_submitted: z.object({
    courseId: idSchema,
    courseVersion: idSchema,
    lessonId: idSchema,
    quizVersion: idSchema,
    attempt: z.number().int().positive(),
    score: z.number().min(0).max(100),
  }),
  quiz_passed: z.object({
    courseId: idSchema,
    courseVersion: idSchema,
    lessonId: idSchema,
    quizVersion: idSchema,
    attempt: z.number().int().positive(),
    score: z.number().min(0).max(100),
    passingScore: z.number().min(0).max(100),
  }),
  lesson_completed: z.object({
    courseId: idSchema,
    courseVersion: idSchema,
    lessonId: idSchema,
  }),
  course_completed: z.object({
    courseId: idSchema,
    courseVersion: idSchema,
    completedLessonCount: z.number().int().positive(),
  }),
  check_in_recorded: z.object({
    reportingDate: z.string().date(),
    streakDays: z.number().int().positive(),
  }),
  advanced_eligibility_granted: z.object({
    courseId: idSchema,
    courseVersion: idSchema,
    ruleVersion: idSchema,
  }),
} as const;

export const canonicalEventNames = Object.keys(
  eventPropertySchemas,
) as Array<keyof typeof eventPropertySchemas>;

export const eventRequiredFields = {
  registration_submitted: ["sourceFirst", "sourceLatest"],
  uid_submitted: ["uidNormalized"],
  uid_verified: ["verificationId", "verifierId"],
  lesson_started: ["courseId", "courseVersion", "lessonId"],
  video_completed: [
    "courseId",
    "courseVersion",
    "lessonId",
    "watchedSeconds",
    "durationSeconds",
  ],
  quiz_submitted: [
    "courseId",
    "courseVersion",
    "lessonId",
    "quizVersion",
    "attempt",
    "score",
  ],
  quiz_passed: [
    "courseId",
    "courseVersion",
    "lessonId",
    "quizVersion",
    "attempt",
    "score",
    "passingScore",
  ],
  lesson_completed: ["courseId", "courseVersion", "lessonId"],
  course_completed: [
    "courseId",
    "courseVersion",
    "completedLessonCount",
  ],
  check_in_recorded: ["reportingDate", "streakDays"],
  advanced_eligibility_granted: [
    "courseId",
    "courseVersion",
    "ruleVersion",
  ],
} as const satisfies Record<
  keyof typeof eventPropertySchemas,
  readonly string[]
>;

const eventVariants = Object.entries(eventPropertySchemas).map(
  ([type, properties]) =>
    eventEnvelopeSchema.extend({
      type: z.literal(type),
      properties,
    }),
);

export const learningEventSchema = z.discriminatedUnion(
  "type",
  eventVariants as [
    (typeof eventVariants)[number],
    (typeof eventVariants)[number],
    ...(typeof eventVariants)[number][],
  ],
);

export type CanonicalEventName = keyof typeof eventPropertySchemas;
export type LearningEvent = z.infer<typeof learningEventSchema>;
