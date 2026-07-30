import type { AnalyticsEvent } from "./aggregates";
import { calculateRatio, type Ratio } from "./dashboardModel";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const TAIPEI_OFFSET_MS = 8 * 60 * MINUTE_MS;

export type DashboardTableMetric = Readonly<{
  numerator: number;
  denominator: number;
  rate: Ratio;
}>;

function metric(
  numerator: number,
  denominator: number,
): DashboardTableMetric {
  return { numerator, denominator, rate: calculateRatio(numerator, denominator) };
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be an ISO date-time.`);
  }
  return parsed;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function earliestRegistrationByLearner(
  events: readonly AnalyticsEvent[],
): Map<string, AnalyticsEvent> {
  const registrations = new Map<string, AnalyticsEvent>();
  for (const event of events) {
    if (event.type !== "registration_submitted") continue;
    const current = registrations.get(event.learnerId);
    if (
      !current ||
      timestamp(event.occurredAt, "event.occurredAt") <
        timestamp(current.occurredAt, "event.occurredAt")
    ) {
      registrations.set(event.learnerId, event);
    }
  }
  return registrations;
}

function learnerEventTimes(
  events: readonly AnalyticsEvent[],
  types: ReadonlySet<AnalyticsEvent["type"]>,
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const event of events) {
    if (!types.has(event.type)) continue;
    const times = result.get(event.learnerId) ?? [];
    times.push(timestamp(event.occurredAt, "event.occurredAt"));
    result.set(event.learnerId, times);
  }
  return result;
}

function taipeiCohortKey(
  occurredAt: string,
  granularity: "week" | "month",
): string {
  const local = new Date(
    timestamp(occurredAt, "registration.occurredAt") + TAIPEI_OFFSET_MS,
  );
  if (granularity === "month") {
    return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const day = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - day + 1);
  return local.toISOString().slice(0, 10);
}

export type RegistrationCohortRow = Readonly<{
  cohort: string;
  registeredLearners: number;
  dayOneActivation: DashboardTableMetric;
  daySevenRetention: DashboardTableMetric;
  completion: DashboardTableMetric;
}>;

const learningActivityTypes = new Set<AnalyticsEvent["type"]>([
  "lesson_started",
  "video_completed",
  "quiz_submitted",
  "quiz_passed",
  "lesson_completed",
  "course_completed",
]);

export function buildRegistrationCohortMatrix(
  events: readonly AnalyticsEvent[],
  options: Readonly<{
    granularity: "week" | "month";
    asOf: string;
  }>,
): RegistrationCohortRow[] {
  const asOf = timestamp(options.asOf, "asOf");
  const registrations = earliestRegistrationByLearner(events);
  const starts = learnerEventTimes(events, new Set(["lesson_started"]));
  const activity = learnerEventTimes(events, learningActivityTypes);
  const completions = learnerEventTimes(events, new Set(["course_completed"]));
  const cohorts = new Map<string, AnalyticsEvent[]>();

  for (const registration of registrations.values()) {
    const key = taipeiCohortKey(registration.occurredAt, options.granularity);
    cohorts.set(key, [...(cohorts.get(key) ?? []), registration]);
  }

  return [...cohorts.entries()]
    .map(([cohort, cohortRegistrations]) => {
      let activationEligible = 0;
      let activated = 0;
      let retentionEligible = 0;
      let retained = 0;
      let completed = 0;

      for (const registration of cohortRegistrations) {
        const registeredAt = timestamp(
          registration.occurredAt,
          "registration.occurredAt",
        );
        if (registeredAt + DAY_MS <= asOf) {
          activationEligible += 1;
          if (
            (starts.get(registration.learnerId) ?? []).some(
              (time) => time >= registeredAt && time < registeredAt + DAY_MS,
            )
          ) {
            activated += 1;
          }
        }
        if (registeredAt + 8 * DAY_MS <= asOf) {
          retentionEligible += 1;
          if (
            (activity.get(registration.learnerId) ?? []).some(
              (time) =>
                time >= registeredAt + 7 * DAY_MS &&
                time < registeredAt + 8 * DAY_MS,
            )
          ) {
            retained += 1;
          }
        }
        if (
          (completions.get(registration.learnerId) ?? []).some(
            (time) => time >= registeredAt && time <= asOf,
          )
        ) {
          completed += 1;
        }
      }

      return {
        cohort,
        registeredLearners: cohortRegistrations.length,
        dayOneActivation: metric(activated, activationEligible),
        daySevenRetention: metric(retained, retentionEligible),
        completion: metric(completed, cohortRegistrations.length),
      };
    })
    .sort((left, right) => left.cohort.localeCompare(right.cohort));
}

export type SourcePerformanceRow = Readonly<{
  source: string;
  registeredLearners: number;
  verification: DashboardTableMetric;
  activation: DashboardTableMetric;
  completion: DashboardTableMetric;
  sevenDayActivity: DashboardTableMetric;
  advancedEligibility: DashboardTableMetric;
  medianMinutesToFirstLesson: number | null;
}>;

function normalizedSource(
  event: AnalyticsEvent,
  attribution: "first-touch" | "latest-touch",
): string {
  const source =
    attribution === "first-touch" ? event.sourceFirst : event.sourceLatest;
  return source?.trim() || "unknown";
}

function hasEventInRange(
  times: readonly number[],
  start: number,
  endInclusive: number,
): boolean {
  return times.some((time) => time >= start && time <= endInclusive);
}

export function buildSourcePerformanceTable(
  events: readonly AnalyticsEvent[],
  options: Readonly<{
    asOf: string;
    attribution?: "first-touch" | "latest-touch";
    activeWindowDays?: number;
  }>,
): SourcePerformanceRow[] {
  const asOf = timestamp(options.asOf, "asOf");
  const activeWindowDays = options.activeWindowDays ?? 7;
  if (!Number.isInteger(activeWindowDays) || activeWindowDays <= 0) {
    throw new Error("activeWindowDays must be a positive integer.");
  }
  const registrations = earliestRegistrationByLearner(events);
  const groups = new Map<string, AnalyticsEvent[]>([
    ["direct", []],
    ["unknown", []],
  ]);
  for (const registration of registrations.values()) {
    const source = normalizedSource(
      registration,
      options.attribution ?? "first-touch",
    );
    groups.set(source, [...(groups.get(source) ?? []), registration]);
  }

  const verified = learnerEventTimes(events, new Set(["uid_verified"]));
  const started = learnerEventTimes(events, new Set(["lesson_started"]));
  const completed = learnerEventTimes(events, new Set(["course_completed"]));
  const active = learnerEventTimes(events, learningActivityTypes);
  const advanced = learnerEventTimes(
    events,
    new Set(["advanced_eligibility_granted"]),
  );
  const activeFrom = asOf - activeWindowDays * DAY_MS;

  return [...groups.entries()]
    .map(([source, sourceRegistrations]) => {
      let verifiedLearners = 0;
      let activatedLearners = 0;
      let completedLearners = 0;
      let activeLearners = 0;
      let advancedLearners = 0;
      const minutesToFirstLesson: number[] = [];

      for (const registration of sourceRegistrations) {
        const registeredAt = timestamp(
          registration.occurredAt,
          "registration.occurredAt",
        );
        const learnerId = registration.learnerId;
        if (hasEventInRange(verified.get(learnerId) ?? [], registeredAt, asOf)) {
          verifiedLearners += 1;
        }
        const firstStart = (started.get(learnerId) ?? [])
          .filter((time) => time >= registeredAt && time <= asOf)
          .sort((left, right) => left - right)[0];
        if (firstStart !== undefined) {
          activatedLearners += 1;
          minutesToFirstLesson.push((firstStart - registeredAt) / MINUTE_MS);
        }
        if (hasEventInRange(completed.get(learnerId) ?? [], registeredAt, asOf)) {
          completedLearners += 1;
        }
        if (
          hasEventInRange(
            active.get(learnerId) ?? [],
            Math.max(activeFrom, registeredAt),
            asOf,
          )
        ) {
          activeLearners += 1;
        }
        if (hasEventInRange(advanced.get(learnerId) ?? [], registeredAt, asOf)) {
          advancedLearners += 1;
        }
      }

      const denominator = sourceRegistrations.length;
      return {
        source,
        registeredLearners: denominator,
        verification: metric(verifiedLearners, denominator),
        activation: metric(activatedLearners, denominator),
        completion: metric(completedLearners, denominator),
        sevenDayActivity: metric(activeLearners, denominator),
        advancedEligibility: metric(advancedLearners, denominator),
        medianMinutesToFirstLesson: median(minutesToFirstLesson),
      };
    })
    .sort((left, right) => left.source.localeCompare(right.source));
}

export type LessonPerformanceRow = Readonly<{
  lessonId: string;
  nextLessonId: string | null;
  startedLearners: number;
  videoMarkedLearners: number;
  quizAttempts: number;
  firstAttemptPass: DashboardTableMetric;
  overallPass: DashboardTableMetric;
  averageAttemptsToPass: number | null;
  medianCompletionMinutes: number | null;
  dropOffLearners: number;
  dropOffRate: Ratio;
}>;

type TimedAttempt = Readonly<{
  occurredAt: number;
  attempt?: number;
  passed: boolean;
}>;

function byAttemptThenTime(left: TimedAttempt, right: TimedAttempt): number {
  if (left.attempt !== undefined && right.attempt !== undefined) {
    return left.attempt - right.attempt || left.occurredAt - right.occurredAt;
  }
  return left.occurredAt - right.occurredAt;
}

export function buildLessonPerformanceTable(
  events: readonly AnalyticsEvent[],
  lessonOrder?: readonly string[],
): LessonPerformanceRow[] {
  const eventLessonIds = events.flatMap((event) =>
    event.lessonId ? [event.lessonId] : [],
  );
  const ids = lessonOrder
    ? [...new Set([...lessonOrder, ...eventLessonIds])]
    : [...new Set(eventLessonIds)].sort();

  return ids.map((lessonId, index) => {
    const lessonEvents = events.filter((event) => event.lessonId === lessonId);
    const startedAt = learnerEventTimes(
      lessonEvents,
      new Set(["lesson_started"]),
    );
    const videoMarked = learnerEventTimes(
      lessonEvents,
      new Set(["video_completed"]),
    );
    const completedAt = learnerEventTimes(
      lessonEvents,
      new Set(["lesson_completed"]),
    );
    const attemptsByLearner = new Map<string, TimedAttempt[]>();
    const quizEvents = lessonEvents.filter(
      (event) => event.type === "quiz_submitted",
    );
    for (const event of quizEvents) {
      const attempts = attemptsByLearner.get(event.learnerId) ?? [];
      attempts.push({
        occurredAt: timestamp(event.occurredAt, "event.occurredAt"),
        attempt: event.attempt,
        passed: event.passed === true,
      });
      attemptsByLearner.set(event.learnerId, attempts);
    }

    let firstAttemptPassed = 0;
    let passedLearners = 0;
    let attemptsUntilPass = 0;
    for (const attempts of attemptsByLearner.values()) {
      const ordered = [...attempts].sort(byAttemptThenTime);
      if (ordered[0]?.passed) firstAttemptPassed += 1;
      const firstPassIndex = ordered.findIndex((attempt) => attempt.passed);
      if (firstPassIndex >= 0) {
        passedLearners += 1;
        attemptsUntilPass += firstPassIndex + 1;
      }
    }

    const completionMinutes: number[] = [];
    for (const [learnerId, starts] of startedAt) {
      const firstStart = Math.min(...starts);
      const firstCompletion = (completedAt.get(learnerId) ?? [])
        .filter((time) => time >= firstStart)
        .sort((left, right) => left - right)[0];
      if (firstCompletion !== undefined) {
        completionMinutes.push((firstCompletion - firstStart) / MINUTE_MS);
      }
    }

    const nextLessonId = ids[index + 1] ?? null;
    const dropOffPopulation = nextLessonId
      ? new Set(completedAt.keys())
      : new Set(startedAt.keys());
    const progressedLearners = nextLessonId
      ? new Set(
          events
            .filter(
              (event) =>
                event.lessonId === nextLessonId &&
                event.type === "lesson_started",
            )
            .map((event) => event.learnerId),
        )
      : new Set(completedAt.keys());
    const dropOffLearners = [...dropOffPopulation].filter(
      (learnerId) => !progressedLearners.has(learnerId),
    ).length;

    return {
      lessonId,
      nextLessonId,
      startedLearners: startedAt.size,
      videoMarkedLearners: videoMarked.size,
      quizAttempts: quizEvents.length,
      firstAttemptPass: metric(firstAttemptPassed, attemptsByLearner.size),
      overallPass: metric(passedLearners, attemptsByLearner.size),
      averageAttemptsToPass:
        passedLearners === 0 ? null : attemptsUntilPass / passedLearners,
      medianCompletionMinutes: median(completionMinutes),
      dropOffLearners,
      dropOffRate: calculateRatio(dropOffLearners, dropOffPopulation.size),
    };
  });
}

export const operationalQueueIds = [
  "pending-uid",
  "needs-correction",
  "not-activated",
  "stuck",
  "failed-sync",
  "invalid-content",
  "unpublished-draft",
  "alerts",
] as const;

export type OperationalQueueId = (typeof operationalQueueIds)[number];

export type OperationalQueueItem = Readonly<{
  queueId: OperationalQueueId;
  itemId: string;
  createdAt: string;
}>;

export type OperationalQueueCard = Readonly<{
  id: OperationalQueueId;
  label: string;
  count: number;
  oldestAgeMinutes: number | null;
  responsibleRole: "owner" | "lead-teacher" | "assistant" | "content-editor";
  actionPath: string;
}>;

const queueDefinitions: Readonly<
  Record<
    OperationalQueueId,
    Omit<OperationalQueueCard, "id" | "count" | "oldestAgeMinutes">
  >
> = {
  "pending-uid": {
    label: "Pending UID verification",
    responsibleRole: "assistant",
    actionPath: "/learners?uid-status=pending&sort=oldest",
  },
  "needs-correction": {
    label: "UID correction required",
    responsibleRole: "assistant",
    actionPath: "/learners?uid-status=needs-correction&sort=oldest",
  },
  "not-activated": {
    label: "Registered but not activated",
    responsibleRole: "lead-teacher",
    actionPath: "/learners?learning-state=registered&sort=oldest",
  },
  stuck: {
    label: "Stuck learners",
    responsibleRole: "lead-teacher",
    actionPath: "/learners?learning-state=stuck&sort=oldest",
  },
  "failed-sync": {
    label: "Failed data sync",
    responsibleRole: "owner",
    actionPath: "/operations/health?queue=failed-sync",
  },
  "invalid-content": {
    label: "Content validation failures",
    responsibleRole: "content-editor",
    actionPath: "/curriculum?health=invalid",
  },
  "unpublished-draft": {
    label: "Unpublished draft changes",
    responsibleRole: "content-editor",
    actionPath: "/curriculum?status=draft",
  },
  alerts: {
    label: "Unresolved system alerts",
    responsibleRole: "owner",
    actionPath: "/operations/health?state=open",
  },
};

export function buildOperationalQueueCards(
  items: readonly OperationalQueueItem[],
  asOf: string,
): OperationalQueueCard[] {
  const now = timestamp(asOf, "asOf");
  const uniqueItems = new Map<string, OperationalQueueItem>();
  for (const item of items) {
    if (!item.itemId.trim()) throw new Error("itemId is required.");
    const createdAt = timestamp(item.createdAt, "item.createdAt");
    if (createdAt > now) {
      throw new Error("item.createdAt cannot be after asOf.");
    }
    const key = `${item.queueId}\0${item.itemId}`;
    const current = uniqueItems.get(key);
    if (
      !current ||
      createdAt < timestamp(current.createdAt, "item.createdAt")
    ) {
      uniqueItems.set(key, item);
    }
  }

  return operationalQueueIds.map((id) => {
    const queueItems = [...uniqueItems.values()].filter(
      (item) => item.queueId === id,
    );
    const oldestAt =
      queueItems.length === 0
        ? null
        : Math.min(
            ...queueItems.map((item) =>
              timestamp(item.createdAt, "item.createdAt"),
            ),
          );
    return {
      id,
      ...queueDefinitions[id],
      count: queueItems.length,
      oldestAgeMinutes:
        oldestAt === null ? null : Math.floor((now - oldestAt) / MINUTE_MS),
    };
  });
}
