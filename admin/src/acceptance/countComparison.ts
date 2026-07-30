export const comparisonDimensions = [
  "learners",
  "progress",
  "xp",
  "uid",
  "sources",
  "courses",
] as const;

export type ComparisonDimension = (typeof comparisonDimensions)[number];

export type DifferenceReason =
  | "duplicate-removed"
  | "malformed-record-rejected"
  | "pending-uid-reset"
  | "unknown-source-normalized"
  | "legacy-progress-normalized"
  | "legacy-course-versioned";

export type CountExplanation = Readonly<{
  reason: DifferenceReason;
  note: string;
  evidenceIds: readonly string[];
}>;

export type CountSnapshot = Readonly<Record<ComparisonDimension, number>>;

export type CountComparisonRow = Readonly<{
  dimension: ComparisonDimension;
  oldCount: number;
  newCount: number;
  delta: number;
  status: "matching" | "explained" | "unexplained";
  explanation?: CountExplanation;
}>;

export type CountComparisonReport = Readonly<{
  rows: readonly CountComparisonRow[];
  matchingCount: number;
  explainedCount: number;
  unexplainedCount: number;
  accepted: boolean;
}>;

export function compareLegacyAndNewCounts(input: Readonly<{
  oldCounts: CountSnapshot;
  newCounts: CountSnapshot;
  explanations?: Partial<Record<ComparisonDimension, CountExplanation>>;
}>): CountComparisonReport {
  const rows = comparisonDimensions.map((dimension): CountComparisonRow => {
    const oldCount = requireCount(input.oldCounts[dimension], dimension, "old");
    const newCount = requireCount(input.newCounts[dimension], dimension, "new");
    const delta = newCount - oldCount;
    const explanation = input.explanations?.[dimension];
    const hasEvidence =
      Boolean(explanation?.note.trim()) &&
      Boolean(explanation?.evidenceIds.length) &&
      explanation!.evidenceIds.every((id) => id.trim().length > 0);

    return Object.freeze({
      dimension,
      oldCount,
      newCount,
      delta,
      status:
        delta === 0 ? "matching" : hasEvidence ? "explained" : "unexplained",
      explanation: delta === 0 ? undefined : explanation,
    });
  });

  const matchingCount = rows.filter((row) => row.status === "matching").length;
  const explainedCount = rows.filter((row) => row.status === "explained").length;
  const unexplainedCount = rows.filter(
    (row) => row.status === "unexplained",
  ).length;

  return Object.freeze({
    rows: Object.freeze(rows),
    matchingCount,
    explainedCount,
    unexplainedCount,
    accepted: unexplainedCount === 0,
  });
}

export function formatCountComparisonMarkdown(
  report: CountComparisonReport,
): string {
  const header =
    "| 項目 | 舊系統 | 新系統 | 差異 | 狀態 | 說明 |\n" +
    "| --- | ---: | ---: | ---: | --- | --- |";
  const rows = report.rows.map((row) => {
    const explanation = row.explanation
      ? `${row.explanation.reason}：${row.explanation.note}（證據：${row.explanation.evidenceIds.join(", ")}）`
      : "—";
    return `| ${row.dimension} | ${row.oldCount} | ${row.newCount} | ${row.delta} | ${row.status} | ${explanation} |`;
  });
  return [header, ...rows].join("\n");
}

function requireCount(
  value: number,
  dimension: ComparisonDimension,
  side: "old" | "new",
): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${side} ${dimension} count must be a non-negative integer.`);
  }
  return value;
}
