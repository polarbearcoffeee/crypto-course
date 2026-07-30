export const PLATFORM_ENVIRONMENTS = [
  "development",
  "test",
  "staging",
  "production",
] as const;

export type PlatformEnvironment = (typeof PLATFORM_ENVIRONMENTS)[number];

export type XpAction =
  | "lesson-completed"
  | "quiz-passed"
  | "daily-check-in"
  | "course-completed";

export type LearningRules = Readonly<{
  xpAwards: Readonly<Record<XpAction, number>>;
  passingThreshold: number;
  unlock: Readonly<{
    requireVideoCompletion: boolean;
    requireQuizPass: boolean;
  }>;
  streakMilestones: readonly number[];
  stuckAfterDays: number;
  activityWindowDays: number;
}>;

export type LearnerRuleSnapshot = Readonly<{
  environment: PlatformEnvironment;
  learnerId: string;
  quizScore?: number;
  videoCompleted: boolean;
  quizPassed: boolean;
  streakDays: number;
  daysSinceLastActivity: number;
  courseCompleted: boolean;
  xpAction?: XpAction;
}>;

export type SettingsVersion = Readonly<{
  environment: PlatformEnvironment;
  versionId: string;
  previousVersionId?: string;
  restoredFromVersionId?: string;
  changeKind: "initial" | "update" | "rollback";
  beforeRules?: LearningRules;
  rules: LearningRules;
  actorId: string;
  reason: string;
  activatedAt: string;
}>;

export type SettingsImpactReason =
  | "xp-award"
  | "passing-threshold"
  | "unlock-requirement"
  | "streak-milestone"
  | "stuck-period"
  | "activity-window";

export type SettingsImpactPreview = Readonly<{
  environment: PlatformEnvironment;
  baseVersionId: string;
  proposedRules: LearningRules;
  evaluatedLearnerCount: number;
  affectedLearnerCount: number;
  affectedLearnerIds: readonly string[];
  affectedByRule: Readonly<Record<SettingsImpactReason, number>>;
}>;

const IMPACT_REASONS: readonly SettingsImpactReason[] = [
  "xp-award",
  "passing-threshold",
  "unlock-requirement",
  "streak-milestone",
  "stuck-period",
  "activity-window",
];

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requireIsoDateTime(value: string, label: string): string {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO date-time with an offset.`);
  }
  return value;
}

function cloneRules(rules: LearningRules): LearningRules {
  return {
    xpAwards: { ...rules.xpAwards },
    passingThreshold: rules.passingThreshold,
    unlock: { ...rules.unlock },
    streakMilestones: [...rules.streakMilestones],
    stuckAfterDays: rules.stuckAfterDays,
    activityWindowDays: rules.activityWindowDays,
  };
}

function validateRules(rules: LearningRules): LearningRules {
  const xpValues = Object.values(rules.xpAwards);
  if (
    xpValues.length !== 4 ||
    xpValues.some((value) => !Number.isInteger(value) || value < 0)
  ) {
    throw new Error("Every XP award must be a non-negative integer.");
  }
  if (
    !Number.isFinite(rules.passingThreshold) ||
    rules.passingThreshold < 0 ||
    rules.passingThreshold > 100
  ) {
    throw new Error("Passing threshold must be between 0 and 100.");
  }
  const milestones = [...rules.streakMilestones];
  if (
    milestones.length === 0 ||
    milestones.some((value) => !Number.isInteger(value) || value <= 0) ||
    milestones.some((value, index) => index > 0 && value <= milestones[index - 1])
  ) {
    throw new Error("Streak milestones must be unique positive integers in order.");
  }
  if (!Number.isInteger(rules.stuckAfterDays) || rules.stuckAfterDays <= 0) {
    throw new Error("Stuck period must be a positive integer.");
  }
  if (!Number.isInteger(rules.activityWindowDays) || rules.activityWindowDays <= 0) {
    throw new Error("Activity window must be a positive integer.");
  }
  return cloneRules(rules);
}

function latestMilestone(rules: LearningRules, streakDays: number): number {
  return (
    [...rules.streakMilestones]
      .reverse()
      .find((milestone) => milestone <= streakDays) ?? 0
  );
}

function canUnlock(rules: LearningRules, learner: LearnerRuleSnapshot): boolean {
  return (
    (!rules.unlock.requireVideoCompletion || learner.videoCompleted) &&
    (!rules.unlock.requireQuizPass || learner.quizPassed)
  );
}

function impactReasons(
  current: LearningRules,
  proposed: LearningRules,
  learner: LearnerRuleSnapshot,
): SettingsImpactReason[] {
  const reasons: SettingsImpactReason[] = [];
  if (
    learner.xpAction &&
    current.xpAwards[learner.xpAction] !== proposed.xpAwards[learner.xpAction]
  ) {
    reasons.push("xp-award");
  }
  if (
    learner.quizScore !== undefined &&
    (learner.quizScore >= current.passingThreshold) !==
      (learner.quizScore >= proposed.passingThreshold)
  ) {
    reasons.push("passing-threshold");
  }
  if (canUnlock(current, learner) !== canUnlock(proposed, learner)) {
    reasons.push("unlock-requirement");
  }
  if (
    latestMilestone(current, learner.streakDays) !==
    latestMilestone(proposed, learner.streakDays)
  ) {
    reasons.push("streak-milestone");
  }
  if (
    !learner.courseCompleted &&
    (learner.daysSinceLastActivity >= current.stuckAfterDays) !==
      (learner.daysSinceLastActivity >= proposed.stuckAfterDays)
  ) {
    reasons.push("stuck-period");
  }
  if (
    (learner.daysSinceLastActivity <= current.activityWindowDays) !==
    (learner.daysSinceLastActivity <= proposed.activityWindowDays)
  ) {
    reasons.push("activity-window");
  }
  return reasons;
}

function findVersion(
  history: readonly SettingsVersion[],
  environment: PlatformEnvironment,
  versionId: string,
): SettingsVersion {
  const version = history.find(
    (candidate) =>
      candidate.environment === environment && candidate.versionId === versionId,
  );
  if (!version) throw new Error("Settings version does not exist in this environment.");
  return version;
}

function sameRules(left: LearningRules, right: LearningRules): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createInitialSettingsVersion(input: {
  environment: PlatformEnvironment;
  versionId: string;
  rules: LearningRules;
  actorId: string;
  reason: string;
  activatedAt: string;
}): SettingsVersion {
  return {
    environment: input.environment,
    versionId: requireText(input.versionId, "Version ID"),
    changeKind: "initial",
    rules: validateRules(input.rules),
    actorId: requireText(input.actorId, "Actor ID"),
    reason: requireText(input.reason, "Reason"),
    activatedAt: requireIsoDateTime(input.activatedAt, "Activation time"),
  };
}

export function previewSettingsImpact(input: {
  current: SettingsVersion;
  proposedRules: LearningRules;
  learners: readonly LearnerRuleSnapshot[];
}): SettingsImpactPreview {
  const proposedRules = validateRules(input.proposedRules);
  const learners = input.learners.filter(
    (learner) => learner.environment === input.current.environment,
  );
  const counts = Object.fromEntries(
    IMPACT_REASONS.map((reason) => [reason, 0]),
  ) as Record<SettingsImpactReason, number>;
  const affectedLearnerIds: string[] = [];

  for (const learner of learners) {
    if (
      learner.streakDays < 0 ||
      learner.daysSinceLastActivity < 0 ||
      (learner.quizScore !== undefined &&
        (learner.quizScore < 0 || learner.quizScore > 100))
    ) {
      throw new Error("Learner rule snapshots contain invalid values.");
    }
    const reasons = impactReasons(input.current.rules, proposedRules, learner);
    if (reasons.length > 0) affectedLearnerIds.push(learner.learnerId);
    for (const reason of reasons) counts[reason] += 1;
  }

  return {
    environment: input.current.environment,
    baseVersionId: input.current.versionId,
    proposedRules,
    evaluatedLearnerCount: learners.length,
    affectedLearnerCount: affectedLearnerIds.length,
    affectedLearnerIds,
    affectedByRule: counts,
  };
}

function assertPreview(
  preview: SettingsImpactPreview,
  current: SettingsVersion,
  proposedRules: LearningRules,
): void {
  if (
    preview.environment !== current.environment ||
    preview.baseVersionId !== current.versionId ||
    !sameRules(preview.proposedRules, proposedRules)
  ) {
    throw new Error("Settings impact preview is stale or belongs to another environment.");
  }
}

export function activateSettingsChange(input: {
  history: readonly SettingsVersion[];
  environment: PlatformEnvironment;
  liveVersionId: string;
  newVersionId: string;
  proposedRules: LearningRules;
  preview: SettingsImpactPreview;
  actorId: string;
  reason: string;
  activatedAt: string;
}): SettingsVersion {
  const current = findVersion(input.history, input.environment, input.liveVersionId);
  const proposedRules = validateRules(input.proposedRules);
  assertPreview(input.preview, current, proposedRules);
  if (
    input.history.some(
      (version) =>
        version.environment === input.environment &&
        version.versionId === input.newVersionId,
    )
  ) {
    throw new Error("Settings version ID already exists in this environment.");
  }
  return {
    environment: input.environment,
    versionId: requireText(input.newVersionId, "Version ID"),
    previousVersionId: current.versionId,
    changeKind: "update",
    beforeRules: cloneRules(current.rules),
    rules: proposedRules,
    actorId: requireText(input.actorId, "Actor ID"),
    reason: requireText(input.reason, "Reason"),
    activatedAt: requireIsoDateTime(input.activatedAt, "Activation time"),
  };
}

export function previewSettingsRollback(input: {
  history: readonly SettingsVersion[];
  environment: PlatformEnvironment;
  liveVersionId: string;
  restoreVersionId: string;
  learners: readonly LearnerRuleSnapshot[];
}): SettingsImpactPreview {
  const current = findVersion(input.history, input.environment, input.liveVersionId);
  const target = findVersion(input.history, input.environment, input.restoreVersionId);
  return previewSettingsImpact({
    current,
    proposedRules: target.rules,
    learners: input.learners,
  });
}

export function rollbackSettingsVersion(input: {
  history: readonly SettingsVersion[];
  environment: PlatformEnvironment;
  liveVersionId: string;
  restoreVersionId: string;
  newVersionId: string;
  preview: SettingsImpactPreview;
  actorId: string;
  reason: string;
  activatedAt: string;
}): SettingsVersion {
  const current = findVersion(input.history, input.environment, input.liveVersionId);
  const target = findVersion(input.history, input.environment, input.restoreVersionId);
  assertPreview(input.preview, current, target.rules);
  if (
    input.history.some(
      (version) =>
        version.environment === input.environment &&
        version.versionId === input.newVersionId,
    )
  ) {
    throw new Error("Settings version ID already exists in this environment.");
  }
  return {
    environment: input.environment,
    versionId: requireText(input.newVersionId, "Version ID"),
    previousVersionId: current.versionId,
    restoredFromVersionId: target.versionId,
    changeKind: "rollback",
    beforeRules: cloneRules(current.rules),
    rules: cloneRules(target.rules),
    actorId: requireText(input.actorId, "Actor ID"),
    reason: requireText(input.reason, "Reason"),
    activatedAt: requireIsoDateTime(input.activatedAt, "Activation time"),
  };
}

export type TrafficSourceStatus = "scheduled" | "active" | "disabled" | "ended";

export type TrafficSource = Readonly<{
  environment: PlatformEnvironment;
  code: string;
  name: string;
  owner: string;
  status: TrafficSourceStatus;
  startDate: string;
  endDate?: string;
  referralUrl: string;
}>;

export type ReportableSource = Readonly<{
  environment: PlatformEnvironment;
  code: string;
  name: string;
  known: boolean;
  status: TrafficSourceStatus | "unknown";
}>;

function requireDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  return value;
}

function requireReferralUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Referral URL must be valid.");
  }
  if (url.protocol !== "https:") throw new Error("Referral URL must use HTTPS.");
  return url.toString();
}

export function createTrafficSource(input: TrafficSource): TrafficSource {
  const code = requireText(input.code, "Source code");
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(code)) {
    throw new Error("Source code may only contain letters, numbers, underscores, and hyphens.");
  }
  const startDate = requireDate(input.startDate, "Start date");
  const endDate = input.endDate
    ? requireDate(input.endDate, "End date")
    : undefined;
  if (endDate && endDate < startDate) {
    throw new Error("Source end date cannot be before its start date.");
  }
  return {
    environment: input.environment,
    code,
    name: requireText(input.name, "Source name"),
    owner: requireText(input.owner, "Source owner"),
    status: input.status,
    startDate,
    endDate,
    referralUrl: requireReferralUrl(input.referralUrl),
  };
}

export function registerTrafficSource(
  registry: readonly TrafficSource[],
  source: TrafficSource,
): TrafficSource[] {
  const validated = createTrafficSource(source);
  if (
    registry.some(
      (item) =>
        item.environment === validated.environment && item.code === validated.code,
    )
  ) {
    throw new Error("Source code already exists in this environment.");
  }
  return [...registry, validated];
}

export function setTrafficSourceStatus(input: {
  registry: readonly TrafficSource[];
  environment: PlatformEnvironment;
  code: string;
  status: TrafficSourceStatus;
}): TrafficSource[] {
  let found = false;
  const result = input.registry.map((source) => {
    if (source.environment !== input.environment || source.code !== input.code) {
      return source;
    }
    found = true;
    return { ...source, status: input.status };
  });
  if (!found) throw new Error("Traffic source does not exist in this environment.");
  return result;
}

export function getReferralUrl(
  source: TrafficSource,
  environment: PlatformEnvironment,
  onDate: string,
): string | undefined {
  if (source.environment !== environment) {
    throw new Error("Traffic source belongs to another environment.");
  }
  const date = requireDate(onDate, "Referral date");
  if (
    source.status !== "active" ||
    date < source.startDate ||
    (source.endDate !== undefined && date > source.endDate)
  ) {
    return undefined;
  }
  return source.referralUrl;
}

export function resolveSourceForReporting(
  registry: readonly TrafficSource[],
  environment: PlatformEnvironment,
  code: string,
): ReportableSource {
  const source = registry.find(
    (item) => item.environment === environment && item.code === code,
  );
  return source
    ? {
        environment,
        code: source.code,
        name: source.name,
        known: true,
        status: source.status,
      }
    : {
        environment,
        code,
        name: `Unknown source (${code})`,
        known: false,
        status: "unknown",
      };
}

export const FEATURE_FLAGS = [
  "learner-course-access",
  "learner-check-in",
  "learner-quiz",
  "admin-publishing",
  "admin-exports",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
export type FeatureAudience = "learner" | "admin";

export type EnvironmentControls = Readonly<{
  environment: PlatformEnvironment;
  flags: Readonly<Record<FeatureFlag, boolean>>;
  learnerMaintenance: Readonly<{
    enabled: boolean;
    message: string;
  }>;
  updatedBy: string;
  updatedAt: string;
}>;

export type EnvironmentControlSet = Readonly<
  Record<PlatformEnvironment, EnvironmentControls>
>;

export type CapabilityAccess = Readonly<{
  allowed: boolean;
  reason?: "feature-disabled" | "maintenance";
  message?: string;
}>;

const FEATURE_AUDIENCE: Readonly<Record<FeatureFlag, FeatureAudience>> = {
  "learner-course-access": "learner",
  "learner-check-in": "learner",
  "learner-quiz": "learner",
  "admin-publishing": "admin",
  "admin-exports": "admin",
};

function enabledFlags(): Record<FeatureFlag, boolean> {
  return Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag, true])) as Record<
    FeatureFlag,
    boolean
  >;
}

export function createEnvironmentControlSet(input: {
  actorId: string;
  createdAt: string;
}): EnvironmentControlSet {
  const actorId = requireText(input.actorId, "Actor ID");
  const createdAt = requireIsoDateTime(input.createdAt, "Creation time");
  return Object.fromEntries(
    PLATFORM_ENVIRONMENTS.map((environment) => [
      environment,
      {
        environment,
        flags: enabledFlags(),
        learnerMaintenance: { enabled: false, message: "" },
        updatedBy: actorId,
        updatedAt: createdAt,
      },
    ]),
  ) as unknown as EnvironmentControlSet;
}

export function setEnvironmentFeatureFlag(input: {
  controls: EnvironmentControlSet;
  environment: PlatformEnvironment;
  flag: FeatureFlag;
  enabled: boolean;
  actorId: string;
  updatedAt: string;
}): EnvironmentControlSet {
  const current = input.controls[input.environment];
  return {
    ...input.controls,
    [input.environment]: {
      ...current,
      flags: { ...current.flags, [input.flag]: input.enabled },
      updatedBy: requireText(input.actorId, "Actor ID"),
      updatedAt: requireIsoDateTime(input.updatedAt, "Update time"),
    },
  };
}

export function setLearnerMaintenanceMode(input: {
  controls: EnvironmentControlSet;
  environment: PlatformEnvironment;
  enabled: boolean;
  message: string;
  actorId: string;
  updatedAt: string;
}): EnvironmentControlSet {
  const message = input.message.trim();
  if (input.enabled && !message) {
    throw new Error("Learner maintenance mode requires a message.");
  }
  const current = input.controls[input.environment];
  return {
    ...input.controls,
    [input.environment]: {
      ...current,
      learnerMaintenance: { enabled: input.enabled, message },
      updatedBy: requireText(input.actorId, "Actor ID"),
      updatedAt: requireIsoDateTime(input.updatedAt, "Update time"),
    },
  };
}

export function evaluateCapabilityAccess(input: {
  controls: EnvironmentControlSet;
  environment: PlatformEnvironment;
  audience: FeatureAudience;
  flag: FeatureFlag;
}): CapabilityAccess {
  if (FEATURE_AUDIENCE[input.flag] !== input.audience) {
    throw new Error("Feature does not belong to the requested audience.");
  }
  const controls = input.controls[input.environment];
  if (input.audience === "learner" && controls.learnerMaintenance.enabled) {
    return {
      allowed: false,
      reason: "maintenance",
      message: controls.learnerMaintenance.message,
    };
  }
  if (!controls.flags[input.flag]) {
    return {
      allowed: false,
      reason: "feature-disabled",
      message:
        input.audience === "learner"
          ? "This feature is temporarily unavailable."
          : undefined,
    };
  }
  return { allowed: true };
}
