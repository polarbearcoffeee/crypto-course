export const datePresets = ["7d", "30d", "90d", "custom"] as const;
export type DatePreset = (typeof datePresets)[number];

export const learnerStates = [
  "registered",
  "activated",
  "in-progress",
  "stuck",
  "completed",
  "inactive",
] as const;
export type DashboardLearnerState = (typeof learnerStates)[number];

export const courseStages = [
  "registered",
  "uid-verified",
  "lesson-started",
  "lesson-passed",
  "beginner-completed",
  "advanced-eligible",
] as const;
export type CourseStage = (typeof courseStages)[number];

export const uidStatuses = [
  "pending",
  "verified",
  "rejected",
  "needs-correction",
] as const;
export type DashboardUidStatus = (typeof uidStatuses)[number];

export type DashboardFilters = Readonly<{
  datePreset: DatePreset;
  dateFrom?: string;
  dateTo?: string;
  sources: readonly string[];
  cohorts: readonly string[];
  learnerStates: readonly DashboardLearnerState[];
  courseStages: readonly CourseStage[];
  uidStatuses: readonly DashboardUidStatus[];
}>;

export type DashboardFilterKey =
  | "date"
  | "source"
  | "cohort"
  | "learner-state"
  | "course-stage"
  | "uid-status";

export type DashboardFilterChip = Readonly<{
  key: DashboardFilterKey;
  value: string;
  label: string;
}>;

export const defaultDashboardFilters: DashboardFilters = Object.freeze({
  datePreset: "30d",
  sources: Object.freeze([]),
  cohorts: Object.freeze([]),
  learnerStates: Object.freeze([]),
  courseStages: Object.freeze([]),
  uidStatuses: Object.freeze([]),
});

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const safeDimensionPattern = /^[\p{L}\p{N}][\p{L}\p{N}._:@/ -]{0,127}$/u;

function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return allowed.includes(value as T);
}

function uniqueValidDimensions(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()))].filter((value) =>
    safeDimensionPattern.test(value),
  );
}

function uniqueAllowed<T extends string>(
  values: readonly string[],
  allowed: readonly T[],
): T[] {
  return [...new Set(values)].filter((value): value is T =>
    isOneOf(value, allowed),
  );
}

function isValidCalendarDate(value: string | null): value is string {
  if (!value || !datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toSearchParams(input: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const query = input.includes("?") ? input.slice(input.indexOf("?") + 1) : input;
  return new URLSearchParams(query.split("#", 1)[0]);
}

export function decodeDashboardFilters(
  input: string | URLSearchParams,
): DashboardFilters {
  const params = toSearchParams(input);
  const requestedPreset = params.get("date");
  const datePreset =
    requestedPreset && isOneOf(requestedPreset, datePresets)
      ? requestedPreset
      : defaultDashboardFilters.datePreset;
  const dateFrom = params.get("from");
  const dateTo = params.get("to");
  const validCustomRange =
    datePreset === "custom" &&
    isValidCalendarDate(dateFrom) &&
    isValidCalendarDate(dateTo) &&
    dateFrom <= dateTo;

  return {
    datePreset: validCustomRange ? "custom" : datePreset === "custom" ? "30d" : datePreset,
    ...(validCustomRange ? { dateFrom, dateTo } : {}),
    sources: uniqueValidDimensions(params.getAll("source")),
    cohorts: uniqueValidDimensions(params.getAll("cohort")),
    learnerStates: uniqueAllowed(params.getAll("learner-state"), learnerStates),
    courseStages: uniqueAllowed(params.getAll("course-stage"), courseStages),
    uidStatuses: uniqueAllowed(params.getAll("uid-status"), uidStatuses),
  };
}

export function encodeDashboardFilters(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  params.set("date", filters.datePreset);
  const { dateFrom, dateTo } = filters;
  if (
    filters.datePreset === "custom" &&
    dateFrom &&
    dateTo &&
    isValidCalendarDate(dateFrom) &&
    isValidCalendarDate(dateTo) &&
    dateFrom <= dateTo
  ) {
    params.set("from", dateFrom);
    params.set("to", dateTo);
  }

  const append = (key: string, values: readonly string[]) => {
    for (const value of values) params.append(key, value);
  };
  append("source", uniqueValidDimensions(filters.sources));
  append("cohort", uniqueValidDimensions(filters.cohorts));
  append("learner-state", uniqueAllowed(filters.learnerStates, learnerStates));
  append("course-stage", uniqueAllowed(filters.courseStages, courseStages));
  append("uid-status", uniqueAllowed(filters.uidStatuses, uidStatuses));
  return params.toString();
}

export function getDashboardFilterChips(
  filters: DashboardFilters,
): readonly DashboardFilterChip[] {
  const chips: DashboardFilterChip[] = [
    {
      key: "date",
      value: filters.datePreset,
      label:
        filters.datePreset === "custom" && filters.dateFrom && filters.dateTo
          ? `日期：${filters.dateFrom}～${filters.dateTo}`
          : `日期：${filters.datePreset}`,
    },
  ];
  const add = (
    key: DashboardFilterKey,
    prefix: string,
    values: readonly string[],
  ) => {
    for (const value of values) {
      chips.push({ key, value, label: `${prefix}：${value}` });
    }
  };
  add("source", "來源", filters.sources);
  add("cohort", "同期群", filters.cohorts);
  add("learner-state", "學員狀態", filters.learnerStates);
  add("course-stage", "課程階段", filters.courseStages);
  add("uid-status", "UID 狀態", filters.uidStatuses);
  return chips;
}

export function clearDashboardFilter(
  filters: DashboardFilters,
  key: DashboardFilterKey,
  value?: string,
): DashboardFilters {
  if (key === "date") return { ...filters, datePreset: "30d", dateFrom: undefined, dateTo: undefined };

  const propertyByKey = {
    source: "sources",
    cohort: "cohorts",
    "learner-state": "learnerStates",
    "course-stage": "courseStages",
    "uid-status": "uidStatuses",
  } as const;
  const property = propertyByKey[key];
  const current = filters[property];
  return {
    ...filters,
    [property]: value === undefined ? [] : current.filter((item) => item !== value),
  };
}

export function clearAllDashboardFilters(): DashboardFilters {
  return {
    ...defaultDashboardFilters,
    sources: [],
    cohorts: [],
    learnerStates: [],
    courseStages: [],
    uidStatuses: [],
  };
}
