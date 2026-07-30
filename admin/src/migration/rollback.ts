import { deepFreeze, type MigrationTagged } from "./types";

export type StagingMigrationStore = Readonly<{
  curricula: readonly MigrationTagged[];
  learners: readonly MigrationTagged[];
  uidVerifications: readonly MigrationTagged[];
  xpLedger: readonly MigrationTagged[];
  progress: readonly MigrationTagged[];
}>;

export type RollbackCollectionName = keyof StagingMigrationStore;

export type RollbackPreview = Readonly<{
  migrationRunId: string;
  deletionCounts: Readonly<Record<RollbackCollectionName, number>>;
  totalDeletionCount: number;
}>;

export function previewStagingRollback(
  store: StagingMigrationStore,
  migrationRunId: string,
): RollbackPreview {
  if (!migrationRunId.trim()) throw new Error("migrationRunId is required");
  const deletionCounts = {
    curricula: matchingCount(store.curricula),
    learners: matchingCount(store.learners),
    uidVerifications: matchingCount(store.uidVerifications),
    xpLedger: matchingCount(store.xpLedger),
    progress: matchingCount(store.progress),
  };
  return deepFreeze({
    migrationRunId,
    deletionCounts,
    totalDeletionCount: Object.values(deletionCounts).reduce(
      (total, count) => total + count,
      0,
    ),
  });

  function matchingCount(records: readonly MigrationTagged[]) {
    return records.filter(
      (record) => record.migrationRunId === migrationRunId,
    ).length;
  }
}

/**
 * Pure cleanup helper for a staging adapter. It only removes records tagged
 * with the exact migration run ID and never connects to Firestore itself.
 */
export function rollbackStagingImport(
  store: StagingMigrationStore,
  migrationRunId: string,
): Readonly<{
  store: StagingMigrationStore;
  preview: RollbackPreview;
}> {
  const preview = previewStagingRollback(store, migrationRunId);
  const keepOtherRuns = (records: readonly MigrationTagged[]) =>
    records.filter((record) => record.migrationRunId !== migrationRunId);
  return deepFreeze({
    preview,
    store: {
      curricula: keepOtherRuns(store.curricula),
      learners: keepOtherRuns(store.learners),
      uidVerifications: keepOtherRuns(store.uidVerifications),
      xpLedger: keepOtherRuns(store.xpLedger),
      progress: keepOtherRuns(store.progress),
    },
  });
}
