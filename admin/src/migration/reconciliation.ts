import {
  deepFreeze,
  nonEmptyString,
  type DryRunReport,
  type LearnerImportBundle,
  type LegacyRecord,
} from "./types";

export type ReconciliationDifference = Readonly<{
  metric:
    | "learner-count"
    | "xp-total"
    | "completion-count"
    | `source:${string}`
    | `representative:${string}`;
  legacy: number | string;
  imported: number | string;
}>;

export type LegacyMigrationReconciliation = Readonly<{
  status: "matched" | "mismatch";
  legacy: Readonly<{
    learnerCount: number;
    xpTotal: number;
    completionCount: number;
    sourceCounts: Readonly<Record<string, number>>;
  }>;
  imported: Readonly<{
    learnerCount: number;
    xpTotal: number;
    completionCount: number;
    sourceCounts: Readonly<Record<string, number>>;
  }>;
  representativeChecks: readonly Readonly<{
    legacyLearnerId: string;
    matched: boolean;
    detail: string;
  }>[];
  differences: readonly ReconciliationDifference[];
}>;

export function reconcileLegacyMigration(input: {
  legacyStudents: readonly LegacyRecord[];
  dryRun: DryRunReport;
  importedBundles: readonly LearnerImportBundle[];
  representativeLegacyLearnerIds: readonly string[];
}): LegacyMigrationReconciliation {
  const importedByLegacyId = new Map(
    input.importedBundles.map((bundle) => [
      bundle.learner.legacyLearnerId,
      bundle,
    ]),
  );
  const expectedLegacyIds = new Set(
    input.dryRun.records
      .filter((record) => record.importable)
      .map((record) => record.legacyLearnerId)
      .filter((id): id is string => Boolean(id)),
  );
  const comparableLegacy = input.legacyStudents.filter((student) => {
    const id =
      nonEmptyString(student.id) ?? nonEmptyString(student.legacyLearnerId);
    return id ? expectedLegacyIds.has(id) : false;
  });

  const legacy = summarizeLegacy(comparableLegacy);
  const imported = summarizeImported(input.importedBundles);
  const differences: ReconciliationDifference[] = [];
  compareNumber("learner-count", legacy.learnerCount, imported.learnerCount);
  compareNumber("xp-total", legacy.xpTotal, imported.xpTotal);
  compareNumber(
    "completion-count",
    legacy.completionCount,
    imported.completionCount,
  );
  for (const source of new Set([
    ...Object.keys(legacy.sourceCounts),
    ...Object.keys(imported.sourceCounts),
  ])) {
    compareNumber(
      `source:${source}`,
      legacy.sourceCounts[source] ?? 0,
      imported.sourceCounts[source] ?? 0,
    );
  }

  const representativeChecks = input.representativeLegacyLearnerIds.map(
    (legacyLearnerId) => {
      const student = input.legacyStudents.find(
        (candidate) =>
          (nonEmptyString(candidate.id) ??
            nonEmptyString(candidate.legacyLearnerId)) === legacyLearnerId,
      );
      const importedBundle = importedByLegacyId.get(legacyLearnerId);
      if (!student || !importedBundle) {
        differences.push({
          metric: `representative:${legacyLearnerId}`,
          legacy: student ? "present" : "missing",
          imported: importedBundle ? "present" : "missing",
        });
        return {
          legacyLearnerId,
          matched: false,
          detail: "Representative record is missing on one side.",
        };
      }
      const expectedSource =
        nonEmptyString(student.trafficSource) ?? "unknown";
      const expectedXp = Number.isInteger(student.xp)
        ? (student.xp as number)
        : 0;
      const importedXp = importedBundle.xpAdjustments.reduce(
        (total, entry) => total + entry.amount,
        0,
      );
      const matched =
        importedBundle.learner.sourceFirst === expectedSource &&
        importedBundle.learner.uidStatus === "pending" &&
        importedXp === expectedXp &&
        importedBundle.learningEvents.length === 0;
      if (!matched) {
        differences.push({
          metric: `representative:${legacyLearnerId}`,
          legacy: `${expectedSource}|${expectedXp}|pending|0-events`,
          imported: `${importedBundle.learner.sourceFirst}|${importedXp}|${importedBundle.learner.uidStatus}|${importedBundle.learningEvents.length}-events`,
        });
      }
      return {
        legacyLearnerId,
        matched,
        detail: matched
          ? "Source, XP, pending UID state, and zero-event invariant match."
          : "Representative fields differ.",
      };
    },
  );

  return deepFreeze({
    status: differences.length === 0 ? "matched" : "mismatch",
    legacy,
    imported,
    representativeChecks,
    differences,
  });

  function compareNumber(
    metric: ReconciliationDifference["metric"],
    legacyValue: number,
    importedValue: number,
  ) {
    if (legacyValue !== importedValue) {
      differences.push({
        metric,
        legacy: legacyValue,
        imported: importedValue,
      });
    }
  }
}

function summarizeLegacy(students: readonly LegacyRecord[]) {
  const sourceCounts: Record<string, number> = {};
  let xpTotal = 0;
  let completionCount = 0;
  for (const student of students) {
    const source = nonEmptyString(student.trafficSource) ?? "unknown";
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
    if (Number.isInteger(student.xp)) xpTotal += student.xp as number;
    if (
      Number.isInteger(student.totalModules) &&
      (student.totalModules as number) > 0 &&
      Number.isInteger(student.passedCount) &&
      (student.passedCount as number) >= (student.totalModules as number)
    ) {
      completionCount += 1;
    }
  }
  return {
    learnerCount: students.length,
    xpTotal,
    completionCount,
    sourceCounts,
  };
}

function summarizeImported(bundles: readonly LearnerImportBundle[]) {
  const sourceCounts: Record<string, number> = {};
  let xpTotal = 0;
  let completionCount = 0;
  for (const bundle of bundles) {
    const source = bundle.learner.sourceFirst;
    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
    xpTotal += bundle.xpAdjustments.reduce(
      (total, entry) => total + entry.amount,
      0,
    );
    if (bundle.learner.learningState === "completed") completionCount += 1;
  }
  return {
    learnerCount: bundles.length,
    xpTotal,
    completionCount,
    sourceCounts,
  };
}
