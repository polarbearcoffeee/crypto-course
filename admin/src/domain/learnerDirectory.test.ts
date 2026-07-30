import { describe, expect, it } from "vitest";

import type { Learner, PrivateLearner } from "./schemas";
import {
  learnerDirectoryQueryFromUrl,
  learnerDirectoryQueryToUrl,
  queryLearnerDirectory,
  saveLearnerView,
  visibleLearnerViews,
  type LearnerDirectoryRecord,
  type SavedLearnerView,
} from "./learnerDirectory";

const iso = (day: number) => `2026-07-${String(day).padStart(2, "0")}T08:00:00+00:00`;

function learner(
  learnerId: string,
  nickname: string,
  day: number,
  overrides: Partial<LearnerDirectoryRecord> = {},
): LearnerDirectoryRecord {
  return {
    learnerId,
    nickname,
    sourceFirst: "youtube",
    sourceLatest: "youtube",
    status: "active",
    learningState: "in-progress",
    uidStatus: "pending",
    currentCourseId: "beginner",
    currentLessonId: "lesson-1",
    lastActiveAt: iso(day),
    tags: [],
    createdAt: iso(day),
    updatedAt: iso(day),
    ...overrides,
  };
}

const learners: LearnerDirectoryRecord[] = [
  learner("L-001", "北極熊", 1, {
    uidStatus: "verified",
    sourceLatest: "discord",
    learningState: "completed",
    currentLessonId: "lesson-3",
    tags: ["vip"],
    ownerId: "teacher-a",
  }),
  learner("L-002", "咖啡豆", 2, {
    learningState: "stuck",
    status: "paused",
    tags: ["follow-up"],
    ownerId: "teacher-b",
  }),
  learner("L-003", "企鵝", 3, {
    uidStatus: "needs-correction",
    sourceLatest: "referral",
    learningState: "inactive",
    lastActiveAt: undefined,
    currentLessonId: "lesson-2",
    ownerId: "teacher-a",
  }),
];

const privateLearners: PrivateLearner[] = [
  {
    learnerId: "L-001",
    uidCurrent: "UID-ABC",
    uidNormalized: "uid-abc",
    updatedAt: iso(5),
  },
  {
    learnerId: "L-002",
    uidCurrent: "UID-ABCD",
    uidNormalized: "uid-abcd",
    updatedAt: iso(5),
  },
];

describe("learner directory", () => {
  it("returns a server-style result count and stable cursor pages", () => {
    const first = queryLearnerDirectory(
      { learners, privateLearners },
      { pageSize: 2, sort: { field: "learnerId", direction: "asc" } },
      "assistant",
    );
    const second = queryLearnerDirectory(
      { learners, privateLearners },
      {
        pageSize: 2,
        sort: { field: "learnerId", direction: "asc" },
        cursor: first.nextCursor,
      },
      "assistant",
    );

    expect(first.resultCount).toBe(3);
    expect(first.rows.map((row) => row.learnerId)).toEqual(["L-001", "L-002"]);
    expect(second.rows.map((row) => row.learnerId)).toEqual(["L-003"]);
    expect(second.nextCursor).toBeUndefined();
  });

  it("searches nickname and learner ID but requires permission for exact UID", () => {
    expect(
      queryLearnerDirectory({ learners, privateLearners }, { search: "咖啡" }, "assistant").rows,
    ).toHaveLength(1);
    expect(
      queryLearnerDirectory({ learners }, { search: "L-003", searchField: "learner-id" }, "analyst")
        .rows[0].nickname,
    ).toBe("企鵝");
    expect(
      queryLearnerDirectory(
        { learners, privateLearners },
        { search: "UID-ABC", searchField: "uid" },
        "assistant",
      ).rows.map((row) => row.learnerId),
    ).toEqual(["L-001"]);
    expect(() =>
      queryLearnerDirectory(
        { learners, privateLearners },
        { search: "UID-ABC", searchField: "uid" },
        "analyst",
      ),
    ).toThrow("UID_SEARCH_FORBIDDEN");
  });

  it("does not treat a partial UID as a match and masks UID from unauthorized rows", () => {
    expect(
      queryLearnerDirectory(
        { learners, privateLearners },
        { search: "UID-AB", searchField: "uid" },
        "assistant",
      ).rows,
    ).toHaveLength(0);
    expect(queryLearnerDirectory({ learners, privateLearners }, {}, "analyst").rows[0].uid).toBe(
      undefined,
    );
  });

  it("supports every operations filter", () => {
    const cases: Array<[object, string[]]> = [
      [{ uidStatus: ["verified"] }, ["L-001"]],
      [{ source: ["referral"] }, ["L-003"]],
      [{ registeredFrom: iso(2), registeredTo: iso(2) }, ["L-002"]],
      [{ lastActiveFrom: iso(2), lastActiveTo: iso(2) }, ["L-002"]],
      [{ activity: "active" }, ["L-002", "L-001"]],
      [{ activity: "inactive" }, ["L-003"]],
      [{ activity: "never" }, ["L-003"]],
      [{ currentLesson: ["lesson-3"] }, ["L-001"]],
      [{ completion: "completed" }, ["L-001"]],
      [{ stuck: true }, ["L-002"]],
      [{ tag: ["vip"] }, ["L-001"]],
      [{ owner: ["teacher-b"] }, ["L-002"]],
      [{ accountStatus: ["paused"] }, ["L-002"]],
    ];

    for (const [filters, expected] of cases) {
      expect(
        queryLearnerDirectory({ learners }, { filters }, "assistant").rows.map(
          (row) => row.learnerId,
        ),
      ).toEqual(expected);
    }
  });

  it("round-trips filters, sorting, page size, and cursor through URL parameters", () => {
    const query = {
      search: "熊",
      searchField: "nickname" as const,
      filters: {
        uidStatus: ["verified"] as Learner["uidStatus"][],
        source: ["discord"],
        registeredFrom: iso(1),
        activity: "active" as const,
        currentLesson: ["lesson-3"],
        completion: "completed" as const,
        stuck: false,
        tag: ["vip"],
        owner: ["teacher-a"],
        accountStatus: ["active"] as Learner["status"][],
      },
      sort: { field: "nickname" as const, direction: "asc" as const },
      pageSize: 50,
      cursor: "cursor-value",
    };

    expect(learnerDirectoryQueryFromUrl(learnerDirectoryQueryToUrl(query))).toEqual(query);
  });

  it("rejects stale or malformed cursors", () => {
    expect(() =>
      queryLearnerDirectory({ learners }, { cursor: "not-json" }, "assistant"),
    ).toThrow("INVALID_LEARNER_CURSOR");
    expect(() =>
      queryLearnerDirectory(
        { learners },
        {
          cursor: encodeURIComponent(
            JSON.stringify({ learnerId: "missing", sortValue: iso(9) }),
          ),
        },
        "assistant",
      ),
    ).toThrow("INVALID_LEARNER_CURSOR");
  });
});

describe("saved learner views", () => {
  const privateView: SavedLearnerView = {
    viewId: "private-1",
    name: "我的待追蹤",
    visibility: "private",
    ownerId: "admin-a",
    filters: { stuck: true, owner: ["admin-a"] },
    columns: ["learnerId", "nickname", "lastActiveAt", "owner"],
    sort: { field: "lastActiveAt", direction: "asc" },
    updatedAt: iso(10),
  };
  const teamView: SavedLearnerView = {
    ...privateView,
    viewId: "team-1",
    name: "每日 UID 審核",
    visibility: "team",
    filters: { uidStatus: ["pending"] },
    columns: ["learnerId", "nickname", "uidStatus", "source"],
    sort: { field: "registeredAt", direction: "asc" },
  };

  it("keeps private views private while sharing team views with their configuration", () => {
    const views = saveLearnerView([], privateView, "admin-a");
    const withTeam = saveLearnerView(views, teamView, "admin-a");

    expect(visibleLearnerViews(withTeam, "admin-b")).toEqual([teamView]);
    expect(visibleLearnerViews(withTeam, "admin-a")).toEqual([privateView, teamView]);
    expect(withTeam[1].columns).toEqual(teamView.columns);
    expect(withTeam[1].sort).toEqual(teamView.sort);
  });

  it("requires ownership and valid configurable columns", () => {
    expect(() => saveLearnerView([], privateView, "admin-b")).toThrow("VIEW_OWNER_REQUIRED");
    expect(() =>
      saveLearnerView([], { ...privateView, columns: [] }, "admin-a"),
    ).toThrow("INVALID_VIEW_COLUMNS");
  });
});
