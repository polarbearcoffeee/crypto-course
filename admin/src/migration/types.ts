export type LegacyRecord = Readonly<Record<string, unknown>>;

export type LegacyDataset = Readonly<{
  students: readonly LegacyRecord[];
  curriculum?: LegacyRecord;
  settings?: LegacyRecord;
}>;

export type MigrationClassification =
  | "valid"
  | "malformed"
  | "duplicate-uid"
  | "missing-source"
  | "unknown-progress";

export type MigrationIssue = Readonly<{
  recordRef: string;
  classification: Exclude<MigrationClassification, "valid">;
  detail: string;
}>;

export type DryRunRecord = Readonly<{
  recordRef: string;
  legacyLearnerId?: string;
  importable: boolean;
  classifications: readonly MigrationClassification[];
}>;

export type DryRunReport = Readonly<{
  generatedAt: string;
  knownLessonIds: readonly string[];
  totals: Readonly<Record<MigrationClassification, number>>;
  records: readonly DryRunRecord[];
  issues: readonly MigrationIssue[];
}>;

export type ImportedLearner = Readonly<{
  learnerId: string;
  legacyLearnerId: string;
  nickname: string;
  sourceFirst: string;
  sourceLatest: string;
  status: "active";
  learningState:
    | "registered"
    | "activated"
    | "in-progress"
    | "completed";
  uidStatus: "pending";
  currentCourseId: "beginner";
  currentLessonId?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
  migrationRunId: string;
}>;

export type ImportedUidVerification = Readonly<{
  verificationId: string;
  learnerId: string;
  status: "pending";
  legacyUidFingerprint?: string;
  uidValue?: string;
  submittedAt: string;
  migrationRunId: string;
}>;

export type LegacyXpAdjustment = Readonly<{
  ledgerEntryId: string;
  learnerId: string;
  ruleId: "legacy-import";
  ruleVersion: "legacy-import";
  idempotencyKey: string;
  amount: number;
  balanceAfter: number;
  reason: "Imported legacy XP summary; no historical event evidence.";
  createdAt: string;
  migrationRunId: string;
}>;

export type ImportedProgressSnapshot = Readonly<{
  learnerId: string;
  courseId: "beginner";
  courseVersion: "v1";
  lessonId: string;
  quizVersion: "v1";
  watchedAt?: string;
  passedAt?: string;
  attempts: number;
  score?: number;
  evidence: "legacy-import";
  updatedAt: string;
  migrationRunId: string;
}>;

export type LearnerImportBundle = Readonly<{
  learner: ImportedLearner;
  uidVerification?: ImportedUidVerification;
  xpAdjustments: readonly LegacyXpAdjustment[];
  progressSnapshots: readonly ImportedProgressSnapshot[];
  /** This must remain empty: legacy summaries are not historical events. */
  learningEvents: readonly never[];
}>;

export type MigrationTagged = Readonly<{
  migrationRunId: string;
}>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeUid(value: unknown): string | undefined {
  return nonEmptyString(value)?.toUpperCase();
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
