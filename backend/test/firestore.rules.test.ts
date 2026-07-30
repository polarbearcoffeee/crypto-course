import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-crypto-course";
let testEnv: RulesTestEnvironment;

function dbFor(uid: string, roles: string[]) {
  return testEnv.authenticatedContext(uid, { roles }).firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    for (const [uid, role] of [
      ["owner-1", "owner"],
      ["lead-1", "lead-teacher"],
      ["assistant-1", "assistant"],
      ["editor-1", "content-editor"],
      ["analyst-1", "analyst"],
    ] as const) {
      await setDoc(doc(db, "adminUsers", uid), {
        uid,
        displayName: uid,
        roles: [role],
        status: "active",
      });
    }

    await setDoc(doc(db, "learners", "learner-1"), {
      learnerId: "learner-1",
      nickname: "Demo learner",
      sourceFirst: "youtube",
      sourceLatest: "youtube",
      status: "active",
      learningState: "in-progress",
      uidStatus: "pending",
      tags: [],
      createdAt: "2026-07-01T00:00:00+08:00",
      updatedAt: "2026-07-30T00:00:00+08:00",
    });
    await setDoc(doc(db, "learnerPrivate", "learner-1"), {
      learnerId: "learner-1",
      uidCurrent: "1234567890",
      uidNormalized: "1234567890",
    });
    await setDoc(doc(db, "learnerNotes", "note-1"), {
      learnerId: "learner-1",
      body: "Private follow-up note",
      authorId: "assistant-1",
    });
    await setDoc(doc(db, "uidVerifications", "verify-1"), {
      learnerId: "learner-1",
      status: "pending",
      uidValue: "1234567890",
      uidNormalized: "1234567890",
      submittedAt: "2026-07-30T00:00:00+08:00",
    });
    await setDoc(doc(db, "curriculumDrafts", "draft-1"), {
      courseId: "beginner",
      editorId: "editor-1",
      status: "draft",
      content: { title: "Before" },
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore role and field boundaries", () => {
  it("lets all active admin roles read the non-private learner directory", async () => {
    for (const [uid, role] of [
      ["owner-1", "owner"],
      ["lead-1", "lead-teacher"],
      ["assistant-1", "assistant"],
      ["editor-1", "content-editor"],
      ["analyst-1", "analyst"],
    ] as const) {
      await assertSucceeds(
        getDoc(doc(dbFor(uid, [role]), "learners", "learner-1")),
      );
    }
  });

  it("denies UID and private notes to analyst and content editor", async () => {
    for (const [uid, role] of [
      ["analyst-1", "analyst"],
      ["editor-1", "content-editor"],
    ] as const) {
      const db = dbFor(uid, [role]);
      await assertFails(getDoc(doc(db, "learnerPrivate", "learner-1")));
      await assertFails(getDoc(doc(db, "learnerNotes", "note-1")));
      await assertFails(getDoc(doc(db, "uidVerifications", "verify-1")));
    }
  });

  it("allows operational staff to read private learner data", async () => {
    for (const [uid, role] of [
      ["owner-1", "owner"],
      ["lead-1", "lead-teacher"],
      ["assistant-1", "assistant"],
    ] as const) {
      await assertSucceeds(
        getDoc(doc(dbFor(uid, [role]), "learnerPrivate", "learner-1")),
      );
    }
  });

  it("prevents private fields from being added to a public learner document", async () => {
    const ref = doc(
      dbFor("assistant-1", ["assistant"]),
      "learners",
      "learner-1",
    );
    await assertFails(
      updateDoc(ref, {
        uidCurrent: "1234567890",
        privateNote: "must remain in restricted collections",
      }),
    );
  });

  it("requires token roles and server profile roles to agree", async () => {
    await assertFails(
      getDoc(
        doc(dbFor("analyst-1", ["owner"]), "learnerPrivate", "learner-1"),
      ),
    );
  });

  it("denies a suspended administrator even when the token still has a role", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "adminUsers", "assistant-1"), {
        status: "suspended",
      });
    });
    await assertFails(
      getDoc(
        doc(
          dbFor("assistant-1", ["assistant"]),
          "learnerPrivate",
          "learner-1",
        ),
      ),
    );
  });

  it("allows assistant UID verification but prevents UID replacement", async () => {
    const ref = doc(
      dbFor("assistant-1", ["assistant"]),
      "uidVerifications",
      "verify-1",
    );
    await assertSucceeds(
      updateDoc(ref, {
        status: "verified",
        verifierId: "assistant-1",
        verifiedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(ref, { uidValue: "9999999999" }));
  });

  it("allows content editor to edit own draft and denies analyst", async () => {
    await assertSucceeds(
      updateDoc(
        doc(
          dbFor("editor-1", ["content-editor"]),
          "curriculumDrafts",
          "draft-1",
        ),
        { content: { title: "After" } },
      ),
    );
    await assertFails(
      updateDoc(
        doc(
          dbFor("analyst-1", ["analyst"]),
          "curriculumDrafts",
          "draft-1",
        ),
        { content: { title: "Analyst edit" } },
      ),
    );
  });

  it("denies direct curriculum publish to unauthorized roles and owners", async () => {
    for (const [uid, role] of [
      ["assistant-1", "assistant"],
      ["analyst-1", "analyst"],
      ["editor-1", "content-editor"],
      ["owner-1", "owner"],
    ] as const) {
      await assertFails(
        setDoc(doc(dbFor(uid, [role]), "curriculumVersions", `v-${role}`), {
          courseId: "beginner",
          versionId: "v2",
        }),
      );
    }
  });

  it("denies direct export job creation to unauthorized roles and owners", async () => {
    for (const [uid, role] of [
      ["assistant-1", "assistant"],
      ["editor-1", "content-editor"],
      ["analyst-1", "analyst"],
      ["owner-1", "owner"],
    ] as const) {
      await assertFails(
        setDoc(doc(dbFor(uid, [role]), "exportJobs", `job-${role}`), {
          requesterId: uid,
          fields: ["uid"],
        }),
      );
    }
  });

  it("denies direct role changes even to owners", async () => {
    await assertFails(
      updateDoc(doc(dbFor("lead-1", ["lead-teacher"]), "adminUsers", "lead-1"), {
        roles: ["owner"],
      }),
    );
    await assertFails(
      updateDoc(doc(dbFor("owner-1", ["owner"]), "adminUsers", "analyst-1"), {
        roles: ["owner"],
      }),
    );
  });

  it("denies direct settings changes even to owners", async () => {
    await assertFails(
      setDoc(
        doc(
          dbFor("lead-1", ["lead-teacher"]),
          "settingsVersions",
          "version-2",
        ),
        { passingScore: 0 },
      ),
    );
    await assertFails(
      setDoc(
        doc(dbFor("owner-1", ["owner"]), "settingsVersions", "version-2"),
        { passingScore: 0 },
      ),
    );
  });

  it("denies unauthenticated reads", async () => {
    await assertFails(
      getDoc(
        doc(
          testEnv.unauthenticatedContext().firestore(),
          "learners",
          "learner-1",
        ),
      ),
    );
  });
});
