import { describe, expect, it } from "vitest";

import {
  assertNoFabricatedLearningEvents,
  buildLegacyMigrationDryRun,
  createRedactedLegacyExport,
  importLegacyCurriculumV1,
  importLegacyLearners,
  previewStagingRollback,
  reconcileLegacyMigration,
  rollbackStagingImport,
  type LearnerImportBundle,
  type LegacyRecord,
  type StagingMigrationStore,
} from ".";

const importedAt = "2026-07-30T08:00:00.000Z";
const migrationRunId = "legacy-test-20260730";
const knownLessonIds = ["lesson-1", "lesson-2"];

const legacyStudents: LegacyRecord[] = [
  {
    id: "student-1",
    name: "Alice",
    bitunixUid: " uid-100 ",
    trafficSource: "youtube",
    xp: 100,
    passedCount: 2,
    totalModules: 2,
    progress: {
      "lesson-1": { passed: true, score: 3 },
      "lesson-2": { passed: true, score: 4 },
    },
    lastActive: "2026-07-29T07:00:00.000Z",
  },
  {
    id: "student-2",
    name: "Bob",
    bitunixUid: "UID-100",
    trafficSource: "",
    xp: 50,
    passedCount: 0,
    totalModules: 2,
    progress: {
      "unknown-lesson": { passed: true, score: 1 },
    },
  },
  {
    name: "Missing ID",
    trafficSource: "line",
    xp: -1,
  },
];

describe("redacted legacy export", () => {
  it("removes names, raw IDs, UIDs and the shared PIN without writing staging", async () => {
    const rowsWithUnexpectedPrivateData = legacyStudents.map((student, index) =>
      index === 0
        ? {
            ...student,
            progress: {
              "lesson-1": {
                passed: true,
                score: 3,
                privateNote: "do-not-export",
              },
            },
          }
        : student,
    );
    const result = await createRedactedLegacyExport({
      dataset: {
        students: rowsWithUnexpectedPrivateData,
        curriculum: { modules: [{ id: "lesson-1" }] },
        settings: { pin: "1234", theme: "dark" },
      },
      generatedAt: importedAt,
      redactionSalt: "test-only-salt-123456789",
    });
    const serialized = JSON.stringify(result);

    expect(result.metadata.stagingWritePerformed).toBe(false);
    expect(result.settings).toEqual({ pinRemoved: true });
    expect(result.students[0].uidFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.students[0].uidFingerprint).toBe(
      result.students[1].uidFingerprint,
    );
    expect(serialized).not.toContain("Alice");
    expect(serialized).not.toContain("student-1");
    expect(serialized).not.toContain("UID-100");
    expect(serialized).not.toContain("1234");
    expect(serialized).not.toContain("do-not-export");
  });
});

describe("legacy migration dry run", () => {
  it("classifies importable, malformed, duplicate UID, missing source and unknown progress rows", () => {
    const report = buildLegacyMigrationDryRun({
      students: legacyStudents,
      knownLessonIds,
      generatedAt: importedAt,
    });

    expect(report.totals).toEqual({
      valid: 2,
      malformed: 1,
      "duplicate-uid": 2,
      "missing-source": 1,
      "unknown-progress": 1,
    });
    expect(report.records[0]).toMatchObject({
      recordRef: "student-1",
      importable: true,
      classifications: ["valid", "duplicate-uid"],
    });
    expect(report.records[1].classifications).toEqual([
      "valid",
      "duplicate-uid",
      "missing-source",
      "unknown-progress",
    ]);
    expect(report.records[2].importable).toBe(false);
  });
});

describe("legacy curriculum v1", () => {
  it("preserves a reproducible checksum and freezes the original snapshot", async () => {
    const source = {
      modules: [
        {
          id: "lesson-1",
          title: "Wallet safety",
          quiz: [{ q: "Question", options: ["A", "B"], correct: 0 }],
        },
      ],
      updatedAt: "2026-07-29T00:00:00.000Z",
    };
    const first = await importLegacyCurriculumV1({
      curriculumDocument: source,
      importedAt,
      migrationRunId,
    });
    const verified = await importLegacyCurriculumV1({
      curriculumDocument: structuredClone(source),
      importedAt,
      migrationRunId,
      expectedOriginalChecksum: first.originalChecksum,
    });

    expect(first).toMatchObject({
      versionId: "v1",
      evidence: "legacy-import",
      originalChecksum: verified.originalChecksum,
    });
    expect(first.originalChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(first.originalDocument)).toBe(true);
    expect(Object.isFrozen(first.originalDocument.modules)).toBe(true);
  });

  it("stops when the recorded original checksum does not match", async () => {
    await expect(
      importLegacyCurriculumV1({
        curriculumDocument: { modules: [{ id: "lesson-1" }] },
        importedAt,
        migrationRunId,
        expectedOriginalChecksum: "0".repeat(64),
      }),
    ).rejects.toThrow("checksum mismatch");
  });
});

describe("legacy learner import", () => {
  const dryRun = buildLegacyMigrationDryRun({
    students: legacyStudents,
    knownLessonIds,
    generatedAt: importedAt,
  });
  const bundles = importLegacyLearners({
    students: legacyStudents,
    dryRun,
    knownLessonIds,
    importedAt,
    migrationRunId,
  });

  it("imports only valid summaries with pending UID and unknown source fallback", () => {
    expect(bundles).toHaveLength(2);
    expect(bundles[0].learner).toMatchObject({
      learnerId: "legacy:student-1",
      legacyLearnerId: "student-1",
      sourceFirst: "youtube",
      sourceLatest: "youtube",
      uidStatus: "pending",
      learningState: "completed",
    });
    expect(bundles[1].learner).toMatchObject({
      sourceFirst: "unknown",
      sourceLatest: "unknown",
      uidStatus: "pending",
    });
    expect(bundles[0].uidVerification).toMatchObject({
      status: "pending",
      uidValue: "UID-100",
    });
  });

  it("creates idempotent legacy-import XP adjustments and v1 summary evidence", () => {
    expect(bundles[0].xpAdjustments).toEqual([
      expect.objectContaining({
        ruleId: "legacy-import",
        ruleVersion: "legacy-import",
        amount: 100,
        balanceAfter: 100,
        idempotencyKey:
          "legacy-import:legacy-test-20260730:student-1",
      }),
    ]);
    expect(bundles[0].progressSnapshots).toHaveLength(2);
    expect(bundles[0].progressSnapshots[0]).toMatchObject({
      courseVersion: "v1",
      quizVersion: "v1",
      evidence: "legacy-import",
    });
    expect(bundles[1].progressSnapshots).toEqual([]);
  });

  it("does not fabricate historical learning events", () => {
    expect(bundles.every((bundle) => bundle.learningEvents.length === 0)).toBe(
      true,
    );
    expect(() => assertNoFabricatedLearningEvents(bundles)).not.toThrow();

    const invalid = [
      {
        ...bundles[0],
        learningEvents: [{ eventId: "fabricated" }],
      },
    ] as unknown as LearnerImportBundle[];
    expect(() => assertNoFabricatedLearningEvents(invalid)).toThrow(
      "fabricated learning events",
    );
  });

  it("reconciles learner, source, XP, completion and representative records", () => {
    const result = reconcileLegacyMigration({
      legacyStudents,
      dryRun,
      importedBundles: bundles,
      representativeLegacyLearnerIds: ["student-1", "student-2"],
    });

    expect(result.status).toBe("matched");
    expect(result.differences).toEqual([]);
    expect(result.legacy).toEqual({
      learnerCount: 2,
      xpTotal: 150,
      completionCount: 1,
      sourceCounts: { youtube: 1, unknown: 1 },
    });
    expect(result.imported).toEqual(result.legacy);
    expect(result.representativeChecks.every((check) => check.matched)).toBe(
      true,
    );
  });

  it("detects an accidentally omitted import instead of reconciling a smaller subset", () => {
    const result = reconcileLegacyMigration({
      legacyStudents,
      dryRun,
      importedBundles: bundles.slice(0, 1),
      representativeLegacyLearnerIds: ["student-2"],
    });

    expect(result.status).toBe("mismatch");
    expect(result.differences).toEqual(
      expect.arrayContaining([
        {
          metric: "learner-count",
          legacy: 2,
          imported: 1,
        },
        expect.objectContaining({
          metric: "representative:student-2",
        }),
      ]),
    );
  });
});

describe("staging rollback", () => {
  const record = (run: string) => ({ migrationRunId: run });
  const store: StagingMigrationStore = {
    curricula: [record(migrationRunId)],
    learners: [record(migrationRunId), record("other-run")],
    uidVerifications: [record(migrationRunId)],
    xpLedger: [record(migrationRunId), record(migrationRunId)],
    progress: [record("other-run")],
  };

  it("previews exact deletion counts before cleanup", () => {
    expect(previewStagingRollback(store, migrationRunId)).toEqual({
      migrationRunId,
      deletionCounts: {
        curricula: 1,
        learners: 1,
        uidVerifications: 1,
        xpLedger: 2,
        progress: 0,
      },
      totalDeletionCount: 5,
    });
  });

  it("deletes only records tagged with the exact staging migration run", () => {
    const result = rollbackStagingImport(store, migrationRunId);

    expect(result.store).toEqual({
      curricula: [],
      learners: [record("other-run")],
      uidVerifications: [],
      xpLedger: [],
      progress: [record("other-run")],
    });
    expect(store.learners).toHaveLength(2);
  });
});
