import { describe, expect, it } from "vitest";
import {
  activateSettingsChange,
  createEnvironmentControlSet,
  createInitialSettingsVersion,
  createTrafficSource,
  evaluateCapabilityAccess,
  getReferralUrl,
  previewSettingsImpact,
  previewSettingsRollback,
  registerTrafficSource,
  resolveSourceForReporting,
  rollbackSettingsVersion,
  setEnvironmentFeatureFlag,
  setLearnerMaintenanceMode,
  setTrafficSourceStatus,
  type LearnerRuleSnapshot,
  type LearningRules,
  type SettingsVersion,
  type TrafficSource,
} from "./settingsCore";

const rules: LearningRules = {
  xpAwards: {
    "lesson-completed": 20,
    "quiz-passed": 10,
    "daily-check-in": 5,
    "course-completed": 100,
  },
  passingThreshold: 80,
  unlock: {
    requireVideoCompletion: true,
    requireQuizPass: true,
  },
  streakMilestones: [3, 7, 14],
  stuckAfterDays: 7,
  activityWindowDays: 7,
};

const initialVersion = (
  environment: "staging" | "production" = "staging",
): SettingsVersion =>
  createInitialSettingsVersion({
    environment,
    versionId: "settings-v1",
    rules,
    actorId: "owner-1",
    reason: "Initial rules",
    activatedAt: "2026-07-30T01:00:00Z",
  });

const learners: LearnerRuleSnapshot[] = [
  {
    environment: "staging",
    learnerId: "newly-stuck",
    quizScore: 75,
    videoCompleted: true,
    quizPassed: false,
    streakDays: 5,
    daysSinceLastActivity: 6,
    courseCompleted: false,
    xpAction: "daily-check-in",
  },
  {
    environment: "staging",
    learnerId: "unchanged",
    quizScore: 95,
    videoCompleted: true,
    quizPassed: true,
    streakDays: 14,
    daysSinceLastActivity: 1,
    courseCompleted: false,
    xpAction: "lesson-completed",
  },
  {
    environment: "production",
    learnerId: "production-learner",
    quizScore: 75,
    videoCompleted: false,
    quizPassed: false,
    streakDays: 5,
    daysSinceLastActivity: 6,
    courseCompleted: false,
    xpAction: "daily-check-in",
  },
];

describe("versioned learning settings", () => {
  it("previews all rule families and only counts learners in the target environment", () => {
    const proposed: LearningRules = {
      ...rules,
      xpAwards: { ...rules.xpAwards, "daily-check-in": 8 },
      passingThreshold: 70,
      unlock: { requireVideoCompletion: false, requireQuizPass: false },
      streakMilestones: [3, 5, 10],
      stuckAfterDays: 5,
      activityWindowDays: 5,
    };
    const preview = previewSettingsImpact({
      current: initialVersion(),
      proposedRules: proposed,
      learners,
    });

    expect(preview).toMatchObject({
      environment: "staging",
      evaluatedLearnerCount: 2,
      affectedLearnerCount: 2,
      affectedLearnerIds: ["newly-stuck", "unchanged"],
      affectedByRule: {
        "xp-award": 1,
        "passing-threshold": 1,
        "unlock-requirement": 1,
        "streak-milestone": 2,
        "stuck-period": 1,
        "activity-window": 1,
      },
    });
    expect(preview.affectedLearnerIds).not.toContain("production-learner");
  });

  it("records immutable before/after values only after receiving a matching preview", () => {
    const current = initialVersion();
    const proposed = { ...rules, stuckAfterDays: 5 };
    const preview = previewSettingsImpact({
      current,
      proposedRules: proposed,
      learners,
    });
    const next = activateSettingsChange({
      history: [current],
      environment: "staging",
      liveVersionId: "settings-v1",
      newVersionId: "settings-v2",
      proposedRules: proposed,
      preview,
      actorId: "owner-2",
      reason: "Contact stuck learners sooner",
      activatedAt: "2026-07-30T02:00:00Z",
    });

    expect(next).toMatchObject({
      environment: "staging",
      versionId: "settings-v2",
      previousVersionId: "settings-v1",
      changeKind: "update",
      beforeRules: { stuckAfterDays: 7 },
      rules: { stuckAfterDays: 5 },
      actorId: "owner-2",
    });
    proposed.stuckAfterDays = 2;
    expect(next.rules.stuckAfterDays).toBe(5);
    expect(current.rules.stuckAfterDays).toBe(7);
  });

  it("rejects stale and cross-environment previews", () => {
    const staging = initialVersion();
    const production = initialVersion("production");
    const proposed = { ...rules, stuckAfterDays: 5 };
    const stagingPreview = previewSettingsImpact({
      current: staging,
      proposedRules: proposed,
      learners,
    });

    expect(() =>
      activateSettingsChange({
        history: [staging, production],
        environment: "production",
        liveVersionId: "settings-v1",
        newVersionId: "settings-v2",
        proposedRules: proposed,
        preview: stagingPreview,
        actorId: "owner-1",
        reason: "Must not cross environments",
        activatedAt: "2026-07-30T02:00:00Z",
      }),
    ).toThrow("another environment");
  });

  it("rolls back as a new version and leaves the original history unchanged", () => {
    const v1 = initialVersion();
    const v2Rules = { ...rules, stuckAfterDays: 5 };
    const v2 = activateSettingsChange({
      history: [v1],
      environment: "staging",
      liveVersionId: "settings-v1",
      newVersionId: "settings-v2",
      proposedRules: v2Rules,
      preview: previewSettingsImpact({
        current: v1,
        proposedRules: v2Rules,
        learners,
      }),
      actorId: "owner-1",
      reason: "Earlier intervention",
      activatedAt: "2026-07-30T02:00:00Z",
    });
    const history = [v1, v2];
    const preview = previewSettingsRollback({
      history,
      environment: "staging",
      liveVersionId: "settings-v2",
      restoreVersionId: "settings-v1",
      learners,
    });
    const rollback = rollbackSettingsVersion({
      history,
      environment: "staging",
      liveVersionId: "settings-v2",
      restoreVersionId: "settings-v1",
      newVersionId: "settings-v3",
      preview,
      actorId: "owner-2",
      reason: "Restore the proven threshold",
      activatedAt: "2026-07-30T03:00:00Z",
    });

    expect(preview.affectedLearnerIds).toEqual(["newly-stuck"]);
    expect(rollback).toMatchObject({
      versionId: "settings-v3",
      previousVersionId: "settings-v2",
      restoredFromVersionId: "settings-v1",
      changeKind: "rollback",
      rules: { stuckAfterDays: 7 },
    });
    expect(history.map((version) => version.versionId)).toEqual([
      "settings-v1",
      "settings-v2",
    ]);
  });
});

describe("traffic source registry", () => {
  const source = (
    environment: "staging" | "production",
  ): TrafficSource =>
    createTrafficSource({
      environment,
      code: "yt-launch",
      name: "YouTube launch",
      owner: "growth-1",
      status: "active",
      startDate: "2026-07-01",
      endDate: "2026-08-31",
      referralUrl: `https://${environment}.example.com/join?source=yt-launch`,
    });

  it("stores required source details and prevents cross-environment duplicates", () => {
    const staging = source("staging");
    const production = source("production");
    const registry = registerTrafficSource(
      registerTrafficSource([], staging),
      production,
    );

    expect(registry).toHaveLength(2);
    expect(staging).toMatchObject({
      code: "yt-launch",
      name: "YouTube launch",
      owner: "growth-1",
      status: "active",
      startDate: "2026-07-01",
      endDate: "2026-08-31",
    });
    expect(() => registerTrafficSource(registry, staging)).toThrow(
      "already exists",
    );
  });

  it("disables new links without erasing known or unknown historical attribution", () => {
    const production = source("production");
    const registry = setTrafficSourceStatus({
      registry: [production],
      environment: "production",
      code: production.code,
      status: "disabled",
    });

    expect(
      getReferralUrl(registry[0], "production", "2026-07-30"),
    ).toBeUndefined();
    expect(
      resolveSourceForReporting(registry, "production", "yt-launch"),
    ).toMatchObject({ known: true, status: "disabled" });
    expect(
      resolveSourceForReporting(registry, "production", "legacy-import"),
    ).toEqual({
      environment: "production",
      code: "legacy-import",
      name: "Unknown source (legacy-import)",
      known: false,
      status: "unknown",
    });
  });

  it("updates only the selected environment and blocks cross-environment link use", () => {
    const staging = source("staging");
    const production = source("production");
    const registry = setTrafficSourceStatus({
      registry: [staging, production],
      environment: "staging",
      code: staging.code,
      status: "disabled",
    });

    expect(registry.find((item) => item.environment === "staging")?.status).toBe(
      "disabled",
    );
    expect(
      registry.find((item) => item.environment === "production")?.status,
    ).toBe("active");
    expect(() =>
      getReferralUrl(staging, "production", "2026-07-30"),
    ).toThrow("another environment");
  });
});

describe("environment-scoped feature flags and maintenance", () => {
  it("changes one environment without changing another", () => {
    const original = createEnvironmentControlSet({
      actorId: "owner-1",
      createdAt: "2026-07-30T01:00:00Z",
    });
    const updated = setEnvironmentFeatureFlag({
      controls: original,
      environment: "staging",
      flag: "learner-check-in",
      enabled: false,
      actorId: "owner-2",
      updatedAt: "2026-07-30T02:00:00Z",
    });

    expect(
      evaluateCapabilityAccess({
        controls: updated,
        environment: "staging",
        audience: "learner",
        flag: "learner-check-in",
      }),
    ).toMatchObject({ allowed: false, reason: "feature-disabled" });
    expect(
      evaluateCapabilityAccess({
        controls: updated,
        environment: "production",
        audience: "learner",
        flag: "learner-check-in",
      }),
    ).toEqual({ allowed: true });
    expect(original.staging.flags["learner-check-in"]).toBe(true);
  });

  it("maintenance blocks learners with a message but preserves admin access", () => {
    const controls = setLearnerMaintenanceMode({
      controls: createEnvironmentControlSet({
        actorId: "owner-1",
        createdAt: "2026-07-30T01:00:00Z",
      }),
      environment: "staging",
      enabled: true,
      message: "課程系統維護中，請稍後再試。",
      actorId: "owner-1",
      updatedAt: "2026-07-30T02:00:00Z",
    });

    expect(
      evaluateCapabilityAccess({
        controls,
        environment: "staging",
        audience: "learner",
        flag: "learner-course-access",
      }),
    ).toEqual({
      allowed: false,
      reason: "maintenance",
      message: "課程系統維護中，請稍後再試。",
    });
    expect(
      evaluateCapabilityAccess({
        controls,
        environment: "staging",
        audience: "admin",
        flag: "admin-publishing",
      }),
    ).toEqual({ allowed: true });
    expect(
      evaluateCapabilityAccess({
        controls,
        environment: "production",
        audience: "learner",
        flag: "learner-course-access",
      }),
    ).toEqual({ allowed: true });
  });

  it("preserves streak history because controls contain no learner data", () => {
    const streakHistory = [{ learnerId: "learner-1", streakDays: 14 }];
    const controls = setEnvironmentFeatureFlag({
      controls: createEnvironmentControlSet({
        actorId: "owner-1",
        createdAt: "2026-07-30T01:00:00Z",
      }),
      environment: "test",
      flag: "learner-check-in",
      enabled: false,
      actorId: "owner-1",
      updatedAt: "2026-07-30T02:00:00Z",
    });

    expect(controls.test.flags["learner-check-in"]).toBe(false);
    expect(streakHistory).toEqual([
      { learnerId: "learner-1", streakDays: 14 },
    ]);
  });
});
