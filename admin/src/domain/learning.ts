export type LearningEventType =
  | "lesson_started"
  | "video_marked_watched"
  | "quiz_started"
  | "quiz_submitted"
  | "lesson_completed";

export interface LearningEvent {
  readonly eventId: string;
  readonly type: LearningEventType;
  readonly learnerId: string;
  readonly courseVersion: string;
  readonly lessonId: string;
  /** Authoritative time assigned by the trusted ingestion boundary. */
  readonly occurredAt: string;
  readonly receivedAt: string;
  /** Informational only. It never controls ordering, XP, or progress. */
  readonly clientOccurredAt?: string;
  readonly quizVersion?: string;
  readonly properties?: Readonly<{
    passed?: boolean;
    score?: number;
  }>;
}

export interface XpRule {
  readonly ruleId: string;
  readonly eventType: LearningEventType;
  readonly amount: number;
  readonly requiresPassedQuiz?: boolean;
  readonly oncePer:
    | "event"
    | "learner-course-lesson"
    | "learner-course-lesson-quiz";
}

export interface XpRuleSet {
  readonly version: string;
  readonly rules: readonly XpRule[];
}

export interface XpLedgerEntry {
  readonly ledgerId: string;
  readonly learnerId: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly sourceEventId: string;
  readonly idempotencyKey: string;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly awardedAt: string;
}

export interface LearningState {
  readonly events: readonly LearningEvent[];
  readonly xpLedger: readonly XpLedgerEntry[];
}

export interface AcceptResult {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly event: LearningEvent;
  readonly xpAwarded: number;
  readonly ledgerEntry?: XpLedgerEntry;
}

export interface LessonProgress {
  readonly lessonId: string;
  readonly startedAt?: string;
  readonly watchedAt?: string;
  readonly passedAt?: string;
  readonly completedAt?: string;
  readonly quizAttempts: number;
  readonly completed: boolean;
}

export interface LearnerProgressSummary {
  readonly learnerId: string;
  readonly courseVersion: string;
  readonly lessons: readonly LessonProgress[];
  readonly currentLessonId?: string;
  readonly completedLessonCount: number;
  readonly totalXp: number;
  readonly lastProgressAt?: string;
}

export const DEFAULT_XP_RULE_SET: XpRuleSet = Object.freeze({
  version: "xp-v1",
  rules: Object.freeze([
    Object.freeze({
      ruleId: "watch-lesson",
      eventType: "video_marked_watched",
      amount: 10,
      oncePer: "learner-course-lesson",
    }),
    Object.freeze({
      ruleId: "pass-quiz",
      eventType: "quiz_submitted",
      amount: 30,
      requiresPassedQuiz: true,
      oncePer: "learner-course-lesson-quiz",
    }),
    Object.freeze({
      ruleId: "complete-lesson",
      eventType: "lesson_completed",
      amount: 20,
      oncePer: "learner-course-lesson",
    }),
  ]),
});

const LESSON_ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i;

export function emptyLearningState(): LearningState {
  return Object.freeze({
    events: Object.freeze([]),
    xpLedger: Object.freeze([]),
  });
}

export function acceptLearningEvent(
  state: LearningState,
  event: LearningEvent,
  ruleSet: XpRuleSet = DEFAULT_XP_RULE_SET,
): Readonly<{ state: LearningState; result: AcceptResult }> {
  validateEvent(event);
  validateRuleSet(ruleSet);

  const existingEvent = state.events.find(
    (candidate) => candidate.eventId === event.eventId,
  );
  if (existingEvent) {
    const existingAward = state.xpLedger.find(
      (entry) => entry.sourceEventId === event.eventId,
    );
    return Object.freeze({
      state,
      result: Object.freeze({
        accepted: true,
        duplicate: true,
        event: existingEvent,
        xpAwarded: 0,
        ledgerEntry: existingAward,
      }),
    });
  }

  const acceptedEvent = freezeEvent(event);
  const applicableRule = ruleSet.rules.find(
    (rule) =>
      rule.eventType === event.type &&
      (!rule.requiresPassedQuiz || event.properties?.passed === true),
  );

  let ledgerEntry: XpLedgerEntry | undefined;
  if (applicableRule) {
    const idempotencyKey = buildXpIdempotencyKey(
      applicableRule,
      acceptedEvent,
      ruleSet.version,
    );
    const alreadyAwarded = state.xpLedger.some(
      (entry) => entry.idempotencyKey === idempotencyKey,
    );

    if (!alreadyAwarded) {
      const balanceBefore = state.xpLedger
        .filter((entry) => entry.learnerId === event.learnerId)
        .reduce((total, entry) => total + entry.amount, 0);
      ledgerEntry = Object.freeze({
        ledgerId: `xp:${idempotencyKey}`,
        learnerId: event.learnerId,
        ruleId: applicableRule.ruleId,
        ruleVersion: ruleSet.version,
        sourceEventId: event.eventId,
        idempotencyKey,
        amount: applicableRule.amount,
        balanceAfter: balanceBefore + applicableRule.amount,
        awardedAt: event.occurredAt,
      });
    }
  }

  const nextState: LearningState = Object.freeze({
    events: Object.freeze([...state.events, acceptedEvent]),
    xpLedger: ledgerEntry
      ? Object.freeze([...state.xpLedger, ledgerEntry])
      : state.xpLedger,
  });

  return Object.freeze({
    state: nextState,
    result: Object.freeze({
      accepted: true,
      duplicate: false,
      event: acceptedEvent,
      xpAwarded: ledgerEntry?.amount ?? 0,
      ledgerEntry,
    }),
  });
}

export function deriveLearnerProgress(
  events: readonly LearningEvent[],
  xpLedger: readonly XpLedgerEntry[],
  learnerId: string,
  courseVersion: string,
): LearnerProgressSummary {
  const relevantEvents = events
    .filter(
      (event) =>
        event.learnerId === learnerId &&
        event.courseVersion === courseVersion,
    )
    .sort(compareServerTime);
  const lessonIds = [...new Set(relevantEvents.map((event) => event.lessonId))];

  const lessons = lessonIds.map((lessonId): LessonProgress => {
    const lessonEvents = relevantEvents.filter(
      (event) => event.lessonId === lessonId,
    );
    const firstTime = (type: LearningEventType) =>
      lessonEvents.find((event) => event.type === type)?.occurredAt;

    return Object.freeze({
      lessonId,
      startedAt: firstTime("lesson_started"),
      watchedAt: firstTime("video_marked_watched"),
      passedAt: lessonEvents.find(
        (event) =>
          event.type === "quiz_submitted" &&
          event.properties?.passed === true,
      )?.occurredAt,
      completedAt: firstTime("lesson_completed"),
      quizAttempts: lessonEvents.filter(
        (event) => event.type === "quiz_submitted",
      ).length,
      completed: lessonEvents.some(
        (event) => event.type === "lesson_completed",
      ),
    });
  });

  const latestEvent = relevantEvents.at(-1);
  const relevantEventIds = new Set(
    relevantEvents.map((event) => event.eventId),
  );
  const currentLesson =
    [...lessons].reverse().find((lesson) => !lesson.completed) ??
    lessons.at(-1);

  return Object.freeze({
    learnerId,
    courseVersion,
    lessons: Object.freeze(lessons),
    currentLessonId: currentLesson?.lessonId,
    completedLessonCount: lessons.filter((lesson) => lesson.completed).length,
    totalXp: xpLedger
      .filter(
        (entry) =>
          entry.learnerId === learnerId &&
          relevantEventIds.has(entry.sourceEventId),
      )
      .reduce((total, entry) => total + entry.amount, 0),
    lastProgressAt: latestEvent?.occurredAt,
  });
}

function validateEvent(event: LearningEvent): void {
  if (!event.eventId.trim()) throw new Error("eventId is required");
  if (!event.learnerId.trim()) throw new Error("learnerId is required");
  if (!event.courseVersion.trim()) throw new Error("courseVersion is required");
  if (!LESSON_ID_PATTERN.test(event.lessonId)) {
    throw new Error(`Malformed lesson ID: ${event.lessonId}`);
  }
  if (!isIsoDate(event.occurredAt) || !isIsoDate(event.receivedAt)) {
    throw new Error("Server timestamps must be valid ISO dates");
  }
  if (event.type === "quiz_submitted" && !event.quizVersion?.trim()) {
    throw new Error("quizVersion is required for quiz_submitted");
  }
}

function validateRuleSet(ruleSet: XpRuleSet): void {
  if (!ruleSet.version.trim()) throw new Error("XP rule version is required");
  const ids = new Set<string>();
  for (const rule of ruleSet.rules) {
    if (!rule.ruleId.trim() || ids.has(rule.ruleId)) {
      throw new Error(`XP rule IDs must be unique: ${rule.ruleId}`);
    }
    if (!Number.isInteger(rule.amount)) {
      throw new Error(`XP amount must be an integer: ${rule.ruleId}`);
    }
    ids.add(rule.ruleId);
  }
}

function buildXpIdempotencyKey(
  rule: XpRule,
  event: LearningEvent,
  ruleVersion: string,
): string {
  const base = [
    ruleVersion,
    rule.ruleId,
    event.learnerId,
    event.courseVersion,
  ];
  if (rule.oncePer !== "event") base.push(event.lessonId);
  if (rule.oncePer === "learner-course-lesson-quiz") {
    base.push(event.quizVersion ?? "");
  }
  if (rule.oncePer === "event") base.push(event.eventId);
  return base.join(":");
}

function freezeEvent(event: LearningEvent): LearningEvent {
  return Object.freeze({
    ...event,
    properties: event.properties
      ? Object.freeze({ ...event.properties })
      : undefined,
  });
}

function compareServerTime(left: LearningEvent, right: LearningEvent): number {
  const byTime =
    new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
  return byTime || left.eventId.localeCompare(right.eventId);
}

function isIsoDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
