export type LearnerReadRequest =
  | Readonly<{
      type: "document";
      resource: "current-curriculum";
    }>
  | Readonly<{
      type: "document";
      resource: "learner-summary";
      learnerId: string;
    }>
  | Readonly<{
      type: "bounded-query";
      resource: "leaderboard";
      orderBy: "xp-desc";
      limit: number;
    }>;

export type LearnerAction =
  | Readonly<{
      type: "register";
      sourceFirst: string;
      sourceLatest: string;
    }>
  | Readonly<{ type: "submit-uid"; uid: string }>
  | Readonly<{
      type: "complete-video";
      lessonId: string;
      watchedSeconds: number;
      durationSeconds: number;
    }>
  | Readonly<{
      type: "submit-quiz";
      lessonId: string;
      quizVersion: string;
      attempt: number;
      score: number;
    }>
  | Readonly<{
      type: "record-check-in";
      reportingDate: string;
      streakDays: number;
    }>;

export type LearnerCommand = Readonly<{
  type: "submit-event";
  trigger: "user-action";
  learnerId: string;
  courseId: string;
  courseVersion: string;
  idempotencyKey: string;
  event:
    | Readonly<{
        type: "registration_submitted";
        properties: { sourceFirst: string; sourceLatest: string };
      }>
    | Readonly<{
        type: "uid_submitted";
        properties: { uidNormalized: string };
      }>
    | Readonly<{
        type: "video_completed";
        properties: {
          courseId: string;
          courseVersion: string;
          lessonId: string;
          watchedSeconds: number;
          durationSeconds: number;
        };
      }>
    | Readonly<{
        type: "quiz_submitted";
        properties: {
          courseId: string;
          courseVersion: string;
          lessonId: string;
          quizVersion: string;
          attempt: number;
          score: number;
        };
      }>
    | Readonly<{
        type: "check_in_recorded";
        properties: { reportingDate: string; streakDays: number };
      }>;
}>;

export type LearnerRenderSnapshot = Readonly<{
  learnerId: string;
  nickname: string;
  xp: number;
  completedLessonCount: number;
  totalLessonCount: number;
  uidStatus: "pending" | "verified" | "rejected" | "needs-correction";
}>;

export type LearnerRenderModel = Readonly<{
  nickname: string;
  xpLabel: string;
  progressLabel: string;
  uidStatus: LearnerRenderSnapshot["uidStatus"];
}>;

export function buildLearnerReadPlan(
  learnerId: string,
  leaderboardLimit = 50,
): readonly LearnerReadRequest[] {
  requireText(learnerId, "Learner ID");
  if (
    !Number.isSafeInteger(leaderboardLimit) ||
    leaderboardLimit < 1 ||
    leaderboardLimit > 100
  ) {
    throw new Error("Leaderboard limit must be an integer from 1 to 100.");
  }
  return Object.freeze([
    Object.freeze({ type: "document", resource: "current-curriculum" }),
    Object.freeze({
      type: "document",
      resource: "learner-summary",
      learnerId,
    }),
    Object.freeze({
      type: "bounded-query",
      resource: "leaderboard",
      orderBy: "xp-desc",
      limit: leaderboardLimit,
    }),
  ]);
}

export function adaptLearnerAction(input: Readonly<{
  learnerId: string;
  courseId: string;
  courseVersion: string;
  actionId: string;
  action: LearnerAction;
}>): LearnerCommand {
  const learnerId = requireText(input.learnerId, "Learner ID");
  const courseId = requireText(input.courseId, "Course ID");
  const courseVersion = requireText(input.courseVersion, "Course version");
  const actionId = requireText(input.actionId, "Action ID");
  const base = {
    type: "submit-event" as const,
    trigger: "user-action" as const,
    learnerId,
    courseId,
    courseVersion,
    idempotencyKey: `${learnerId}:${actionId}`,
  };

  switch (input.action.type) {
    case "register":
      return freezeCommand({
        ...base,
        event: {
          type: "registration_submitted",
          properties: {
            sourceFirst: requireText(input.action.sourceFirst, "First source"),
            sourceLatest: requireText(input.action.sourceLatest, "Latest source"),
          },
        },
      });
    case "submit-uid":
      return freezeCommand({
        ...base,
        event: {
          type: "uid_submitted",
          properties: { uidNormalized: normalizeUid(input.action.uid) },
        },
      });
    case "complete-video":
      requirePositiveDuration(input.action);
      return freezeCommand({
        ...base,
        event: {
          type: "video_completed",
          properties: {
            courseId,
            courseVersion,
            lessonId: requireText(input.action.lessonId, "Lesson ID"),
            watchedSeconds: input.action.watchedSeconds,
            durationSeconds: input.action.durationSeconds,
          },
        },
      });
    case "submit-quiz":
      if (!Number.isSafeInteger(input.action.attempt) || input.action.attempt < 1) {
        throw new Error("Quiz attempt must be a positive integer.");
      }
      if (input.action.score < 0 || input.action.score > 100) {
        throw new Error("Quiz score must be between 0 and 100.");
      }
      return freezeCommand({
        ...base,
        event: {
          type: "quiz_submitted",
          properties: {
            courseId,
            courseVersion,
            lessonId: requireText(input.action.lessonId, "Lesson ID"),
            quizVersion: requireText(input.action.quizVersion, "Quiz version"),
            attempt: input.action.attempt,
            score: input.action.score,
          },
        },
      });
    case "record-check-in":
      if (
        !isValidDateOnly(input.action.reportingDate) ||
        !Number.isSafeInteger(input.action.streakDays) ||
        input.action.streakDays < 1
      ) {
        throw new Error("Check-in requires a reporting date and positive streak.");
      }
      return freezeCommand({
        ...base,
        event: {
          type: "check_in_recorded",
          properties: {
            reportingDate: input.action.reportingDate,
            streakDays: input.action.streakDays,
          },
        },
      });
  }
}

/**
 * Render code calls this projection only. It cannot create a write command and
 * has no datastore dependency, so re-rendering is side-effect free.
 */
export function projectLearnerRenderModel(
  snapshot: LearnerRenderSnapshot,
): LearnerRenderModel {
  requireText(snapshot.learnerId, "Learner ID");
  if (
    !Number.isSafeInteger(snapshot.xp) ||
    snapshot.xp < 0 ||
    !Number.isSafeInteger(snapshot.completedLessonCount) ||
    snapshot.completedLessonCount < 0 ||
    !Number.isSafeInteger(snapshot.totalLessonCount) ||
    snapshot.totalLessonCount < snapshot.completedLessonCount
  ) {
    throw new Error("Learner snapshot contains invalid counters.");
  }
  return Object.freeze({
    nickname: snapshot.nickname.trim() || "學員",
    xpLabel: `${snapshot.xp} XP`,
    progressLabel: `${snapshot.completedLessonCount} / ${snapshot.totalLessonCount}`,
    uidStatus: snapshot.uidStatus,
  });
}

function normalizeUid(value: string): string {
  return requireText(value, "UID").replace(/\s+/g, "").toLowerCase();
}

function requirePositiveDuration(value: {
  watchedSeconds: number;
  durationSeconds: number;
}) {
  if (
    !Number.isSafeInteger(value.watchedSeconds) ||
    value.watchedSeconds < 0 ||
    !Number.isSafeInteger(value.durationSeconds) ||
    value.durationSeconds < 1 ||
    value.watchedSeconds > value.durationSeconds
  ) {
    throw new Error("Video duration counters are invalid.");
  }
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function freezeCommand(command: LearnerCommand): LearnerCommand {
  Object.freeze(command.event.properties);
  Object.freeze(command.event);
  return Object.freeze(command);
}
