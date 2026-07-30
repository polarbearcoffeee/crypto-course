export const dashboardKpiIds = [
  "registered",
  "pending-uid",
  "verified",
  "activation",
  "7d-active",
  "completion",
  "stuck",
  "advanced-eligible",
] as const;

export type DashboardKpiId = (typeof dashboardKpiIds)[number];

export type Ratio =
  | Readonly<{ status: "available"; value: number }>
  | Readonly<{
      status: "unavailable";
      value: null;
      reason: "zero-denominator" | "not-applicable" | "not-tracked";
    }>;

export type PeriodComparison = Readonly<{
  previousNumerator: number;
  absoluteChange: number;
  percentageChange: Ratio;
}>;

export type DashboardFreshness = Readonly<{
  asOf: string;
  refreshedAt: string;
  status: "fresh" | "stale" | "partial";
}>;

export type DashboardDrilldown = Readonly<{
  path: string;
  filters: Readonly<Record<string, string>>;
}>;

export type DashboardKpi = Readonly<{
  id: DashboardKpiId;
  label: string;
  numerator: number;
  denominator: number | null;
  value: number;
  rate: Ratio;
  comparison: PeriodComparison;
  definition: string;
  freshness: DashboardFreshness;
  drilldown: DashboardDrilldown;
}>;

export type DashboardKpiInput = Readonly<{
  numerator: number;
  denominator?: number;
  previousNumerator: number;
  definition: string;
  freshness: DashboardFreshness;
  drilldown: DashboardDrilldown;
}>;

const kpiLabels: Readonly<Record<DashboardKpiId, string>> = {
  registered: "Registered learners",
  "pending-uid": "Pending UID verifications",
  verified: "Verified learners",
  activation: "Learning activation rate",
  "7d-active": "Seven-day active learners",
  completion: "Beginner-course completion rate",
  stuck: "Stuck learners",
  "advanced-eligible": "Advanced-course eligible learners",
};

function requireCount(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
}

export function calculateRatio(
  numerator: number,
  denominator: number | null,
  unavailableReason: "not-applicable" | "not-tracked" = "not-applicable",
): Ratio {
  if (denominator === null) {
    return { status: "unavailable", value: null, reason: unavailableReason };
  }
  if (denominator === 0) {
    return { status: "unavailable", value: null, reason: "zero-denominator" };
  }
  return { status: "available", value: numerator / denominator };
}

export function buildDashboardKpi(
  id: DashboardKpiId,
  input: DashboardKpiInput,
): DashboardKpi {
  requireCount(input.numerator, "numerator");
  requireCount(input.previousNumerator, "previousNumerator");
  if (input.denominator !== undefined) {
    requireCount(input.denominator, "denominator");
    if (input.numerator > input.denominator) {
      throw new Error("numerator cannot exceed denominator for a rate KPI.");
    }
  }
  if (!input.definition.trim()) {
    throw new Error("definition is required.");
  }
  if (!input.drilldown.path.trim()) {
    throw new Error("drilldown path is required.");
  }

  const denominator = input.denominator ?? null;
  const rate = calculateRatio(input.numerator, denominator);

  return {
    id,
    label: kpiLabels[id],
    numerator: input.numerator,
    denominator,
    value:
      rate.status === "available" ? rate.value : input.numerator,
    rate,
    comparison: {
      previousNumerator: input.previousNumerator,
      absoluteChange: input.numerator - input.previousNumerator,
      percentageChange: calculateRatio(
        input.numerator - input.previousNumerator,
        input.previousNumerator,
      ),
    },
    definition: input.definition,
    freshness: input.freshness,
    drilldown: input.drilldown,
  };
}

export const funnelStageIds = [
  "referral-landing",
  "registration-submitted",
  "uid-verified",
  "first-lesson-started",
  "first-lesson-passed",
  "beginner-course-completed",
  "advanced-course-eligible",
] as const;

export type FunnelStageId = (typeof funnelStageIds)[number];

export type FunnelStageInput = Readonly<{
  id: FunnelStageId;
  count: number | null;
  medianTimeToStageMinutes: number | null;
  drilldown: DashboardDrilldown;
}>;

export type FunnelStage = FunnelStageInput &
  Readonly<{
    conversionFromPrevious: Ratio;
    conversionFromFirstMeasured: Ratio;
  }>;

function unavailable(reason: "not-applicable" | "not-tracked"): Ratio {
  return { status: "unavailable", value: null, reason };
}

export function buildRecruitmentFunnel(
  inputs: readonly FunnelStageInput[],
): readonly FunnelStage[] {
  if (inputs.length !== funnelStageIds.length) {
    throw new Error("The funnel must contain every stage exactly once.");
  }
  if (inputs.some((stage, index) => stage.id !== funnelStageIds[index])) {
    throw new Error("Funnel stages must use the canonical order.");
  }

  for (const stage of inputs) {
    if (stage.count !== null) {
      requireCount(stage.count, `${stage.id}.count`);
    }
    if (
      stage.medianTimeToStageMinutes !== null &&
      (!Number.isFinite(stage.medianTimeToStageMinutes) ||
        stage.medianTimeToStageMinutes < 0)
    ) {
      throw new Error(
        `${stage.id}.medianTimeToStageMinutes must be non-negative.`,
      );
    }
  }

  const firstMeasuredIndex = inputs.findIndex((stage) => stage.count !== null);
  const firstMeasuredCount =
    firstMeasuredIndex === -1 ? null : inputs[firstMeasuredIndex].count;

  return inputs.map((stage, index) => {
    const previous = index === 0 ? null : inputs[index - 1];
    const conversionFromPrevious =
      stage.count === null
        ? unavailable("not-tracked")
        : previous === null
          ? unavailable("not-applicable")
          : previous.count === null
            ? unavailable("not-tracked")
            : calculateRatio(stage.count, previous.count);

    const conversionFromFirstMeasured =
      stage.count === null || firstMeasuredCount === null
        ? unavailable("not-tracked")
        : index === firstMeasuredIndex
          ? { status: "available" as const, value: 1 }
          : calculateRatio(stage.count, firstMeasuredCount);

    return {
      ...stage,
      conversionFromPrevious,
      conversionFromFirstMeasured,
    };
  });
}
