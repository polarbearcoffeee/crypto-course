import {
  deepFreeze,
  isRecord,
  sha256,
  stableStringify,
  type LegacyRecord,
} from "./types";

export type LegacyCurriculumVersion = Readonly<{
  versionId: "v1";
  courseId: "beginner";
  sourceCollection: "ta_content";
  sourceDocument: "curriculum";
  evidence: "legacy-import";
  importedAt: string;
  migrationRunId: string;
  originalChecksum: string;
  originalDocument: LegacyRecord;
}>;

/**
 * Captures the legacy curriculum exactly as an immutable v1 snapshot.
 * The checksum is over canonical JSON so it can be independently reproduced.
 */
export async function importLegacyCurriculumV1(input: {
  curriculumDocument: LegacyRecord;
  importedAt: string;
  migrationRunId: string;
  expectedOriginalChecksum?: string;
}): Promise<LegacyCurriculumVersion> {
  if (!Array.isArray(input.curriculumDocument.modules)) {
    throw new Error("Legacy curriculum must contain a modules array");
  }
  if (
    input.curriculumDocument.modules.some(
      (module) => !isRecord(module) || typeof module.id !== "string",
    )
  ) {
    throw new Error("Every legacy curriculum module must have an ID");
  }

  const originalDocument = structuredClone(input.curriculumDocument);
  const originalChecksum = await sha256(stableStringify(originalDocument));
  if (
    input.expectedOriginalChecksum &&
    input.expectedOriginalChecksum !== originalChecksum
  ) {
    throw new Error(
      `Legacy curriculum checksum mismatch: expected ${input.expectedOriginalChecksum}, received ${originalChecksum}`,
    );
  }

  return deepFreeze({
    versionId: "v1",
    courseId: "beginner",
    sourceCollection: "ta_content",
    sourceDocument: "curriculum",
    evidence: "legacy-import",
    importedAt: input.importedAt,
    migrationRunId: input.migrationRunId,
    originalChecksum,
    originalDocument,
  });
}
