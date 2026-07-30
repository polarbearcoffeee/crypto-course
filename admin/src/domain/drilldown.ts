import type { MetricId } from "./metrics";

export type AggregateStatus = "fresh" | "stale" | "partial" | "error";

export type AggregateMetadata = Readonly<{
  status: AggregateStatus;
  asOf: string;
  refreshedAt: string;
  historicalTrackingStart: string;
  completeThrough?: string;
  errorMessage?: string;
}>;

export type LearnerPopulationRecord = Readonly<{
  learnerId: string;
  metrics: readonly MetricId[];
  dimensions: Readonly<Record<string, string>>;
}>;

export type PopulationQuery = Readonly<{
  metricId: MetricId;
  dimensions?: Readonly<Record<string, string>>;
}>;

export type DrilldownRequest = PopulationQuery &
  Readonly<{
    cursor?: string;
    pageSize: number;
  }>;

export type DrilldownPage = Readonly<{
  metricId: MetricId;
  learnerIds: readonly string[];
  totalCount: number;
  nextCursor?: string;
}>;

export type AggregateDefinition = Readonly<{
  metricId: MetricId;
  version: string;
  includes: (
    record: LearnerPopulationRecord,
    dimensions: Readonly<Record<string, string>>,
  ) => boolean;
}>;

function matchesDimensions(
  record: LearnerPopulationRecord,
  dimensions: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(dimensions).every(
    ([key, value]) => record.dimensions[key] === value,
  );
}

export function createAggregateDefinition(
  metricId: MetricId,
  version = "1.0.0",
): AggregateDefinition {
  return {
    metricId,
    version,
    includes: (record, dimensions) =>
      record.metrics.includes(metricId) &&
      matchesDimensions(record, dimensions),
  };
}

export function selectLearnerPopulation(
  records: readonly LearnerPopulationRecord[],
  definition: AggregateDefinition,
  query: PopulationQuery,
): readonly string[] {
  if (query.metricId !== definition.metricId) {
    throw new Error(
      `Aggregate definition ${definition.metricId} cannot serve ${query.metricId}.`,
    );
  }

  const dimensions = query.dimensions ?? {};
  return records
    .filter((record) => definition.includes(record, dimensions))
    .map((record) => record.learnerId)
    .sort((left, right) => left.localeCompare(right));
}

export function countAggregatePopulation(
  records: readonly LearnerPopulationRecord[],
  definition: AggregateDefinition,
  query: PopulationQuery,
): number {
  return selectLearnerPopulation(records, definition, query).length;
}

export function getDrilldownPage(
  records: readonly LearnerPopulationRecord[],
  definition: AggregateDefinition,
  request: DrilldownRequest,
): DrilldownPage {
  if (!Number.isInteger(request.pageSize) || request.pageSize < 1) {
    throw new Error("pageSize must be a positive integer.");
  }

  const population = selectLearnerPopulation(records, definition, request);
  const startIndex = request.cursor
    ? Math.max(population.indexOf(request.cursor) + 1, 0)
    : 0;
  const learnerIds = population.slice(startIndex, startIndex + request.pageSize);
  const hasNextPage = startIndex + learnerIds.length < population.length;

  return {
    metricId: request.metricId,
    learnerIds,
    totalCount: population.length,
    nextCursor: hasNextPage ? learnerIds.at(-1) : undefined,
  };
}

export function createAggregateMetadata(
  metadata: AggregateMetadata,
): AggregateMetadata {
  if (metadata.status === "error" && !metadata.errorMessage) {
    throw new Error("Error aggregates require an errorMessage.");
  }

  if (metadata.status === "partial" && !metadata.completeThrough) {
    throw new Error("Partial aggregates require completeThrough.");
  }

  return Object.freeze({ ...metadata });
}
