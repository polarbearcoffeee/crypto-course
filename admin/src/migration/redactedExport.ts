import {
  deepFreeze,
  isRecord,
  nonEmptyString,
  normalizeUid,
  sha256,
  type LegacyDataset,
  type LegacyRecord,
} from "./types";

export type RedactedLegacyStudent = Readonly<{
  legacyLearnerRef: string;
  nicknameAlias: string;
  uidFingerprint?: string;
  trafficSource?: string;
  xp?: number;
  level?: number;
  passedCount?: number;
  totalModules?: number;
  badgeCount?: number;
  checkinStreak?: number;
  progress?: unknown;
  lastActive?: string;
}>;

export type RedactedLegacyDataset = Readonly<{
  metadata: Readonly<{
    redacted: true;
    generatedAt: string;
    sourceCollections: readonly [
      "ta_students",
      "ta_content",
      "ta_settings",
    ];
    stagingWritePerformed: false;
  }>;
  students: readonly RedactedLegacyStudent[];
  curriculum?: LegacyRecord;
  settings: Readonly<{
    pinRemoved: true;
  }>;
}>;

const SAFE_NUMBER_FIELDS = [
  "xp",
  "level",
  "passedCount",
  "totalModules",
  "badgeCount",
  "checkinStreak",
] as const;

/**
 * Produces an in-memory redacted export. It never connects to or writes staging.
 * The caller must supply a run-specific secret salt and persist the result using
 * an independently reviewed staging adapter.
 */
export async function createRedactedLegacyExport(input: {
  dataset: LegacyDataset;
  generatedAt: string;
  redactionSalt: string;
}): Promise<RedactedLegacyDataset> {
  if (input.redactionSalt.length < 16) {
    throw new Error("redactionSalt must contain at least 16 characters");
  }

  const students = await Promise.all(
    input.dataset.students.map(async (student, index) => {
      const legacyId =
        nonEmptyString(student.id) ??
        nonEmptyString(student.legacyLearnerId) ??
        `row-${index + 1}`;
      const uid = normalizeUid(student.bitunixUid);
      const redacted: Record<string, unknown> = {
        legacyLearnerRef: await sha256(
          `${input.redactionSalt}:learner:${legacyId}`,
        ),
        nicknameAlias: `legacy-learner-${index + 1}`,
      };

      if (uid) {
        redacted.uidFingerprint = await sha256(
          `${input.redactionSalt}:uid:${uid}`,
        );
      }
      const trafficSource = nonEmptyString(student.trafficSource);
      if (trafficSource) redacted.trafficSource = trafficSource;
      for (const field of SAFE_NUMBER_FIELDS) {
        if (typeof student[field] === "number") {
          redacted[field] = student[field];
        }
      }
      const progress = redactProgress(student.progress);
      if (progress) redacted.progress = progress;
      const lastActive = nonEmptyString(student.lastActive);
      if (lastActive) redacted.lastActive = lastActive;
      return redacted as RedactedLegacyStudent;
    }),
  );

  return deepFreeze({
    metadata: {
      redacted: true,
      generatedAt: input.generatedAt,
      sourceCollections: ["ta_students", "ta_content", "ta_settings"],
      stagingWritePerformed: false,
    },
    students,
    curriculum: input.dataset.curriculum
      ? structuredClone(input.dataset.curriculum)
      : undefined,
    settings: { pinRemoved: true },
  });
}

function redactProgress(
  value: unknown,
): Readonly<Record<string, Readonly<Record<string, boolean | number>>>> | undefined {
  if (!isRecord(value)) return undefined;
  const progress: Record<string, Record<string, boolean | number>> = {};
  for (const [lessonId, rawProgress] of Object.entries(value)) {
    if (!isRecord(rawProgress)) continue;
    const entry: Record<string, boolean | number> = {};
    if (typeof rawProgress.passed === "boolean") {
      entry.passed = rawProgress.passed;
    }
    if (typeof rawProgress.score === "number") {
      entry.score = rawProgress.score;
    }
    progress[lessonId] = entry;
  }
  return progress;
}
