import { describe, expect, it } from "vitest";

import {
  assertGateEnabled,
  changeFeatureGate,
  createDisabledFeatureGates,
  cutoverGateIds,
  rollbackFeatureGate,
} from "./featureGates";

const T0 = "2026-07-30T01:00:00.000Z";
const T1 = "2026-07-30T02:00:00.000Z";

describe("reversible cutover feature gates", () => {
  it("starts all four production write paths disabled", () => {
    const state = createDisabledFeatureGates("production");

    expect(Object.values(state.gates)).toEqual([false, false, false, false]);
    expect(() => assertGateEnabled(state, "uid-workflow")).toThrow("disabled");
  });

  it.each(cutoverGateIds)(
    "enables %s without changing the other write paths",
    (gateId) => {
    const state = changeFeatureGate({
      state: createDisabledFeatureGates("staging"),
      gateId,
      enabled: true,
      actorId: "synthetic-owner",
      reason: `合成 ${gateId} 驗收通過`,
      occurredAt: T0,
      expectedRevision: 0,
      changeId: `synthetic-change-${gateId}-1`,
    });

      for (const candidate of cutoverGateIds) {
        expect(state.gates[candidate]).toBe(candidate === gateId);
      }
      expect(() => assertGateEnabled(state, gateId)).not.toThrow();
    },
  );

  it("rolls a gate back to its exact prior state with an audit link", () => {
    const enabled = changeFeatureGate({
      state: createDisabledFeatureGates("staging"),
      gateId: "curriculum-publishing",
      enabled: true,
      actorId: "synthetic-owner",
      reason: "發布驗收通過",
      occurredAt: T0,
      expectedRevision: 0,
      changeId: "synthetic-change-curriculum-1",
    });
    const rolledBack = rollbackFeatureGate({
      state: enabled,
      changeId: "synthetic-change-curriculum-1",
      actorId: "synthetic-owner",
      reason: "演練回滾",
      occurredAt: T1,
      expectedRevision: 1,
      rollbackChangeId: "synthetic-rollback-curriculum-1",
    });

    expect(rolledBack.gates["curriculum-publishing"]).toBe(false);
    expect(rolledBack.history.at(-1)).toMatchObject({
      rollbackOf: "synthetic-change-curriculum-1",
      from: true,
      to: false,
    });
  });

  it("blocks a stale operator from overwriting a newer gate revision", () => {
    const current = changeFeatureGate({
      state: createDisabledFeatureGates("staging"),
      gateId: "learner-notes-tags",
      enabled: true,
      actorId: "synthetic-owner",
      reason: "備註驗收通過",
      occurredAt: T0,
      expectedRevision: 0,
      changeId: "synthetic-change-notes-1",
    });

    expect(() =>
      changeFeatureGate({
        state: current,
        gateId: "settings-management",
        enabled: true,
        actorId: "synthetic-owner",
        reason: "使用過期頁面操作",
        occurredAt: T1,
        expectedRevision: 0,
        changeId: "synthetic-change-settings-1",
      }),
    ).toThrow("revision conflict");
  });
});
