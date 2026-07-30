import {
  createPublishedVersion,
  validateCurriculumForPublish,
  type CurriculumContent,
  type CurriculumDraft,
  type PublishedCurriculumVersion,
  type ValidationIssue,
} from "./curriculum";

export type DraftInterruption =
  | "internal-navigation"
  | "refresh"
  | "close"
  | "save-failure"
  | "remote-update";

export type DirtyDraftGuard = Readonly<{
  dirty: boolean;
  localDraft: CurriculumDraft;
  lastSavedRevision: number;
  saveError?: string;
  remoteDraft?: CurriculumDraft;
}>;

export type DraftGuardDecision = Readonly<{
  blocked: boolean;
  requiresConfirmation: boolean;
  preserveLocalDraft: boolean;
  reason?: "unsaved-changes" | "save-failed" | "remote-update";
  actions: readonly ("stay" | "discard" | "retry-save" | "compare" | "save-as-new")[];
}>;

export function createDirtyDraftGuard(
  localDraft: CurriculumDraft,
  lastSavedRevision = localDraft.revision,
): DirtyDraftGuard {
  return {
    dirty: false,
    localDraft: structuredClone(localDraft),
    lastSavedRevision,
  };
}

export function markDraftDirty(
  guard: DirtyDraftGuard,
  localDraft: CurriculumDraft,
): DirtyDraftGuard {
  return {
    ...guard,
    dirty: true,
    localDraft: structuredClone(localDraft),
    saveError: undefined,
  };
}

export function recordDraftSaveFailure(
  guard: DirtyDraftGuard,
  message: string,
): DirtyDraftGuard {
  return {
    ...guard,
    dirty: true,
    saveError: message.trim() || "Draft save failed.",
  };
}

export function receiveRemoteDraft(
  guard: DirtyDraftGuard,
  remoteDraft: CurriculumDraft,
): DirtyDraftGuard {
  if (remoteDraft.revision <= guard.lastSavedRevision) return guard;
  return {
    ...guard,
    remoteDraft: structuredClone(remoteDraft),
  };
}

export function assessDraftInterruption(
  guard: DirtyDraftGuard,
  interruption: DraftInterruption,
): DraftGuardDecision {
  const hasRemoteUpdate =
    guard.remoteDraft !== undefined &&
    guard.remoteDraft.revision > guard.lastSavedRevision;

  if (interruption === "remote-update" && hasRemoteUpdate) {
    return {
      blocked: true,
      requiresConfirmation: true,
      preserveLocalDraft: true,
      reason: "remote-update",
      actions: ["stay", "compare", "save-as-new"],
    };
  }
  if (interruption === "save-failure" && guard.saveError) {
    return {
      blocked: true,
      requiresConfirmation: false,
      preserveLocalDraft: true,
      reason: "save-failed",
      actions: ["stay", "retry-save", "save-as-new"],
    };
  }
  if (
    guard.dirty &&
    (interruption === "internal-navigation" ||
      interruption === "refresh" ||
      interruption === "close")
  ) {
    return {
      blocked: true,
      requiresConfirmation: true,
      preserveLocalDraft: true,
      reason: "unsaved-changes",
      actions: ["stay", "discard"],
    };
  }
  return {
    blocked: false,
    requiresConfirmation: false,
    preserveLocalDraft: false,
    actions: [],
  };
}

export type QuizVersionPolicy =
  | "preserve-previous-pass"
  | "incomplete-learners-only"
  | "retake-all";

export type LearnerQuizProgress = Readonly<{
  learnerId: string;
  completedLesson: boolean;
  passedQuizVersion?: string;
}>;

export type QuizPolicyPreview = Readonly<{
  policy: QuizVersionPolicy;
  totalLearners: number;
  affectedLearnerCount: number;
  previouslyPassedLearnersAffected: number;
  affectedLearnerIds: readonly string[];
  explanation: string;
}>;

export function previewQuizPolicyImpact(
  policy: QuizVersionPolicy,
  learners: readonly LearnerQuizProgress[],
): QuizPolicyPreview {
  const affected = learners.filter((learner) => {
    if (policy === "preserve-previous-pass") {
      return !learner.passedQuizVersion;
    }
    if (policy === "incomplete-learners-only") {
      return !learner.completedLesson;
    }
    return true;
  });
  const previouslyPassedLearnersAffected = affected.filter(
    (learner) => learner.passedQuizVersion !== undefined,
  ).length;
  const explanations: Record<QuizVersionPolicy, string> = {
    "preserve-previous-pass":
      "Existing passes remain valid; learners without a pass use the new quiz.",
    "incomplete-learners-only":
      "Completed learners keep completion; incomplete learners use the new quiz.",
    "retake-all":
      "Every learner must pass the new quiz; historical passes remain auditable.",
  };
  return {
    policy,
    totalLearners: learners.length,
    affectedLearnerCount: affected.length,
    previouslyPassedLearnersAffected,
    affectedLearnerIds: affected.map((learner) => learner.learnerId),
    explanation: explanations[policy],
  };
}

export type QuizPolicyAudit = Readonly<{
  lessonId: string;
  fromQuizVersion: string;
  toQuizVersion: string;
  policy: QuizVersionPolicy;
  selectedBy: string;
  selectedAt: string;
  preview: QuizPolicyPreview;
}>;

export function selectQuizVersionPolicy(input: {
  lessonId: string;
  fromQuizVersion: string;
  toQuizVersion: string;
  policy: QuizVersionPolicy;
  selectedBy: string;
  selectedAt: string;
  learners: readonly LearnerQuizProgress[];
}): QuizPolicyAudit {
  if (
    !input.lessonId.trim() ||
    !input.fromQuizVersion.trim() ||
    !input.toQuizVersion.trim() ||
    !input.selectedBy.trim()
  ) {
    throw new Error("Quiz versions, lesson, and policy selector are required.");
  }
  return {
    lessonId: input.lessonId,
    fromQuizVersion: input.fromQuizVersion,
    toQuizVersion: input.toQuizVersion,
    policy: input.policy,
    selectedBy: input.selectedBy,
    selectedAt: input.selectedAt,
    preview: previewQuizPolicyImpact(input.policy, input.learners),
  };
}

export type RollbackResult = Readonly<{
  version: PublishedCurriculumVersion;
  restoredFromVersionId: string;
  rollbackReason: string;
}>;

export async function rollbackPublishedCurriculum(input: {
  history: readonly PublishedCurriculumVersion[];
  liveVersionId: string;
  restoreVersionId: string;
  newVersionId: string;
  reason: string;
  publisherId: string;
  publishedAt: string;
}): Promise<RollbackResult> {
  const live = input.history.find(
    (version) => version.versionId === input.liveVersionId,
  );
  const target = input.history.find(
    (version) => version.versionId === input.restoreVersionId,
  );
  if (!live || !target) throw new Error("Live and restore versions must exist.");
  if (input.history.some((version) => version.versionId === input.newVersionId)) {
    throw new Error("Rollback must create a new version ID.");
  }
  if (!input.reason.trim()) throw new Error("Rollback reason is required.");

  const version = await createPublishedVersion({
    versionId: input.newVersionId,
    previous: live,
    note: `Rollback to ${target.versionId}: ${input.reason.trim()}`,
    publisherId: input.publisherId,
    publishedAt: input.publishedAt,
    content: target.content as CurriculumContent,
  });
  return {
    version,
    restoredFromVersionId: target.versionId,
    rollbackReason: input.reason.trim(),
  };
}

export type ScheduledPublication = Readonly<{
  scheduleId: string;
  versionId: string;
  content: CurriculumContent;
  scheduledFor: string;
  timezone: string;
  status: "scheduled" | "cancelled" | "published" | "failed";
  createdBy: string;
  cancelledBy?: string;
  failureAlert?: PublicationFailureAlert;
}>;

export type PublicationFailureAlert = Readonly<{
  scheduleId: string;
  versionId: string;
  createdAt: string;
  code: "final-validation-failed";
  message: string;
  validationIssues: readonly ValidationIssue[];
  action: "review-scheduled-version";
}>;

function parseOffsetDate(value: string): number {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error("Scheduled time must include a timezone offset.");
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Scheduled time is invalid.");
  return timestamp;
}

export function schedulePublication(input: {
  scheduleId: string;
  versionId: string;
  content: CurriculumContent;
  scheduledFor: string;
  timezone: string;
  createdBy: string;
  now: string;
  allowedMediaHosts: readonly string[];
}): ScheduledPublication {
  if (
    !input.scheduleId.trim() ||
    !input.versionId.trim() ||
    !input.timezone.trim() ||
    !input.createdBy.trim()
  ) {
    throw new Error("Schedule, version, timezone, and creator are required.");
  }
  if (parseOffsetDate(input.scheduledFor) <= Date.parse(input.now)) {
    throw new Error("Scheduled publication must be in the future.");
  }
  const issues = validateCurriculumForPublish(
    input.content,
    input.allowedMediaHosts,
  );
  if (issues.length > 0) throw new Error("Only valid content can be scheduled.");
  return {
    scheduleId: input.scheduleId,
    versionId: input.versionId,
    content: structuredClone(input.content),
    scheduledFor: input.scheduledFor,
    timezone: input.timezone,
    status: "scheduled",
    createdBy: input.createdBy,
  };
}

export function cancelScheduledPublication(
  schedule: ScheduledPublication,
  cancelledBy: string,
): ScheduledPublication {
  if (schedule.status !== "scheduled") {
    throw new Error("Only a pending schedule can be cancelled.");
  }
  if (!cancelledBy.trim()) throw new Error("Cancelling administrator is required.");
  return { ...schedule, status: "cancelled", cancelledBy };
}

export type ScheduledPublicationExecution = Readonly<{
  schedule: ScheduledPublication;
  liveVersionId: string;
  alert?: PublicationFailureAlert;
}>;

export function executeScheduledPublication(input: {
  schedule: ScheduledPublication;
  currentLiveVersionId: string;
  now: string;
  allowedMediaHosts: readonly string[];
}): ScheduledPublicationExecution {
  if (input.schedule.status !== "scheduled") {
    throw new Error("Only a pending schedule can execute.");
  }
  if (Date.parse(input.now) < parseOffsetDate(input.schedule.scheduledFor)) {
    throw new Error("Scheduled publication is not due.");
  }
  const issues = validateCurriculumForPublish(
    input.schedule.content,
    input.allowedMediaHosts,
  );
  if (issues.length > 0) {
    const alert: PublicationFailureAlert = {
      scheduleId: input.schedule.scheduleId,
      versionId: input.schedule.versionId,
      createdAt: input.now,
      code: "final-validation-failed",
      message: "Scheduled publication failed final validation.",
      validationIssues: issues,
      action: "review-scheduled-version",
    };
    return {
      schedule: { ...input.schedule, status: "failed", failureAlert: alert },
      liveVersionId: input.currentLiveVersionId,
      alert,
    };
  }
  return {
    schedule: { ...input.schedule, status: "published" },
    liveVersionId: input.schedule.versionId,
  };
}

export type MediaReference = Readonly<{
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  videoUrl: string;
  contentOwnerId: string;
  affectedLearnerCount: number;
  recentLessonViews: number;
}>;

export type MediaProbeResult = Readonly<{
  videoUrl: string;
  status: "available" | "unavailable";
  checkedAt: string;
  httpStatus?: number;
}>;

export type ContentHealthItem = Readonly<{
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  contentOwnerId: string;
  videoUrl: string;
  status: "invalid-url" | "forbidden-host" | "unavailable" | "not-checked";
  checkedAt: string;
  affectedLearnerCount: number;
  recentLessonViews: number;
  ownerAlertRequired: true;
}>;

function mediaUrlHealth(
  videoUrl: string,
  allowedMediaHosts: readonly string[],
): "valid" | "invalid-url" | "forbidden-host" {
  try {
    const url = new URL(videoUrl);
    if (url.protocol !== "https:") return "invalid-url";
    if (
      !allowedMediaHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    ) {
      return "forbidden-host";
    }
    return "valid";
  } catch {
    return "invalid-url";
  }
}

export function buildContentHealthQueue(input: {
  references: readonly MediaReference[];
  probes: readonly MediaProbeResult[];
  allowedMediaHosts: readonly string[];
  checkedAt: string;
}): ContentHealthItem[] {
  const probes = new Map(input.probes.map((probe) => [probe.videoUrl, probe]));
  return input.references.flatMap((reference) => {
    const urlHealth = mediaUrlHealth(
      reference.videoUrl,
      input.allowedMediaHosts,
    );
    const probe = probes.get(reference.videoUrl);
    const status =
      urlHealth !== "valid"
        ? urlHealth
        : probe?.status === "unavailable"
          ? "unavailable"
          : probe === undefined
            ? "not-checked"
            : undefined;
    if (status === undefined) return [];
    return [
      {
        courseId: reference.courseId,
        lessonId: reference.lessonId,
        lessonTitle: reference.lessonTitle,
        contentOwnerId: reference.contentOwnerId,
        videoUrl: reference.videoUrl,
        status,
        checkedAt: probe?.checkedAt ?? input.checkedAt,
        affectedLearnerCount: reference.affectedLearnerCount,
        recentLessonViews: reference.recentLessonViews,
        ownerAlertRequired: true,
      },
    ];
  });
}
