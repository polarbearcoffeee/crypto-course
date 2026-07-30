export const cutoverGateIds = [
  "uid-workflow",
  "learner-notes-tags",
  "curriculum-publishing",
  "settings-management",
] as const;

export type CutoverGateId = (typeof cutoverGateIds)[number];
export type GateEnvironment = "development" | "staging" | "production";

export type GateChange = Readonly<{
  changeId: string;
  gateId: CutoverGateId;
  from: boolean;
  to: boolean;
  actorId: string;
  reason: string;
  occurredAt: string;
  rollbackOf?: string;
}>;

export type FeatureGateState = Readonly<{
  environment: GateEnvironment;
  revision: number;
  gates: Readonly<Record<CutoverGateId, boolean>>;
  history: readonly GateChange[];
}>;

export function createDisabledFeatureGates(
  environment: GateEnvironment,
): FeatureGateState {
  return freezeState({
    environment,
    revision: 0,
    gates: {
      "uid-workflow": false,
      "learner-notes-tags": false,
      "curriculum-publishing": false,
      "settings-management": false,
    },
    history: [],
  });
}

export function changeFeatureGate(input: Readonly<{
  state: FeatureGateState;
  gateId: CutoverGateId;
  enabled: boolean;
  actorId: string;
  reason: string;
  occurredAt: string;
  expectedRevision: number;
  changeId: string;
}>): FeatureGateState {
  assertChangeInput(input);
  const from = input.state.gates[input.gateId];
  if (from === input.enabled) return input.state;

  const change: GateChange = {
    changeId: input.changeId,
    gateId: input.gateId,
    from,
    to: input.enabled,
    actorId: input.actorId.trim(),
    reason: input.reason.trim(),
    occurredAt: input.occurredAt,
  };
  return appendChange(input.state, change);
}

export function rollbackFeatureGate(input: Readonly<{
  state: FeatureGateState;
  changeId: string;
  actorId: string;
  reason: string;
  occurredAt: string;
  expectedRevision: number;
  rollbackChangeId: string;
}>): FeatureGateState {
  assertRevision(input.state, input.expectedRevision);
  const original = input.state.history.find(
    (change) => change.changeId === input.changeId,
  );
  if (!original) throw new Error("Unknown gate change.");
  if (input.state.gates[original.gateId] !== original.to) {
    throw new Error("Gate has changed since this revision and cannot be rolled back directly.");
  }
  requireText(input.rollbackChangeId, "Rollback change ID");
  requireText(input.actorId, "Actor ID");
  requireText(input.reason, "Rollback reason");
  requireTimestamp(input.occurredAt);
  if (
    input.state.history.some(
      (change) => change.changeId === input.rollbackChangeId,
    )
  ) {
    throw new Error("Rollback change ID already exists.");
  }

  return appendChange(input.state, {
    changeId: input.rollbackChangeId,
    gateId: original.gateId,
    from: original.to,
    to: original.from,
    actorId: input.actorId.trim(),
    reason: input.reason.trim(),
    occurredAt: input.occurredAt,
    rollbackOf: original.changeId,
  });
}

export function assertGateEnabled(
  state: FeatureGateState,
  gateId: CutoverGateId,
): void {
  if (!state.gates[gateId]) {
    throw new Error(`${gateId} is disabled in ${state.environment}.`);
  }
}

function assertChangeInput(input: {
  state: FeatureGateState;
  expectedRevision: number;
  changeId: string;
  actorId: string;
  reason: string;
  occurredAt: string;
}) {
  assertRevision(input.state, input.expectedRevision);
  requireText(input.changeId, "Change ID");
  requireText(input.actorId, "Actor ID");
  requireText(input.reason, "Change reason");
  requireTimestamp(input.occurredAt);
  if (input.state.history.some((change) => change.changeId === input.changeId)) {
    throw new Error("Change ID already exists.");
  }
}

function assertRevision(state: FeatureGateState, expectedRevision: number) {
  if (state.revision !== expectedRevision) {
    throw new Error(
      `Feature gate revision conflict: expected ${expectedRevision}, current ${state.revision}.`,
    );
  }
}

function appendChange(
  state: FeatureGateState,
  change: GateChange,
): FeatureGateState {
  return freezeState({
    environment: state.environment,
    revision: state.revision + 1,
    gates: { ...state.gates, [change.gateId]: change.to },
    history: [...state.history, change],
  });
}

function freezeState(state: FeatureGateState): FeatureGateState {
  Object.freeze(state.gates);
  state.history.forEach(Object.freeze);
  Object.freeze(state.history);
  return Object.freeze(state);
}

function requireText(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
}

function requireTimestamp(value: string) {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error("A valid timestamp is required.");
  }
}
