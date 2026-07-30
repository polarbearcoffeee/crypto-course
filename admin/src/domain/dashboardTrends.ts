import type { AnalyticsEvent } from "./aggregates";

export const dashboardTrendMetrics = [
  "registration",
  "verification",
  "activation",
  "active",
  "completion",
] as const;

export type DashboardTrendMetric = (typeof dashboardTrendMetrics)[number];
export type DashboardTrendGranularity = "day" | "week";

export type DashboardTrendValue =
  | Readonly<{ status: "measured"; value: number }>
  | Readonly<{ status: "tracking-not-started"; value: null }>;

export type DashboardTrendPoint = Readonly<{
  periodStart: string;
  periodEnd: string;
  granularity: DashboardTrendGranularity;
  metrics: Readonly<Record<DashboardTrendMetric, DashboardTrendValue>>;
}>;

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

const eventTypesByMetric = {
  registration: ["registration_submitted"],
  verification: ["uid_verified"],
  activation: ["lesson_started"],
  active: [
    "lesson_started",
    "video_completed",
    "quiz_submitted",
    "quiz_passed",
    "lesson_completed",
  ],
  completion: ["course_completed"],
} as const satisfies Record<
  DashboardTrendMetric,
  readonly AnalyticsEvent["type"][]
>;

function taipeiDateStart(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Invalid local date: ${date}`);

  const timestamp =
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) -
    TAIPEI_OFFSET_MS;
  if (taipeiDateKey(timestamp) !== date) {
    throw new RangeError(`Invalid local date: ${date}`);
  }
  return timestamp;
}

function taipeiDateKey(timestamp: number): string {
  return new Date(timestamp + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

function mondayStart(timestamp: number): number {
  const shifted = new Date(timestamp + TAIPEI_OFFSET_MS);
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  return timestamp - daysSinceMonday * DAY_MS;
}

function metricForEvent(
  type: AnalyticsEvent["type"],
): readonly DashboardTrendMetric[] {
  return dashboardTrendMetrics.filter((metric) =>
    eventTypesByMetric[metric].some((candidate) => candidate === type),
  );
}

export function buildDashboardTrends(
  events: readonly AnalyticsEvent[],
  options: Readonly<{
    startDate: string;
    endDate: string;
    granularity: DashboardTrendGranularity;
    trackingStartedAt: string;
  }>,
): DashboardTrendPoint[] {
  const requestedStart = taipeiDateStart(options.startDate);
  const requestedEndExclusive = taipeiDateStart(options.endDate) + DAY_MS;
  const trackingStartedAt = Date.parse(options.trackingStartedAt);

  if (requestedStart >= requestedEndExclusive) {
    throw new RangeError("startDate must not be after endDate");
  }
  if (!Number.isFinite(trackingStartedAt)) {
    throw new RangeError("trackingStartedAt must be an ISO date-time");
  }

  const bucketSize =
    options.granularity === "week" ? 7 * DAY_MS : DAY_MS;
  const firstBucket =
    options.granularity === "week"
      ? mondayStart(requestedStart)
      : requestedStart;
  const learnersByBucket = new Map<
    number,
    Record<DashboardTrendMetric, Set<string>>
  >();

  for (const event of events) {
    const occurredAt = Date.parse(event.occurredAt);
    if (
      !Number.isFinite(occurredAt) ||
      occurredAt < requestedStart ||
      occurredAt >= requestedEndExclusive ||
      occurredAt < trackingStartedAt
    ) {
      continue;
    }

    const localDayStart =
      taipeiDateStart(taipeiDateKey(occurredAt));
    const bucketStart =
      options.granularity === "week"
        ? mondayStart(localDayStart)
        : localDayStart;
    let bucket = learnersByBucket.get(bucketStart);
    if (!bucket) {
      bucket = {
        registration: new Set(),
        verification: new Set(),
        activation: new Set(),
        active: new Set(),
        completion: new Set(),
      };
      learnersByBucket.set(bucketStart, bucket);
    }
    for (const metric of metricForEvent(event.type)) {
      bucket[metric].add(event.learnerId);
    }
  }

  const points: DashboardTrendPoint[] = [];
  for (
    let bucketStart = firstBucket;
    bucketStart < requestedEndExclusive;
    bucketStart += bucketSize
  ) {
    const bucketEndExclusive = bucketStart + bucketSize;
    const visibleStart = Math.max(bucketStart, requestedStart);
    const visibleEndExclusive = Math.min(
      bucketEndExclusive,
      requestedEndExclusive,
    );
    const hasTracking = visibleEndExclusive > trackingStartedAt;
    const bucket = learnersByBucket.get(bucketStart);
    const metrics = Object.fromEntries(
      dashboardTrendMetrics.map((metric) => [
        metric,
        hasTracking
          ? { status: "measured" as const, value: bucket?.[metric].size ?? 0 }
          : { status: "tracking-not-started" as const, value: null },
      ]),
    ) as Record<DashboardTrendMetric, DashboardTrendValue>;

    points.push({
      periodStart: taipeiDateKey(visibleStart),
      periodEnd: taipeiDateKey(visibleEndExclusive - 1),
      granularity: options.granularity,
      metrics,
    });
  }

  return points;
}
