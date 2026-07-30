import {
  deepFreeze,
  isRecord,
  nonEmptyString,
  normalizeUid,
  type DryRunRecord,
  type DryRunReport,
  type LegacyRecord,
  type MigrationClassification,
  type MigrationIssue,
} from "./types";

export function buildLegacyMigrationDryRun(input: {
  students: readonly LegacyRecord[];
  knownLessonIds: readonly string[];
  generatedAt: string;
}): DryRunReport {
  const knownLessons = new Set(input.knownLessonIds);
  const uidOwners = new Map<string, string[]>();

  input.students.forEach((student, index) => {
    const uid = normalizeUid(student.bitunixUid);
    if (!uid) return;
    const recordRef = recordReference(student, index);
    uidOwners.set(uid, [...(uidOwners.get(uid) ?? []), recordRef]);
  });

  const records: DryRunRecord[] = [];
  const issues: MigrationIssue[] = [];

  input.students.forEach((student, index) => {
    const recordRef = recordReference(student, index);
    const legacyLearnerId =
      nonEmptyString(student.id) ?? nonEmptyString(student.legacyLearnerId);
    const classifications = new Set<MigrationClassification>();
    const malformedReasons = malformedRecordReasons(student);
    if (malformedReasons.length > 0) {
      classifications.add("malformed");
      malformedReasons.forEach((detail) =>
        issues.push({ recordRef, classification: "malformed", detail }),
      );
    } else {
      classifications.add("valid");
    }

    const uid = normalizeUid(student.bitunixUid);
    if (uid && (uidOwners.get(uid)?.length ?? 0) > 1) {
      classifications.add("duplicate-uid");
      issues.push({
        recordRef,
        classification: "duplicate-uid",
        detail: "Normalized UID appears on more than one legacy learner.",
      });
    }

    if (!nonEmptyString(student.trafficSource)) {
      classifications.add("missing-source");
      issues.push({
        recordRef,
        classification: "missing-source",
        detail: "trafficSource is blank and will be imported as unknown.",
      });
    }

    const unknownProgress = findUnknownProgress(student.progress, knownLessons);
    if (unknownProgress.length > 0) {
      classifications.add("unknown-progress");
      unknownProgress.forEach((detail) =>
        issues.push({
          recordRef,
          classification: "unknown-progress",
          detail,
        }),
      );
    }

    records.push({
      recordRef,
      legacyLearnerId,
      importable: !classifications.has("malformed"),
      classifications: [...classifications],
    });
  });

  const totals = {
    valid: 0,
    malformed: 0,
    "duplicate-uid": 0,
    "missing-source": 0,
    "unknown-progress": 0,
  } satisfies Record<MigrationClassification, number>;
  records.forEach((record) =>
    record.classifications.forEach((classification) => {
      totals[classification] += 1;
    }),
  );

  return deepFreeze({
    generatedAt: input.generatedAt,
    knownLessonIds: [...knownLessons],
    totals,
    records,
    issues,
  });
}

function recordReference(student: LegacyRecord, index: number): string {
  return (
    nonEmptyString(student.id) ??
    nonEmptyString(student.legacyLearnerId) ??
    `row-${index + 1}`
  );
}

function malformedRecordReasons(student: LegacyRecord): string[] {
  const reasons: string[] = [];
  if (!nonEmptyString(student.id) && !nonEmptyString(student.legacyLearnerId)) {
    reasons.push("Legacy learner ID is missing.");
  }
  if (!nonEmptyString(student.name) && !nonEmptyString(student.nickname)) {
    reasons.push("Nickname is missing.");
  }
  if (
    student.xp !== undefined &&
    (!Number.isInteger(student.xp) || (student.xp as number) < 0)
  ) {
    reasons.push("XP must be a non-negative integer.");
  }
  if (
    student.progress !== undefined &&
    !isRecord(student.progress)
  ) {
    reasons.push("Progress must be an object when present.");
  }
  return reasons;
}

function findUnknownProgress(
  progress: unknown,
  knownLessons: ReadonlySet<string>,
): string[] {
  if (!isRecord(progress)) return [];
  const issues: string[] = [];
  for (const [lessonId, value] of Object.entries(progress)) {
    if (!knownLessons.has(lessonId)) {
      issues.push(`Progress references unknown lesson "${lessonId}".`);
      continue;
    }
    if (
      !isRecord(value) ||
      (value.passed !== undefined && typeof value.passed !== "boolean") ||
      (value.score !== undefined && !Number.isFinite(value.score))
    ) {
      issues.push(`Progress for "${lessonId}" has an unknown shape.`);
    }
  }
  return issues;
}
