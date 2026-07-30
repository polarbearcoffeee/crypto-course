export type UidVerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "needs-correction";

export type LearnerStatus =
  | "active"
  | "paused"
  | "blocked"
  | "deleted-pending-retention";

export type LearnerTimelineItem = Readonly<{
  id: string;
  type: string;
  occurredAt: string;
  summary: string;
}>;

export type Learner360Detail = Readonly<{
  learnerId: string;
  profile: Readonly<{
    nickname: string;
    status: LearnerStatus;
    tags: readonly string[];
  }>;
  progress: readonly Readonly<Record<string, unknown>>[];
  timeline: readonly LearnerTimelineItem[];
  quizAttempts: readonly Readonly<Record<string, unknown>>[];
  xpLedger: readonly Readonly<Record<string, unknown>>[];
  streak: Readonly<{ currentDays: number; longestDays: number }>;
  badges: readonly Readonly<Record<string, unknown>>[];
  notes: readonly Readonly<Record<string, unknown>>[];
  audit: readonly Readonly<Record<string, unknown>>[];
}>;

export type Learner360Input = Omit<Learner360Detail, "timeline" | "profile"> &
  Readonly<{
    nickname: string;
    status: LearnerStatus;
    tags: readonly string[];
    timeline: readonly LearnerTimelineItem[];
  }>;

/**
 * Produces a stable, read-only learner detail projection. Timeline and ledger
 * ordering is deterministic so the UI does not silently reorder equal-time rows.
 */
export function buildLearner360Detail(input: Learner360Input): Learner360Detail {
  requireId(input.learnerId, "learnerId");
  if (!input.nickname.trim()) throw new Error("nickname is required");
  if (input.streak.currentDays < 0 || input.streak.longestDays < 0) {
    throw new Error("streak days cannot be negative");
  }

  const tags = uniqueNormalized(input.tags);
  return deepFreeze({
    learnerId: input.learnerId,
    profile: {
      nickname: input.nickname.trim(),
      status: input.status,
      tags,
    },
    progress: [...input.progress],
    timeline: [...input.timeline].sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
        left.id.localeCompare(right.id),
    ),
    quizAttempts: [...input.quizAttempts],
    xpLedger: [...input.xpLedger],
    streak: { ...input.streak },
    badges: [...input.badges],
    notes: [...input.notes],
    audit: [...input.audit],
  });
}

export type UidVerificationAction = Exclude<UidVerificationStatus, "pending">;

export type UidVerificationTransition = Readonly<{
  transitionId: string;
  from: UidVerificationStatus;
  to: UidVerificationStatus;
  actorId: string;
  occurredAt: string;
  reason?: string;
  evidenceReference?: string;
}>;

export type UidVerificationRecord = Readonly<{
  verificationId: string;
  learnerId: string;
  uidValue: string;
  uidNormalized: string;
  status: UidVerificationStatus;
  submittedAt: string;
  updatedAt: string;
  reason?: string;
  actorId?: string;
  evidenceReference?: string;
  history: readonly UidVerificationTransition[];
}>;

export function createPendingUidVerification(input: Readonly<{
  verificationId: string;
  learnerId: string;
  uidValue: string;
  submittedAt: string;
  evidenceReference?: string;
}>): UidVerificationRecord {
  requireId(input.verificationId, "verificationId");
  requireId(input.learnerId, "learnerId");
  const uidValue = normalizeVisibleUid(input.uidValue);
  requireTimestamp(input.submittedAt, "submittedAt");
  return deepFreeze({
    verificationId: input.verificationId,
    learnerId: input.learnerId,
    uidValue,
    uidNormalized: normalizeUid(uidValue),
    status: "pending",
    submittedAt: input.submittedAt,
    updatedAt: input.submittedAt,
    evidenceReference: optionalTrim(input.evidenceReference),
    history: [],
  });
}

export function reviewUidVerification(
  record: UidVerificationRecord,
  input: Readonly<{
    transitionId: string;
    action: UidVerificationAction;
    actorId: string;
    occurredAt: string;
    reason?: string;
    evidenceReference?: string;
  }>,
): UidVerificationRecord {
  if (record.status !== "pending") {
    throw new Error(`Only pending UID can be reviewed; current status is ${record.status}`);
  }
  requireId(input.transitionId, "transitionId");
  requireId(input.actorId, "actorId");
  requireTimestamp(input.occurredAt, "occurredAt");
  assertChronology(record.updatedAt, input.occurredAt);
  const reason = optionalTrim(input.reason);
  if (input.action !== "verified" && !reason) {
    throw new Error(`${input.action} requires a reason`);
  }
  const evidenceReference =
    optionalTrim(input.evidenceReference) ?? record.evidenceReference;
  const transition: UidVerificationTransition = {
    transitionId: input.transitionId,
    from: record.status,
    to: input.action,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    reason,
    evidenceReference,
  };
  return deepFreeze({
    ...record,
    status: input.action,
    updatedAt: input.occurredAt,
    reason,
    actorId: input.actorId,
    evidenceReference,
    history: [...record.history, transition],
  });
}

export type UidCorrection = Readonly<{
  correctionId: string;
  verificationId: string;
  learnerId: string;
  oldUidValue: string;
  oldUidNormalized: string;
  newUidValue: string;
  newUidNormalized: string;
  actorId: string;
  reason: string;
  occurredAt: string;
}>;

export function correctUidVerification(
  record: UidVerificationRecord,
  input: Readonly<{
    correctionId: string;
    transitionId: string;
    newUidValue: string;
    actorId: string;
    reason: string;
    occurredAt: string;
    evidenceReference?: string;
  }>,
): Readonly<{ record: UidVerificationRecord; correction: UidCorrection }> {
  if (record.status !== "rejected" && record.status !== "needs-correction") {
    throw new Error("UID correction requires rejected or needs-correction status");
  }
  requireId(input.correctionId, "correctionId");
  requireId(input.transitionId, "transitionId");
  requireId(input.actorId, "actorId");
  requireTimestamp(input.occurredAt, "occurredAt");
  assertChronology(record.updatedAt, input.occurredAt);
  const newUidValue = normalizeVisibleUid(input.newUidValue);
  const newUidNormalized = normalizeUid(newUidValue);
  if (newUidNormalized === record.uidNormalized) {
    throw new Error("Corrected UID must differ from the previous UID");
  }
  const reason = requiredTrim(input.reason, "reason");
  const evidenceReference = optionalTrim(input.evidenceReference);
  const transition: UidVerificationTransition = {
    transitionId: input.transitionId,
    from: record.status,
    to: "pending",
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    reason,
    evidenceReference,
  };
  const correction: UidCorrection = {
    correctionId: input.correctionId,
    verificationId: record.verificationId,
    learnerId: record.learnerId,
    oldUidValue: record.uidValue,
    oldUidNormalized: record.uidNormalized,
    newUidValue,
    newUidNormalized,
    actorId: input.actorId,
    reason,
    occurredAt: input.occurredAt,
  };
  const nextRecord: UidVerificationRecord = {
    ...record,
    uidValue: newUidValue,
    uidNormalized: newUidNormalized,
    status: "pending",
    updatedAt: input.occurredAt,
    reason: undefined,
    actorId: input.actorId,
    evidenceReference,
    history: [...record.history, transition],
  };
  return deepFreeze({ record: nextRecord, correction });
}

function normalizeUid(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function normalizeVisibleUid(value: string): string {
  return requiredTrim(value, "uidValue");
}

function uniqueNormalized(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function optionalTrim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requiredTrim(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function requireId(value: string, field: string): void {
  requiredTrim(value, field);
}

function requireTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be a valid timestamp`);
}

function assertChronology(previous: string, next: string): void {
  if (Date.parse(next) < Date.parse(previous)) {
    throw new Error("Workflow timestamps cannot move backwards");
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}
