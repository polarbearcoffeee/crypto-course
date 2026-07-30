import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type IndexField = {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
  arrayConfig?: "CONTAINS";
};

type CompositeIndex = {
  collectionGroup: string;
  queryScope: "COLLECTION";
  fields: IndexField[];
};

const indexConfig = JSON.parse(
  readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8"),
) as { indexes: CompositeIndex[] };

function hasIndex(collection: string, fieldPaths: string[]) {
  return indexConfig.indexes.some(
    (index) =>
      index.collectionGroup === collection &&
      fieldPaths.every(
        (fieldPath, position) =>
          index.fields[position]?.fieldPath === fieldPath,
      ),
  );
}

describe("Firestore operational indexes", () => {
  it("covers learner queues, sources, course stage, activity, and pagination", () => {
    expect(hasIndex("learners", ["uidStatus", "updatedAt", "__name__"])).toBe(
      true,
    );
    expect(hasIndex("learners", ["sourceFirst", "createdAt", "__name__"])).toBe(
      true,
    );
    expect(
      hasIndex("learners", ["sourceLatest", "lastActiveAt", "__name__"]),
    ).toBe(true);
    expect(
      hasIndex("learners", [
        "currentCourseId",
        "learningState",
        "lastActiveAt",
        "__name__",
      ]),
    ).toBe(true);
    expect(hasIndex("learners", ["status", "lastActiveAt", "__name__"])).toBe(
      true,
    );
  });

  it("covers UID workflow and paginated learner history", () => {
    expect(
      hasIndex("uidVerifications", ["status", "submittedAt", "__name__"]),
    ).toBe(true);
    expect(
      hasIndex("uidVerifications", [
        "learnerId",
        "submittedAt",
        "__name__",
      ]),
    ).toBe(true);
    expect(
      hasIndex("learningEvents", ["learnerId", "receivedAt", "__name__"]),
    ).toBe(true);
  });
});
