import type { Learner, PrivateLearner } from "./schemas";
import { can, type Role } from "./permissions";

export const learnerDirectoryColumns = [
  "learnerId",
  "nickname",
  "uid",
  "uidStatus",
  "source",
  "accountStatus",
  "learningState",
  "currentLesson",
  "lastActiveAt",
  "registeredAt",
  "owner",
  "tags",
] as const;

export type LearnerDirectoryColumn = (typeof learnerDirectoryColumns)[number];
export type LearnerDirectorySortField =
  | "learnerId"
  | "nickname"
  | "uidStatus"
  | "source"
  | "accountStatus"
  | "learningState"
  | "currentLesson"
  | "lastActiveAt"
  | "registeredAt"
  | "owner";

export interface LearnerDirectoryRecord extends Learner {
  ownerId?: string;
}

export interface LearnerDirectoryFilters {
  uidStatus?: Learner["uidStatus"][];
  source?: string[];
  registeredFrom?: string;
  registeredTo?: string;
  lastActiveFrom?: string;
  lastActiveTo?: string;
  activity?: "active" | "inactive" | "never";
  currentLesson?: string[];
  completion?: "completed" | "not-completed";
  stuck?: boolean;
  tag?: string[];
  owner?: string[];
  accountStatus?: Learner["status"][];
}

export interface LearnerDirectoryQuery {
  search?: string;
  searchField?: "any" | "nickname" | "learner-id" | "uid";
  filters?: LearnerDirectoryFilters;
  sort?: {
    field: LearnerDirectorySortField;
    direction: "asc" | "desc";
  };
  pageSize?: number;
  cursor?: string;
}

export interface LearnerDirectoryRow {
  learnerId: string;
  nickname: string;
  uid?: string;
  uidStatus: Learner["uidStatus"];
  source: string;
  accountStatus: Learner["status"];
  learningState: Learner["learningState"];
  currentLesson?: string;
  lastActiveAt?: string;
  registeredAt: string;
  owner?: string;
  tags: string[];
}

export interface LearnerDirectoryPage {
  rows: LearnerDirectoryRow[];
  resultCount: number;
  nextCursor?: string;
}

export interface LearnerDirectoryData {
  learners: readonly LearnerDirectoryRecord[];
  privateLearners?: readonly PrivateLearner[];
}

interface Cursor {
  sortValue: string;
  learnerId: string;
}

const defaultSort: NonNullable<LearnerDirectoryQuery["sort"]> = {
  field: "registeredAt",
  direction: "desc",
};

const filterKeys = [
  "uidStatus",
  "source",
  "registeredFrom",
  "registeredTo",
  "lastActiveFrom",
  "lastActiveTo",
  "activity",
  "currentLesson",
  "completion",
  "stuck",
  "tag",
  "owner",
  "accountStatus",
] as const;

export function queryLearnerDirectory(
  data: LearnerDirectoryData,
  query: LearnerDirectoryQuery,
  role: Role,
): LearnerDirectoryPage {
  const search = query.search?.trim() ?? "";
  const searchField = query.searchField ?? "any";
  if (search && searchField === "uid" && !can(role, "learner.pii.view")) {
    throw new Error("UID_SEARCH_FORBIDDEN");
  }

  const privateByLearner = new Map(
    (data.privateLearners ?? []).map((entry) => [entry.learnerId, entry]),
  );
  const sort = query.sort ?? defaultSort;
  const matching = data.learners
    .filter((learner) =>
      matchesSearch(learner, privateByLearner.get(learner.learnerId), search, searchField, role),
    )
    .filter((learner) => matchesFilters(learner, query.filters ?? {}))
    .sort((left, right) => compareLearners(left, right, sort));

  const resultCount = matching.length;
  const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
  const start = cursor
    ? matching.findIndex(
        (learner) =>
          learner.learnerId === cursor.learnerId &&
          sortValue(learner, sort.field) === cursor.sortValue,
      ) + 1
    : 0;
  if (cursor && start === 0) {
    throw new Error("INVALID_LEARNER_CURSOR");
  }

  const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
  const page = matching.slice(start, start + pageSize);
  const hasNextPage = start + pageSize < matching.length;
  const last = page.at(-1);

  return {
    rows: page.map((learner) =>
      toRow(learner, privateByLearner.get(learner.learnerId), role),
    ),
    resultCount,
    nextCursor:
      hasNextPage && last
        ? encodeCursor({
            sortValue: sortValue(last, sort.field),
            learnerId: last.learnerId,
          })
        : undefined,
  };
}

function matchesSearch(
  learner: LearnerDirectoryRecord,
  privateLearner: PrivateLearner | undefined,
  search: string,
  field: NonNullable<LearnerDirectoryQuery["searchField"]>,
  role: Role,
): boolean {
  if (!search) return true;
  const normalized = search.toLocaleLowerCase();
  const nicknameMatches = learner.nickname.toLocaleLowerCase().includes(normalized);
  const idMatches = learner.learnerId.toLocaleLowerCase().includes(normalized);
  const uidMatches =
    can(role, "learner.pii.view") &&
    privateLearner?.uidNormalized?.toLocaleLowerCase() === normalized;

  if (field === "nickname") return nicknameMatches;
  if (field === "learner-id") return idMatches;
  if (field === "uid") return uidMatches;
  return nicknameMatches || idMatches || uidMatches;
}

function matchesFilters(
  learner: LearnerDirectoryRecord,
  filters: LearnerDirectoryFilters,
): boolean {
  if (filters.uidStatus?.length && !filters.uidStatus.includes(learner.uidStatus)) return false;
  if (filters.source?.length && !filters.source.includes(learner.sourceLatest)) return false;
  if (filters.registeredFrom && learner.createdAt < filters.registeredFrom) return false;
  if (filters.registeredTo && learner.createdAt > filters.registeredTo) return false;
  if (filters.lastActiveFrom && (!learner.lastActiveAt || learner.lastActiveAt < filters.lastActiveFrom))
    return false;
  if (filters.lastActiveTo && (!learner.lastActiveAt || learner.lastActiveAt > filters.lastActiveTo))
    return false;
  if (
    filters.activity === "active" &&
    (!learner.lastActiveAt || learner.learningState === "inactive")
  )
    return false;
  if (filters.activity === "inactive" && learner.learningState !== "inactive") return false;
  if (filters.activity === "never" && learner.lastActiveAt) return false;
  if (filters.currentLesson?.length && !filters.currentLesson.includes(learner.currentLessonId ?? ""))
    return false;
  if (filters.completion === "completed" && learner.learningState !== "completed") return false;
  if (filters.completion === "not-completed" && learner.learningState === "completed") return false;
  if (filters.stuck !== undefined && (learner.learningState === "stuck") !== filters.stuck)
    return false;
  if (filters.tag?.length && !filters.tag.some((tag) => learner.tags.includes(tag))) return false;
  if (filters.owner?.length && !filters.owner.includes(learner.ownerId ?? "")) return false;
  if (filters.accountStatus?.length && !filters.accountStatus.includes(learner.status)) return false;
  return true;
}

function sortValue(
  learner: LearnerDirectoryRecord,
  field: LearnerDirectorySortField,
): string {
  const values: Record<LearnerDirectorySortField, string | undefined> = {
    learnerId: learner.learnerId,
    nickname: learner.nickname,
    uidStatus: learner.uidStatus,
    source: learner.sourceLatest,
    accountStatus: learner.status,
    learningState: learner.learningState,
    currentLesson: learner.currentLessonId,
    lastActiveAt: learner.lastActiveAt,
    registeredAt: learner.createdAt,
    owner: learner.ownerId,
  };
  return values[field] ?? "";
}

function compareLearners(
  left: LearnerDirectoryRecord,
  right: LearnerDirectoryRecord,
  sort: NonNullable<LearnerDirectoryQuery["sort"]>,
): number {
  const comparison = sortValue(left, sort.field).localeCompare(sortValue(right, sort.field));
  const stableComparison = comparison || left.learnerId.localeCompare(right.learnerId);
  return sort.direction === "asc" ? stableComparison : -stableComparison;
}

function toRow(
  learner: LearnerDirectoryRecord,
  privateLearner: PrivateLearner | undefined,
  role: Role,
): LearnerDirectoryRow {
  return {
    learnerId: learner.learnerId,
    nickname: learner.nickname,
    uid: can(role, "learner.pii.view") ? privateLearner?.uidCurrent : undefined,
    uidStatus: learner.uidStatus,
    source: learner.sourceLatest,
    accountStatus: learner.status,
    learningState: learner.learningState,
    currentLesson: learner.currentLessonId,
    lastActiveAt: learner.lastActiveAt,
    registeredAt: learner.createdAt,
    owner: learner.ownerId,
    tags: [...learner.tags],
  };
}

function encodeCursor(cursor: Cursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<Cursor>;
    if (typeof parsed.sortValue !== "string" || typeof parsed.learnerId !== "string") {
      throw new Error();
    }
    return parsed as Cursor;
  } catch {
    throw new Error("INVALID_LEARNER_CURSOR");
  }
}

export function learnerDirectoryQueryToUrl(query: LearnerDirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.searchField && query.searchField !== "any") params.set("searchField", query.searchField);
  for (const key of filterKeys) {
    const value = query.filters?.[key];
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, String(value));
  }
  if (query.sort) {
    params.set("sort", query.sort.field);
    params.set("direction", query.sort.direction);
  }
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.cursor) params.set("cursor", query.cursor);
  return params.toString();
}

export function learnerDirectoryQueryFromUrl(search: string): LearnerDirectoryQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const filters: LearnerDirectoryFilters = {
    uidStatus: params.getAll("uidStatus") as Learner["uidStatus"][],
    source: params.getAll("source"),
    registeredFrom: params.get("registeredFrom") ?? undefined,
    registeredTo: params.get("registeredTo") ?? undefined,
    lastActiveFrom: params.get("lastActiveFrom") ?? undefined,
    lastActiveTo: params.get("lastActiveTo") ?? undefined,
    activity: (params.get("activity") as LearnerDirectoryFilters["activity"]) ?? undefined,
    currentLesson: params.getAll("currentLesson"),
    completion:
      (params.get("completion") as LearnerDirectoryFilters["completion"]) ?? undefined,
    stuck: params.has("stuck") ? params.get("stuck") === "true" : undefined,
    tag: params.getAll("tag"),
    owner: params.getAll("owner"),
    accountStatus: params.getAll("accountStatus") as Learner["status"][],
  };
  return {
    search: params.get("q") ?? undefined,
    searchField:
      (params.get("searchField") as LearnerDirectoryQuery["searchField"]) ?? "any",
    filters,
    sort: params.get("sort")
      ? {
          field: params.get("sort") as LearnerDirectorySortField,
          direction: params.get("direction") === "asc" ? "asc" : "desc",
        }
      : undefined,
    pageSize: params.has("pageSize") ? Number(params.get("pageSize")) : undefined,
    cursor: params.get("cursor") ?? undefined,
  };
}

export interface SavedLearnerView {
  viewId: string;
  name: string;
  visibility: "private" | "team";
  ownerId: string;
  filters: LearnerDirectoryFilters;
  columns: LearnerDirectoryColumn[];
  sort: NonNullable<LearnerDirectoryQuery["sort"]>;
  updatedAt: string;
}

export function saveLearnerView(
  existing: readonly SavedLearnerView[],
  view: SavedLearnerView,
  actorId: string,
): SavedLearnerView[] {
  if (view.ownerId !== actorId) throw new Error("VIEW_OWNER_REQUIRED");
  if (!view.name.trim()) throw new Error("VIEW_NAME_REQUIRED");
  if (!view.columns.length || view.columns.some((column) => !learnerDirectoryColumns.includes(column)))
    throw new Error("INVALID_VIEW_COLUMNS");
  return [...existing.filter((entry) => entry.viewId !== view.viewId), { ...view }];
}

export function visibleLearnerViews(
  views: readonly SavedLearnerView[],
  actorId: string,
): SavedLearnerView[] {
  return views.filter((view) => view.visibility === "team" || view.ownerId === actorId);
}
