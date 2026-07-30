import type { AppEnvironment } from "../config/env";
import { can, type Permission, type Role } from "./permissions";

export type OperationsEnvironment = AppEnvironment;

function assertAuthorized(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Role is not authorized for ${permission}.`);
  }
}

function assertSameEnvironment(
  actorEnvironment: OperationsEnvironment,
  targetEnvironment: OperationsEnvironment,
): void {
  if (actorEnvironment !== targetEnvironment) {
    throw new Error("Cross-environment operations are not allowed.");
  }
}

function requireNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be non-negative.`);
  }
}

function requireTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} must be valid.`);
  return timestamp;
}

export type EnvironmentSetting<T> = Readonly<{
  environment: OperationsEnvironment;
  key: string;
  value: T;
  updatedBy: string;
  updatedAt: string;
}>;

export function updateEnvironmentSetting<T>(input: {
  actorRole: Role;
  actorEnvironment: OperationsEnvironment;
  targetEnvironment: OperationsEnvironment;
  key: string;
  value: T;
  actorId: string;
  updatedAt: string;
}): EnvironmentSetting<T> {
  assertAuthorized(input.actorRole, "settings.manage");
  assertSameEnvironment(input.actorEnvironment, input.targetEnvironment);
  if (!input.key.trim() || !input.actorId.trim()) {
    throw new Error("Setting key and actor are required.");
  }
  requireTimestamp(input.updatedAt, "Setting update time");
  return {
    environment: input.targetEnvironment,
    key: input.key.trim(),
    value: structuredClone(input.value),
    updatedBy: input.actorId,
    updatedAt: input.updatedAt,
  };
}

export type EnvironmentFeatureFlag = Readonly<{
  environment: OperationsEnvironment;
  key: string;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string;
}>;

export function setEnvironmentFeatureFlag(input: {
  actorRole: Role;
  actorEnvironment: OperationsEnvironment;
  targetEnvironment: OperationsEnvironment;
  key: string;
  enabled: boolean;
  actorId: string;
  updatedAt: string;
}): EnvironmentFeatureFlag {
  const setting = updateEnvironmentSetting({
    ...input,
    value: input.enabled,
  });
  return {
    environment: setting.environment,
    key: setting.key,
    enabled: setting.value,
    updatedBy: setting.updatedBy,
    updatedAt: setting.updatedAt,
  };
}

export const operationsAlertTypes = [
  "failed-sync",
  "stale-metrics",
  "media-failure",
  "publish-failure",
  "abnormal-xp",
  "reconciliation-mismatch",
  "pending-uid-growth",
] as const;

export type OperationsAlertType = (typeof operationsAlertTypes)[number];

export type OperationsAlertRule = Readonly<{
  ruleId: string;
  environment: OperationsEnvironment;
  type: OperationsAlertType;
  enabled: boolean;
  threshold: number;
  ageThresholdMinutes?: number;
  alertWindowMinutes: number;
  severity: "info" | "warning" | "critical";
  ownerRole: "owner" | "lead-teacher" | "content-editor";
  link: string;
}>;

export type OperationsSignals = Readonly<{
  environment: OperationsEnvironment;
  failedSyncCount: number;
  maxMetricAgeMinutes: number;
  mediaFailureCount: number;
  scheduledPublishFailureCount: number;
  abnormalXpCount: number;
  reconciliationMismatchCount: number;
  pendingUidCount: number;
  oldestPendingUidAgeMinutes: number;
}>;

export type OperationsAlert = Readonly<{
  alertId: string;
  ruleId: string;
  environment: OperationsEnvironment;
  type: OperationsAlertType;
  severity: "info" | "warning" | "critical";
  state: "open" | "acknowledged" | "resolved";
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  ownerRole: "owner" | "lead-teacher" | "content-editor";
  link: string;
  trigger: Readonly<{
    value: number;
    threshold: number;
    oldestAgeMinutes?: number;
    ageThresholdMinutes?: number;
  }>;
}>;

export function upsertOperationsAlertRule(input: {
  actorRole: Role;
  actorEnvironment: OperationsEnvironment;
  rule: OperationsAlertRule;
  rules: readonly OperationsAlertRule[];
}): readonly OperationsAlertRule[] {
  assertAuthorized(input.actorRole, "settings.manage");
  assertSameEnvironment(input.actorEnvironment, input.rule.environment);
  validateAlertRule(input.rule);
  return [
    ...input.rules.filter(
      (rule) =>
        rule.environment !== input.rule.environment ||
        rule.ruleId !== input.rule.ruleId,
    ),
    structuredClone(input.rule),
  ];
}

export function evaluateOperationsAlerts(input: {
  environment: OperationsEnvironment;
  now: string;
  rules: readonly OperationsAlertRule[];
  signals: readonly OperationsSignals[];
  existingAlerts?: readonly OperationsAlert[];
}): readonly OperationsAlert[] {
  const now = requireTimestamp(input.now, "Alert evaluation time");
  const signal = input.signals.find(
    (candidate) => candidate.environment === input.environment,
  );
  if (!signal) return [];
  validateSignals(signal);

  const existing = (input.existingAlerts ?? []).filter(
    (alert) => alert.environment === input.environment,
  );
  return input.rules
    .filter(
      (rule) =>
        rule.environment === input.environment &&
        rule.enabled &&
        isAlertTriggered(rule, signal),
    )
    .flatMap((rule) => {
      validateAlertRule(rule);
      const windowMilliseconds = rule.alertWindowMinutes * 60_000;
      const alreadyCreated = existing.some(
        (alert) =>
          alert.ruleId === rule.ruleId &&
          now - requireTimestamp(alert.lastSeenAt, "Alert last-seen time") <
            windowMilliseconds,
      );
      if (alreadyCreated) return [];

      const value = signalValue(rule.type, signal);
      return [
        {
          alertId: `${input.environment}:${rule.ruleId}:${now}`,
          ruleId: rule.ruleId,
          environment: input.environment,
          type: rule.type,
          severity: rule.severity,
          state: "open" as const,
          count: Math.max(1, Math.ceil(value)),
          firstSeenAt: input.now,
          lastSeenAt: input.now,
          ownerRole: rule.ownerRole,
          link: rule.link,
          trigger: {
            value,
            threshold: rule.threshold,
            ...(rule.type === "pending-uid-growth"
              ? {
                  oldestAgeMinutes: signal.oldestPendingUidAgeMinutes,
                  ageThresholdMinutes: rule.ageThresholdMinutes,
                }
              : {}),
          },
        },
      ];
    });
}

export function readOperationsAlerts(input: {
  role: Role;
  environment: OperationsEnvironment;
  alerts: readonly OperationsAlert[];
}): readonly OperationsAlert[] {
  assertAuthorized(input.role, "dashboard.view");
  return input.alerts.filter(
    (alert) => alert.environment === input.environment,
  );
}

function validateAlertRule(rule: OperationsAlertRule): void {
  if (!rule.ruleId.trim()) throw new Error("Alert rule ID is required.");
  requireNonNegative(rule.threshold, "Alert threshold");
  if (!Number.isFinite(rule.alertWindowMinutes) || rule.alertWindowMinutes <= 0) {
    throw new Error("Alert window must be positive.");
  }
  if (!rule.link.startsWith("/")) {
    throw new Error("Alert link must be an internal path.");
  }
  if (
    rule.type === "pending-uid-growth" &&
    rule.ageThresholdMinutes === undefined
  ) {
    throw new Error("Pending UID alerts require an age threshold.");
  }
  if (rule.ageThresholdMinutes !== undefined) {
    requireNonNegative(rule.ageThresholdMinutes, "Alert age threshold");
  }
}

function validateSignals(signals: OperationsSignals): void {
  for (const [label, value] of Object.entries(signals)) {
    if (label !== "environment") requireNonNegative(value as number, label);
  }
}

function signalValue(
  type: OperationsAlertType,
  signals: OperationsSignals,
): number {
  const values: Record<OperationsAlertType, number> = {
    "failed-sync": signals.failedSyncCount,
    "stale-metrics": signals.maxMetricAgeMinutes,
    "media-failure": signals.mediaFailureCount,
    "publish-failure": signals.scheduledPublishFailureCount,
    "abnormal-xp": signals.abnormalXpCount,
    "reconciliation-mismatch": signals.reconciliationMismatchCount,
    "pending-uid-growth": signals.pendingUidCount,
  };
  return values[type];
}

function isAlertTriggered(
  rule: OperationsAlertRule,
  signals: OperationsSignals,
): boolean {
  if (signalValue(rule.type, signals) >= rule.threshold) return true;
  return (
    rule.type === "pending-uid-growth" &&
    rule.ageThresholdMinutes !== undefined &&
    signals.oldestPendingUidAgeMinutes >= rule.ageThresholdMinutes
  );
}

export const operationsHealthComponents = [
  "connectivity",
  "authentication",
  "ingestion",
  "aggregation",
  "scheduled-jobs",
  "media",
  "backup",
  "restore-test",
  "deployment",
  "incidents",
] as const;

export type OperationsHealthComponent =
  (typeof operationsHealthComponents)[number];
export type OperationsHealthStatus =
  | "healthy"
  | "degraded"
  | "critical"
  | "unknown";

export type OperationsHealthCheck = Readonly<{
  environment: OperationsEnvironment;
  component: OperationsHealthComponent;
  status: OperationsHealthStatus;
  summary: string;
  checkedAt: string;
  staleAfterMinutes?: number;
  affectedMetricIds?: readonly string[];
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type OperationsIncident = Readonly<{
  incidentId: string;
  environment: OperationsEnvironment;
  severity: "info" | "warning" | "critical";
  status: "active" | "resolved";
  summary: string;
  startedAt: string;
  resolvedAt?: string;
}>;

export type OperationsHealthPage = Readonly<{
  environment: OperationsEnvironment;
  overallStatus: Exclude<OperationsHealthStatus, "unknown">;
  generatedAt: string;
  checks: readonly OperationsHealthCheck[];
  activeIncidents: readonly OperationsIncident[];
  staleMetricIds: readonly string[];
}>;

export function buildOperationsHealthPage(input: {
  role: Role;
  environment: OperationsEnvironment;
  now: string;
  checks: readonly OperationsHealthCheck[];
  incidents: readonly OperationsIncident[];
}): OperationsHealthPage {
  assertAuthorized(input.role, "dashboard.view");
  const now = requireTimestamp(input.now, "Health page generation time");
  const environmentChecks = input.checks.filter(
    (check) => check.environment === input.environment,
  );
  const checks = operationsHealthComponents.map((component) => {
    const check = environmentChecks
      .filter((candidate) => candidate.component === component)
      .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))[0];
    if (!check) {
      return {
        environment: input.environment,
        component,
        status: "unknown" as const,
        summary: "No health result has been reported.",
        checkedAt: input.now,
      };
    }
    const checkedAt = requireTimestamp(check.checkedAt, "Health check time");
    const stale =
      check.staleAfterMinutes !== undefined &&
      now - checkedAt > check.staleAfterMinutes * 60_000;
    return stale && check.status === "healthy"
      ? {
          ...check,
          status: "degraded" as const,
          summary: `${check.summary} Result is stale.`,
        }
      : check;
  });
  const activeIncidents = input.incidents.filter(
    (incident) =>
      incident.environment === input.environment &&
      incident.status === "active",
  );
  const statuses = [
    ...checks.map((check) => check.status),
    ...activeIncidents.map((incident) =>
      incident.severity === "critical"
        ? ("critical" as const)
        : incident.severity === "warning"
          ? ("degraded" as const)
          : ("healthy" as const),
    ),
  ];
  const overallStatus = statuses.includes("critical")
    ? "critical"
    : statuses.includes("degraded") || statuses.includes("unknown")
      ? "degraded"
      : "healthy";
  return {
    environment: input.environment,
    overallStatus,
    generatedAt: input.now,
    checks,
    activeIncidents,
    staleMetricIds: [
      ...new Set(
        checks
          .filter(
            (check) =>
              check.component === "aggregation" &&
              check.status !== "healthy",
          )
          .flatMap((check) => check.affectedMetricIds ?? []),
      ),
    ],
  };
}

export const dataQualityIssueTypes = [
  "malformed-learner",
  "missing-source",
  "unknown-lesson",
  "duplicate-uid-candidate",
  "summary-ledger-mismatch",
  "failed-migration",
] as const;

export type OperationsDataQualityIssueType =
  (typeof dataQualityIssueTypes)[number];
export type OperationsDataQualityState =
  | "open"
  | "investigating"
  | "resolved"
  | "ignored";

export type OperationsDataQualityIssue = Readonly<{
  issueId: string;
  environment: OperationsEnvironment;
  type: OperationsDataQualityIssueType;
  recordId: string;
  severity: "low" | "medium" | "high" | "critical";
  state: OperationsDataQualityState;
  sample?: Readonly<Record<string, unknown>>;
  detectedAt: string;
  resolvedAt?: string;
}>;

export type DataQualityQueue = Readonly<{
  type: OperationsDataQualityIssueType;
  count: number;
  firstDetectedAt: string | null;
  stateCounts: Readonly<Record<OperationsDataQualityState, number>>;
  samples: readonly Readonly<Record<string, unknown>>[];
  issueIds: readonly string[];
}>;

export type DataQualityCenter = Readonly<{
  environment: OperationsEnvironment;
  generatedAt: string;
  totalOpenCount: number;
  queues: readonly DataQualityQueue[];
  automaticMergePerformed: false;
}>;

export function buildDataQualityCenter(input: {
  role: Role;
  environment: OperationsEnvironment;
  now: string;
  issues: readonly OperationsDataQualityIssue[];
  sampleLimit?: number;
}): DataQualityCenter {
  assertAuthorized(input.role, "audit.view");
  requireTimestamp(input.now, "Data-quality generation time");
  const issues = input.issues.filter(
    (issue) => issue.environment === input.environment,
  );
  const sampleLimit = input.sampleLimit ?? 3;
  if (!Number.isInteger(sampleLimit) || sampleLimit < 0) {
    throw new Error("Sample limit must be a non-negative integer.");
  }
  const queues = dataQualityIssueTypes.map((type) => {
    const matching = issues.filter((issue) => issue.type === type);
    const stateCounts: Record<OperationsDataQualityState, number> = {
      open: 0,
      investigating: 0,
      resolved: 0,
      ignored: 0,
    };
    matching.forEach((issue) => {
      stateCounts[issue.state] += 1;
    });
    return {
      type,
      count: matching.length,
      firstDetectedAt:
        matching.length === 0
          ? null
          : matching
              .map((issue) => issue.detectedAt)
              .sort((left, right) => left.localeCompare(right))[0],
      stateCounts,
      samples: matching
        .flatMap((issue) => (issue.sample ? [issue.sample] : []))
        .slice(0, sampleLimit),
      issueIds: matching.map((issue) => issue.issueId),
    };
  });
  return {
    environment: input.environment,
    generatedAt: input.now,
    totalOpenCount: issues.filter(
      (issue) => issue.state === "open" || issue.state === "investigating",
    ).length,
    queues,
    automaticMergePerformed: false,
  };
}
