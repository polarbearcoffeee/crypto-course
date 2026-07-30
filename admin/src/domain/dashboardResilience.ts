export const dashboardComponentStatuses = [
  "loading",
  "ready",
  "empty",
  "partial",
  "stale",
  "error",
] as const;

export type DashboardComponentStatus =
  (typeof dashboardComponentStatuses)[number];

type TimestampedData<T> = Readonly<{
  data: T;
  updatedAt: string;
}>;

export type DashboardComponentState<T> =
  | Readonly<{ status: "loading" }>
  | (TimestampedData<T> & Readonly<{ status: "ready" }>)
  | Readonly<{ status: "empty"; updatedAt: string; message: string }>
  | (TimestampedData<T> &
      Readonly<{
        status: "partial";
        message: string;
        completeThrough: string;
      }>)
  | (TimestampedData<T> &
      Readonly<{
        status: "stale";
        message: string;
        lastSuccessfulAt: string;
      }>)
  | Readonly<{
      status: "error";
      message: string;
      retryable: boolean;
    }>;

export type DashboardStatePresentation = Readonly<{
  label: string;
  announcement: string;
  showsData: boolean;
  canRetry: boolean;
}>;

function requireTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO date-time.`);
  }
}

function requireMessage(value: string, field = "message"): void {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
  }
}

export function createDashboardComponentState<T>(
  state: DashboardComponentState<T>,
): DashboardComponentState<T> {
  if (state.status === "loading") {
    return Object.freeze({ status: "loading" });
  }

  if (state.status === "error") {
    requireMessage(state.message);
    return Object.freeze({ ...state });
  }

  requireTimestamp(state.updatedAt, "updatedAt");

  if (state.status === "empty") {
    requireMessage(state.message);
  }
  if (state.status === "partial") {
    requireMessage(state.message);
    requireTimestamp(state.completeThrough, "completeThrough");
  }
  if (state.status === "stale") {
    requireMessage(state.message);
    requireTimestamp(state.lastSuccessfulAt, "lastSuccessfulAt");
  }

  return Object.freeze({ ...state });
}

export function dashboardStatePresentation<T>(
  state: DashboardComponentState<T>,
): DashboardStatePresentation {
  switch (state.status) {
    case "loading":
      return {
        label: "載入中",
        announcement: "正在載入儀表板資料",
        showsData: false,
        canRetry: false,
      };
    case "ready":
      return {
        label: "資料已更新",
        announcement: `資料更新時間 ${state.updatedAt}`,
        showsData: true,
        canRetry: false,
      };
    case "empty":
      return {
        label: "沒有資料",
        announcement: state.message,
        showsData: false,
        canRetry: false,
      };
    case "partial":
      return {
        label: "資料不完整",
        announcement: `${state.message}，完整資料截至 ${state.completeThrough}`,
        showsData: true,
        canRetry: true,
      };
    case "stale":
      return {
        label: "顯示上次資料",
        announcement: `${state.message}，最後成功更新時間 ${state.lastSuccessfulAt}`,
        showsData: true,
        canRetry: true,
      };
    case "error":
      return {
        label: "載入失敗",
        announcement: state.message,
        showsData: false,
        canRetry: state.retryable,
      };
  }
}

export function hasDashboardData<T>(
  state: DashboardComponentState<T>,
): state is Extract<
  DashboardComponentState<T>,
  { status: "ready" | "partial" | "stale" }
> {
  return (
    state.status === "ready" ||
    state.status === "partial" ||
    state.status === "stale"
  );
}

export const learnerDrilldownSurfaces = [
  "card",
  "funnel-stage",
  "chart-point",
  "course-row",
  "source-row",
] as const;

export type LearnerDrilldownSurface =
  (typeof learnerDrilldownSurfaces)[number];

export type LearnerPopulation = Readonly<{
  key: string;
  learnerIds: readonly string[];
  filters: Readonly<Record<string, string>>;
  fingerprint: string;
}>;

export type LearnerDrilldownBinding = Readonly<{
  surface: LearnerDrilldownSurface;
  sourceId: string;
  displayedCount: number;
  population: LearnerPopulation;
  requiredPermission?: string;
}>;

function canonicalEntries(
  value: Readonly<Record<string, string>>,
): readonly (readonly [string, string])[] {
  return Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function populationFingerprint(
  key: string,
  learnerIds: readonly string[],
  filters: Readonly<Record<string, string>>,
): string {
  return JSON.stringify([key, learnerIds, canonicalEntries(filters)]);
}

export function createLearnerPopulation(input: Readonly<{
  key: string;
  learnerIds: readonly string[];
  filters?: Readonly<Record<string, string>>;
}>): LearnerPopulation {
  if (!input.key.trim()) {
    throw new Error("population key is required.");
  }

  const learnerIds = [...new Set(input.learnerIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (learnerIds.some((learnerId) => !learnerId.trim())) {
    throw new Error("learner IDs must not be blank.");
  }

  const filters = Object.fromEntries(
    canonicalEntries(input.filters ?? {}),
  ) as Readonly<Record<string, string>>;

  return Object.freeze({
    key: input.key,
    learnerIds: Object.freeze(learnerIds),
    filters: Object.freeze(filters),
    fingerprint: populationFingerprint(input.key, learnerIds, filters),
  });
}

export function bindLearnerDrilldown(
  binding: Omit<LearnerDrilldownBinding, "displayedCount"> &
    Readonly<{ displayedCount?: number }>,
): LearnerDrilldownBinding {
  const displayedCount =
    binding.displayedCount ?? binding.population.learnerIds.length;
  if (
    !Number.isInteger(displayedCount) ||
    displayedCount < 0 ||
    displayedCount !== binding.population.learnerIds.length
  ) {
    throw new Error(
      `Displayed count for ${binding.sourceId} does not match its learner population.`,
    );
  }
  if (!binding.sourceId.trim()) {
    throw new Error("sourceId is required.");
  }

  return Object.freeze({ ...binding, displayedCount });
}

export function assertIdenticalLearnerDrilldowns(
  bindings: readonly LearnerDrilldownBinding[],
): void {
  const fingerprintsByKey = new Map<string, string>();

  for (const binding of bindings) {
    if (binding.displayedCount !== binding.population.learnerIds.length) {
      throw new Error(
        `Displayed count for ${binding.sourceId} does not match its learner population.`,
      );
    }

    const prior = fingerprintsByKey.get(binding.population.key);
    if (prior && prior !== binding.population.fingerprint) {
      throw new Error(
        `Drill-down population ${binding.population.key} is inconsistent.`,
      );
    }
    fingerprintsByKey.set(
      binding.population.key,
      binding.population.fingerprint,
    );
  }
}

export type AuthorizedDrilldown =
  | Readonly<{
      allowed: true;
      sourceId: string;
      learnerIds: readonly string[];
      filters: Readonly<Record<string, string>>;
    }>
  | Readonly<{
      allowed: false;
      sourceId: string;
      reason: "permission-denied";
    }>;

export function authorizeLearnerDrilldown(
  binding: LearnerDrilldownBinding,
  permissions: ReadonlySet<string>,
): AuthorizedDrilldown {
  if (
    binding.requiredPermission &&
    !permissions.has(binding.requiredPermission)
  ) {
    return Object.freeze({
      allowed: false,
      sourceId: binding.sourceId,
      reason: "permission-denied",
    });
  }

  return Object.freeze({
    allowed: true,
    sourceId: binding.sourceId,
    learnerIds: binding.population.learnerIds,
    filters: binding.population.filters,
  });
}

const defaultSensitiveFields = new Set([
  "email",
  "learnerId",
  "uid",
  "uidHistory",
  "uidStatus",
  "verificationNote",
]);

export function maskDashboardPayload(
  value: unknown,
  canViewSensitiveLearnerData: boolean,
  sensitiveFields: ReadonlySet<string> = defaultSensitiveFields,
): unknown {
  if (canViewSensitiveLearnerData || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      maskDashboardPayload(item, false, sensitiveFields),
    );
  }
  if (typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveFields.has(key))
      .map(([key, item]) => [
        key,
        maskDashboardPayload(item, false, sensitiveFields),
      ]),
  );
}

export type DashboardRateDisplay = Readonly<{
  value: string;
  note?: string;
}>;

export function dashboardRateDisplay(
  numerator: number,
  denominator: number | null,
): DashboardRateDisplay {
  if (denominator === null) {
    return { value: numerator.toLocaleString("zh-TW") };
  }
  if (denominator === 0) {
    return { value: "—", note: "沒有符合條件的母數" };
  }
  return {
    value: `${((numerator / denominator) * 100).toFixed(1)}%`,
  };
}

export function dashboardTrackingDisplay(
  value: number | null,
  trackingStarted: boolean,
): string {
  return trackingStarted
    ? (value ?? 0).toLocaleString("zh-TW")
    : "尚未追蹤";
}
