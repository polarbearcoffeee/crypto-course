import { describe, expect, it } from "vitest";

import {
  buildDataQualityCenter,
  buildOperationsHealthPage,
  dataQualityIssueTypes,
  evaluateOperationsAlerts,
  operationsAlertTypes,
  operationsHealthComponents,
  readOperationsAlerts,
  setEnvironmentFeatureFlag,
  updateEnvironmentSetting,
  upsertOperationsAlertRule,
  type OperationsAlert,
  type OperationsAlertRule,
  type OperationsDataQualityIssue,
  type OperationsHealthCheck,
  type OperationsSignals,
} from "./operationsHealth";

const now = "2026-07-30T12:00:00.000Z";

const baseSignals: OperationsSignals = {
  environment: "staging",
  failedSyncCount: 0,
  maxMetricAgeMinutes: 0,
  mediaFailureCount: 0,
  scheduledPublishFailureCount: 0,
  abnormalXpCount: 0,
  reconciliationMismatchCount: 0,
  pendingUidCount: 0,
  oldestPendingUidAgeMinutes: 0,
};

function rule(
  type: OperationsAlertRule["type"],
  overrides: Partial<OperationsAlertRule> = {},
): OperationsAlertRule {
  return {
    ruleId: `${type}-rule`,
    environment: "staging",
    type,
    enabled: true,
    threshold: 1,
    ...(type === "pending-uid-growth" ? { ageThresholdMinutes: 60 } : {}),
    alertWindowMinutes: 60,
    severity: "warning",
    ownerRole: "owner",
    link: "/settings/health",
    ...overrides,
  };
}

describe("operations alert rules", () => {
  it("covers sync, stale, media, schedule, XP, reconciliation and UID alerts", () => {
    const signals: OperationsSignals = {
      ...baseSignals,
      failedSyncCount: 2,
      maxMetricAgeMinutes: 31,
      mediaFailureCount: 3,
      scheduledPublishFailureCount: 1,
      abnormalXpCount: 4,
      reconciliationMismatchCount: 2,
      pendingUidCount: 12,
      oldestPendingUidAgeMinutes: 90,
    };
    const rules = operationsAlertTypes.map((type) =>
      rule(type, {
        threshold: type === "stale-metrics" ? 30 : 1,
        ...(type === "pending-uid-growth"
          ? { threshold: 10, ageThresholdMinutes: 60 }
          : {}),
      }),
    );

    const alerts = evaluateOperationsAlerts({
      environment: "staging",
      now,
      rules,
      signals: [signals],
    });

    expect(alerts.map((alert) => alert.type)).toEqual(operationsAlertTypes);
    expect(
      alerts.find((alert) => alert.type === "pending-uid-growth")?.trigger,
    ).toMatchObject({
      value: 12,
      threshold: 10,
      oldestAgeMinutes: 90,
      ageThresholdMinutes: 60,
    });
  });

  it("triggers pending UID alerts when either count or oldest age reaches its threshold", () => {
    const uidRule = rule("pending-uid-growth", {
      threshold: 50,
      ageThresholdMinutes: 60,
    });

    expect(
      evaluateOperationsAlerts({
        environment: "staging",
        now,
        rules: [uidRule],
        signals: [
          {
            ...baseSignals,
            pendingUidCount: 1,
            oldestPendingUidAgeMinutes: 60,
          },
        ],
      }),
    ).toHaveLength(1);
  });

  it("deduplicates repeated alerts inside the configured alert window", () => {
    const existing: OperationsAlert = {
      alertId: "existing",
      ruleId: "failed-sync-rule",
      environment: "staging",
      type: "failed-sync",
      severity: "warning",
      state: "open",
      count: 2,
      firstSeenAt: "2026-07-30T11:30:00.000Z",
      lastSeenAt: "2026-07-30T11:30:00.000Z",
      ownerRole: "owner",
      link: "/settings/health",
      trigger: { value: 2, threshold: 1 },
    };

    expect(
      evaluateOperationsAlerts({
        environment: "staging",
        now,
        rules: [rule("failed-sync")],
        signals: [{ ...baseSignals, failedSyncCount: 2 }],
        existingAlerts: [existing],
      }),
    ).toEqual([]);

    expect(
      evaluateOperationsAlerts({
        environment: "staging",
        now: "2026-07-30T12:31:00.000Z",
        rules: [rule("failed-sync")],
        signals: [{ ...baseSignals, failedSyncCount: 2 }],
        existingAlerts: [existing],
      }),
    ).toHaveLength(1);
  });

  it("does not read signals, rules, histories or alerts from another environment", () => {
    const productionAlert: OperationsAlert = {
      alertId: "production-alert",
      ruleId: "production-rule",
      environment: "production",
      type: "failed-sync",
      severity: "critical",
      state: "open",
      count: 99,
      firstSeenAt: now,
      lastSeenAt: now,
      ownerRole: "owner",
      link: "/settings/health",
      trigger: { value: 99, threshold: 1 },
    };

    expect(
      evaluateOperationsAlerts({
        environment: "staging",
        now,
        rules: [
          rule("failed-sync", {
            ruleId: "production-rule",
            environment: "production",
          }),
        ],
        signals: [{ ...baseSignals, environment: "production", failedSyncCount: 99 }],
        existingAlerts: [productionAlert],
      }),
    ).toEqual([]);
    expect(
      readOperationsAlerts({
        role: "owner",
        environment: "staging",
        alerts: [productionAlert],
      }),
    ).toEqual([]);
  });

  it("requires settings permission and same-environment scope when saving rules", () => {
    expect(() =>
      upsertOperationsAlertRule({
        actorRole: "lead-teacher",
        actorEnvironment: "staging",
        rule: rule("failed-sync"),
        rules: [],
      }),
    ).toThrow(/not authorized/i);
    expect(() =>
      upsertOperationsAlertRule({
        actorRole: "owner",
        actorEnvironment: "staging",
        rule: rule("failed-sync", { environment: "production" }),
        rules: [],
      }),
    ).toThrow(/cross-environment/i);
  });
});

describe("operations health page", () => {
  it("shows every required health area and marks stale aggregation as degraded", () => {
    const checks: OperationsHealthCheck[] = operationsHealthComponents.map(
      (component) => ({
        environment: "staging",
        component,
        status: "healthy",
        summary: `${component} is healthy.`,
        checkedAt:
          component === "aggregation"
            ? "2026-07-30T10:00:00.000Z"
            : "2026-07-30T11:59:00.000Z",
        ...(component === "aggregation"
          ? {
              staleAfterMinutes: 30,
              affectedMetricIds: ["registered", "completion"],
            }
          : {}),
      }),
    );

    const page = buildOperationsHealthPage({
      role: "owner",
      environment: "staging",
      now,
      checks,
      incidents: [],
    });

    expect(page.checks.map((check) => check.component)).toEqual(
      operationsHealthComponents,
    );
    expect(page.overallStatus).toBe("degraded");
    expect(page.staleMetricIds).toEqual(["registered", "completion"]);
    expect(
      page.checks.find((check) => check.component === "aggregation")?.status,
    ).toBe("degraded");
  });

  it("raises overall health for active incidents and excludes other environments", () => {
    const page = buildOperationsHealthPage({
      role: "owner",
      environment: "staging",
      now,
      checks: [],
      incidents: [
        {
          incidentId: "staging-incident",
          environment: "staging",
          severity: "critical",
          status: "active",
          summary: "Authentication unavailable.",
          startedAt: now,
        },
        {
          incidentId: "production-incident",
          environment: "production",
          severity: "critical",
          status: "active",
          summary: "Production incident.",
          startedAt: now,
        },
      ],
    });

    expect(page.overallStatus).toBe("critical");
    expect(page.activeIncidents.map((incident) => incident.incidentId)).toEqual([
      "staging-incident",
    ]);
  });
});

describe("data-quality center", () => {
  const issues: OperationsDataQualityIssue[] = [
    {
      issueId: "duplicate-a",
      environment: "staging",
      type: "duplicate-uid-candidate",
      recordId: "learner-a",
      severity: "high",
      state: "open",
      sample: { normalizedUid: "123456" },
      detectedAt: "2026-07-30T09:00:00.000Z",
    },
    {
      issueId: "duplicate-b",
      environment: "staging",
      type: "duplicate-uid-candidate",
      recordId: "learner-b",
      severity: "high",
      state: "investigating",
      sample: { normalizedUid: "123456" },
      detectedAt: "2026-07-30T10:00:00.000Z",
    },
    {
      issueId: "production-failure",
      environment: "production",
      type: "failed-migration",
      recordId: "migration-1",
      severity: "critical",
      state: "open",
      detectedAt: "2026-07-30T08:00:00.000Z",
    },
  ];

  it("groups every issue type with count, sample, first detection and state", () => {
    const center = buildDataQualityCenter({
      role: "owner",
      environment: "staging",
      now,
      issues,
    });
    const duplicates = center.queues.find(
      (queue) => queue.type === "duplicate-uid-candidate",
    );

    expect(center.queues.map((queue) => queue.type)).toEqual(
      dataQualityIssueTypes,
    );
    expect(center.totalOpenCount).toBe(2);
    expect(duplicates).toMatchObject({
      count: 2,
      firstDetectedAt: "2026-07-30T09:00:00.000Z",
      stateCounts: { open: 1, investigating: 1, resolved: 0, ignored: 0 },
      issueIds: ["duplicate-a", "duplicate-b"],
    });
    expect(center.automaticMergePerformed).toBe(false);
    expect(
      center.queues.find((queue) => queue.type === "failed-migration")?.count,
    ).toBe(0);
  });

  it("does not allow a role without audit permission to view issue samples", () => {
    expect(() =>
      buildDataQualityCenter({
        role: "analyst",
        environment: "staging",
        now,
        issues,
      }),
    ).toThrow(/not authorized/i);
  });
});

describe("environment-scoped configuration", () => {
  it("allows an owner to update settings and flags only in the active environment", () => {
    expect(
      updateEnvironmentSetting({
        actorRole: "owner",
        actorEnvironment: "staging",
        targetEnvironment: "staging",
        key: "stuck-days",
        value: 5,
        actorId: "owner-1",
        updatedAt: now,
      }),
    ).toMatchObject({
      environment: "staging",
      key: "stuck-days",
      value: 5,
    });
    expect(
      setEnvironmentFeatureFlag({
        actorRole: "owner",
        actorEnvironment: "staging",
        targetEnvironment: "staging",
        key: "check-in",
        enabled: false,
        actorId: "owner-1",
        updatedAt: now,
      }),
    ).toMatchObject({
      environment: "staging",
      key: "check-in",
      enabled: false,
    });
  });

  it("rejects cross-environment writes and role bypass attempts", () => {
    expect(() =>
      updateEnvironmentSetting({
        actorRole: "owner",
        actorEnvironment: "staging",
        targetEnvironment: "production",
        key: "stuck-days",
        value: 5,
        actorId: "owner-1",
        updatedAt: now,
      }),
    ).toThrow(/cross-environment/i);
    expect(() =>
      setEnvironmentFeatureFlag({
        actorRole: "lead-teacher",
        actorEnvironment: "staging",
        targetEnvironment: "staging",
        key: "check-in",
        enabled: false,
        actorId: "teacher-1",
        updatedAt: now,
      }),
    ).toThrow(/not authorized/i);
  });
});
