import {
  deepFreeze,
  isIsoDate,
  isRecord,
  nonEmptyString,
  normalizeUid,
  type DryRunReport,
  type ImportedProgressSnapshot,
  type LearnerImportBundle,
  type LegacyRecord,
} from "./types";

export function importLegacyLearners(input: {
  students: readonly LegacyRecord[];
  dryRun: DryRunReport;
  knownLessonIds: readonly string[];
  importedAt: string;
  migrationRunId: string;
}): readonly LearnerImportBundle[] {
  const dryRunByReference = new Map(
    input.dryRun.records.map((record) => [record.recordRef, record]),
  );
  const knownLessons = new Set(input.knownLessonIds);

  const bundles = input.students.flatMap((student, index) => {
    const legacyLearnerId =
      nonEmptyString(student.id) ?? nonEmptyString(student.legacyLearnerId);
    const reference = legacyLearnerId ?? `row-${index + 1}`;
    const dryRunRecord = dryRunByReference.get(reference);
    if (!legacyLearnerId || !dryRunRecord?.importable) return [];

    const learnerId = `legacy:${legacyLearnerId}`;
    const nickname =
      nonEmptyString(student.name) ??
      nonEmptyString(student.nickname) ??
      "Legacy learner";
    const source = nonEmptyString(student.trafficSource) ?? "unknown";
    const xp = Number.isInteger(student.xp) ? (student.xp as number) : 0;
    const passedCount = nonNegativeInteger(student.passedCount);
    const totalModules = nonNegativeInteger(student.totalModules);
    const lastActiveAt = isIsoDate(student.lastActive)
      ? new Date(student.lastActive).toISOString()
      : undefined;
    const currentLessonId = findCurrentLesson(
      student.progress,
      input.knownLessonIds,
    );

    const bundle: LearnerImportBundle = {
      learner: {
        learnerId,
        legacyLearnerId,
        nickname,
        sourceFirst: source,
        sourceLatest: source,
        status: "active",
        learningState:
          totalModules > 0 && passedCount >= totalModules
            ? "completed"
            : passedCount > 0
              ? "in-progress"
              : currentLessonId
                ? "activated"
                : "registered",
        uidStatus: "pending",
        currentCourseId: "beginner",
        currentLessonId,
        lastActiveAt,
        createdAt: input.importedAt,
        updatedAt: input.importedAt,
        migrationRunId: input.migrationRunId,
      },
      uidVerification: buildUidVerification(
        student,
        learnerId,
        input.importedAt,
        input.migrationRunId,
      ),
      xpAdjustments:
        xp > 0
          ? [
              {
                ledgerEntryId: `legacy-import:${input.migrationRunId}:${legacyLearnerId}`,
                learnerId,
                ruleId: "legacy-import",
                ruleVersion: "legacy-import",
                idempotencyKey: `legacy-import:${input.migrationRunId}:${legacyLearnerId}`,
                amount: xp,
                balanceAfter: xp,
                reason:
                  "Imported legacy XP summary; no historical event evidence.",
                createdAt: input.importedAt,
                migrationRunId: input.migrationRunId,
              },
            ]
          : [],
      progressSnapshots: buildProgressSnapshots(
        student.progress,
        knownLessons,
        learnerId,
        lastActiveAt ?? input.importedAt,
        input.migrationRunId,
      ),
      learningEvents: [],
    };
    return [deepFreeze(bundle)];
  });

  assertNoFabricatedLearningEvents(bundles);
  return deepFreeze(bundles);
}

export function assertNoFabricatedLearningEvents(
  bundles: readonly LearnerImportBundle[],
): void {
  const fabricated = bundles.find(
    (bundle) => bundle.learningEvents.length !== 0,
  );
  if (fabricated) {
    throw new Error(
      `Legacy migration fabricated learning events for ${fabricated.learner.learnerId}`,
    );
  }
}

function buildUidVerification(
  student: LegacyRecord,
  learnerId: string,
  importedAt: string,
  migrationRunId: string,
) {
  const uidValue = normalizeUid(student.bitunixUid);
  const legacyUidFingerprint = nonEmptyString(student.uidFingerprint);
  if (!uidValue && !legacyUidFingerprint) return undefined;
  return {
    verificationId: `legacy-pending:${migrationRunId}:${learnerId}`,
    learnerId,
    status: "pending" as const,
    uidValue,
    legacyUidFingerprint,
    submittedAt: importedAt,
    migrationRunId,
  };
}

function buildProgressSnapshots(
  progress: unknown,
  knownLessons: ReadonlySet<string>,
  learnerId: string,
  updatedAt: string,
  migrationRunId: string,
): ImportedProgressSnapshot[] {
  if (!isRecord(progress)) return [];
  return Object.entries(progress).flatMap(([lessonId, value]) => {
    if (!knownLessons.has(lessonId) || !isRecord(value)) return [];
    if (
      value.passed !== undefined &&
      typeof value.passed !== "boolean"
    ) {
      return [];
    }
    if (value.score !== undefined && !Number.isFinite(value.score)) return [];
    return [
      {
        learnerId,
        courseId: "beginner",
        courseVersion: "v1",
        lessonId,
        quizVersion: "v1",
        passedAt: value.passed === true ? updatedAt : undefined,
        attempts: value.passed === true || value.score !== undefined ? 1 : 0,
        score: typeof value.score === "number" ? value.score : undefined,
        evidence: "legacy-import",
        updatedAt,
        migrationRunId,
      },
    ];
  });
}

function findCurrentLesson(
  progress: unknown,
  lessonOrder: readonly string[],
): string | undefined {
  if (!isRecord(progress)) return undefined;
  const firstIncomplete = lessonOrder.find((lessonId) => {
    const value = progress[lessonId];
    return isRecord(value) && value.passed !== true;
  });
  if (firstIncomplete) return firstIncomplete;
  for (let index = lessonOrder.length - 1; index >= 0; index -= 1) {
    const lessonId = lessonOrder[index];
    if (progress[lessonId] !== undefined) return lessonId;
  }
  return undefined;
}

function nonNegativeInteger(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0
    ? (value as number)
    : 0;
}
