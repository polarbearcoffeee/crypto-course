export type AnalyticsEvent = Readonly<{
  eventId: string;
  learnerId: string;
  type:
    | "registration_submitted"
    | "uid_submitted"
    | "uid_verified"
    | "lesson_started"
    | "video_completed"
    | "quiz_submitted"
    | "quiz_passed"
    | "lesson_completed"
    | "course_completed"
    | "advanced_eligibility_granted";
  occurredAt: string;
  receivedAt?: string;
  sourceFirst?: string;
  sourceLatest?: string;
  courseId?: string;
  lessonId?: string;
  quizVersion?: string;
  questionId?: string;
  attempt?: number;
  correct?: boolean;
  passed?: boolean;
  durationSeconds?: number;
}>;

export type AggregateDimensions = Readonly<Record<string, string>>;

const DAY_MS = 86_400_000;

function uniqueLearners(events: readonly AnalyticsEvent[]): number {
  return new Set(events.map((event) => event.learnerId)).size;
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function dateKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export type DailyMetricAggregate = Readonly<{
  date: string;
  metric: AnalyticsEvent["type"];
  metricVersion: string;
  dimensions: AggregateDimensions;
  asOf: string;
  eventCount: number;
  learnerCount: number;
  lateEventCount: number;
}>;

export function aggregateDailyMetrics(
  events: readonly AnalyticsEvent[],
  options: Readonly<{
    metricVersion: string;
    asOf: string;
    dimensions?: AggregateDimensions;
    lateAfterDays?: number;
  }>,
): DailyMetricAggregate[] {
  const groups = new Map<string, AnalyticsEvent[]>();

  for (const event of events) {
    const key = `${dateKey(event.occurredAt)}\0${event.type}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const [date, metric] = key.split("\0") as [
        string,
        AnalyticsEvent["type"],
      ];
      const lateAfterMs = (options.lateAfterDays ?? 7) * DAY_MS;
      return {
        date,
        metric,
        metricVersion: options.metricVersion,
        dimensions: options.dimensions ?? {},
        asOf: options.asOf,
        eventCount: group.length,
        learnerCount: uniqueLearners(group),
        lateEventCount: group.filter((event) => {
          if (!event.receivedAt) return false;
          return (
            Date.parse(event.receivedAt) - Date.parse(event.occurredAt) >
            lateAfterMs
          );
        }).length,
      };
    })
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.metric.localeCompare(right.metric),
    );
}

const funnelStages = [
  ["registration", "registration_submitted"],
  ["uidSubmitted", "uid_submitted"],
  ["uidVerified", "uid_verified"],
  ["activated", "lesson_started"],
  ["completed", "course_completed"],
  ["advancedEligible", "advanced_eligibility_granted"],
] as const;

export type FunnelStage = Readonly<{
  stage: (typeof funnelStages)[number][0];
  learners: number;
  conversionFromPrevious: number;
  conversionFromRegistration: number;
}>;

export function aggregateFunnel(
  events: readonly AnalyticsEvent[],
): FunnelStage[] {
  let previous = 0;
  let registrations = 0;

  return funnelStages.map(([stage, eventType], index) => {
    const learners = uniqueLearners(
      events.filter((event) => event.type === eventType),
    );
    if (index === 0) registrations = learners;
    const result = {
      stage,
      learners,
      conversionFromPrevious:
        index === 0 ? (learners > 0 ? 1 : 0) : safeRate(learners, previous),
      conversionFromRegistration:
        index === 0 ? (learners > 0 ? 1 : 0) : safeRate(learners, registrations),
    };
    previous = learners;
    return result;
  });
}

export type CohortAggregate = Readonly<{
  cohort: string;
  registered: number;
  activated: number;
  completed: number;
  activationRate: number;
  completionRate: number;
}>;

function cohortKey(isoDate: string, granularity: "week" | "month"): string {
  const date = new Date(isoDate);
  if (granularity === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function aggregateRegistrationCohorts(
  events: readonly AnalyticsEvent[],
  granularity: "week" | "month",
): CohortAggregate[] {
  const registrations = events.filter(
    (event) => event.type === "registration_submitted",
  );
  const activated = new Set(
    events
      .filter((event) => event.type === "lesson_started")
      .map((event) => event.learnerId),
  );
  const completed = new Set(
    events
      .filter((event) => event.type === "course_completed")
      .map((event) => event.learnerId),
  );
  const cohorts = new Map<string, Set<string>>();

  for (const event of registrations) {
    const key = cohortKey(event.occurredAt, granularity);
    const learners = cohorts.get(key) ?? new Set<string>();
    learners.add(event.learnerId);
    cohorts.set(key, learners);
  }

  return [...cohorts.entries()]
    .map(([cohort, learners]) => {
      const registered = learners.size;
      const activatedCount = [...learners].filter((id) =>
        activated.has(id),
      ).length;
      const completedCount = [...learners].filter((id) =>
        completed.has(id),
      ).length;
      return {
        cohort,
        registered,
        activated: activatedCount,
        completed: completedCount,
        activationRate: safeRate(activatedCount, registered),
        completionRate: safeRate(completedCount, registered),
      };
    })
    .sort((left, right) => left.cohort.localeCompare(right.cohort));
}

export type LessonAggregate = Readonly<{
  lessonId: string;
  starts: number;
  attempts: number;
  passedAttempts: number;
  passRate: number;
  averageAttemptSeconds: number;
  dropOffLearners: number;
}>;

export type QuestionAggregate = Readonly<{
  lessonId: string;
  questionId: string;
  attempts: number;
  correctAttempts: number;
  correctnessRate: number;
  averageAttemptSeconds: number;
}>;

export function aggregateLessonAndQuestionPerformance(
  events: readonly AnalyticsEvent[],
): Readonly<{
  lessons: LessonAggregate[];
  questions: QuestionAggregate[];
}> {
  const lessonIds = new Set(
    events.flatMap((event) => (event.lessonId ? [event.lessonId] : [])),
  );
  const lessons = [...lessonIds].sort().map((lessonId) => {
    const lessonEvents = events.filter((event) => event.lessonId === lessonId);
    const starts = lessonEvents.filter(
      (event) => event.type === "lesson_started",
    );
    const attempts = lessonEvents.filter(
      (event) => event.type === "quiz_submitted",
    );
    const passedAttempts = attempts.filter(
      (event) => event.passed === true,
    ).length;
    const completedLearners = new Set(
      lessonEvents
        .filter((event) => event.type === "lesson_completed")
        .map((event) => event.learnerId),
    );
    const startedLearners = new Set(starts.map((event) => event.learnerId));
    const totalSeconds = attempts.reduce(
      (sum, event) => sum + (event.durationSeconds ?? 0),
      0,
    );
    return {
      lessonId,
      starts: starts.length,
      attempts: attempts.length,
      passedAttempts,
      passRate: safeRate(passedAttempts, attempts.length),
      averageAttemptSeconds: safeRate(totalSeconds, attempts.length),
      dropOffLearners: [...startedLearners].filter(
        (learnerId) => !completedLearners.has(learnerId),
      ).length,
    };
  });

  const questionKeys = new Set(
    events.flatMap((event) =>
      event.lessonId && event.questionId
        ? [`${event.lessonId}\0${event.questionId}`]
        : [],
    ),
  );
  const questions = [...questionKeys].sort().map((key) => {
    const [lessonId, questionId] = key.split("\0");
    const attempts = events.filter(
      (event) =>
        event.lessonId === lessonId &&
        event.questionId === questionId &&
        event.type === "quiz_submitted",
    );
    const correctAttempts = attempts.filter(
      (event) => event.correct === true,
    ).length;
    const totalSeconds = attempts.reduce(
      (sum, event) => sum + (event.durationSeconds ?? 0),
      0,
    );
    return {
      lessonId,
      questionId,
      attempts: attempts.length,
      correctAttempts,
      correctnessRate: safeRate(correctAttempts, attempts.length),
      averageAttemptSeconds: safeRate(totalSeconds, attempts.length),
    };
  });

  return { lessons, questions };
}

export type SourceAttributionAggregate = Readonly<{
  source: string;
  registeredLearners: number;
  completedLearners: number;
  completionRate: number;
}>;

function sourceAttribution(
  registrations: readonly AnalyticsEvent[],
  completed: ReadonlySet<string>,
  field: "sourceFirst" | "sourceLatest",
): SourceAttributionAggregate[] {
  const groups = new Map<string, Set<string>>();
  for (const event of registrations) {
    const source = event[field] ?? "unknown";
    const learners = groups.get(source) ?? new Set<string>();
    learners.add(event.learnerId);
    groups.set(source, learners);
  }
  return [...groups.entries()]
    .map(([source, learners]) => {
      const completedLearners = [...learners].filter((learnerId) =>
        completed.has(learnerId),
      ).length;
      return {
        source,
        registeredLearners: learners.size,
        completedLearners,
        completionRate: safeRate(completedLearners, learners.size),
      };
    })
    .sort((left, right) => left.source.localeCompare(right.source));
}

export function aggregateSourceAttribution(
  events: readonly AnalyticsEvent[],
): Readonly<{
  firstTouch: SourceAttributionAggregate[];
  latestTouch: SourceAttributionAggregate[];
}> {
  const registrations = events.filter(
    (event) => event.type === "registration_submitted",
  );
  const completed = new Set(
    events
      .filter((event) => event.type === "course_completed")
      .map((event) => event.learnerId),
  );
  return {
    firstTouch: sourceAttribution(registrations, completed, "sourceFirst"),
    latestTouch: sourceAttribution(registrations, completed, "sourceLatest"),
  };
}
