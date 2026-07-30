import { describe, expect, it } from "vitest";
import {
  addControlledTag,
  addLearnerNote,
  assignFollowUpOwner,
  changeLearnerStatus,
  confirmBulkOperation,
  getLearnerAccessPolicy,
  previewBulkOperation,
  type BulkOperationStore,
  type ControlledTag,
  type LearnerOperationsRecord,
} from "./learnerOperations";

const now = "2026-07-30T10:00:00Z";
const tags: ControlledTag[] = [
  { tagId: "stuck", label: "Needs follow-up", active: true },
  { tagId: "retired", label: "Retired", active: false },
];

const learner = (
  learnerId: string,
  status: LearnerOperationsRecord["status"] = "active",
): LearnerOperationsRecord => ({
  learnerId,
  status,
  tags: [],
  notes: [],
  statusHistory: [],
  updatedAt: "2026-07-29T10:00:00Z",
});

describe("learner notes, controlled tags, and ownership", () => {
  it("records timestamped notes in chronological order with author identity", () => {
    const later = addLearnerNote({
      record: learner("learner-1"),
      noteId: "note-2",
      authorId: "teacher-1",
      body: "Follow up tomorrow",
      occurredAt: "2026-07-30T12:00:00Z",
    });
    const earlier = addLearnerNote({
      record: later.record,
      noteId: "note-1",
      authorId: "teacher-2",
      body: "Asked about lesson 2",
      occurredAt: now,
    });

    expect(earlier.record.notes.map((note) => note.noteId)).toEqual([
      "note-1",
      "note-2",
    ]);
    expect(earlier.record.notes[0]).toMatchObject({
      authorId: "teacher-2",
      createdAt: now,
    });
    expect(earlier.audit.action).toBe("note-added");
  });

  it("rejects blank or duplicate notes", () => {
    expect(() =>
      addLearnerNote({
        record: learner("learner-1"),
        noteId: "note-1",
        authorId: "teacher-1",
        body: " ",
        occurredAt: now,
      }),
    ).toThrow("Note is required.");

    const first = addLearnerNote({
      record: learner("learner-1"),
      noteId: "note-1",
      authorId: "teacher-1",
      body: "First",
      occurredAt: now,
    });
    expect(() =>
      addLearnerNote({
        record: first.record,
        noteId: "note-1",
        authorId: "teacher-1",
        body: "Duplicate",
        occurredAt: now,
      }),
    ).toThrow("Note ID already exists.");
  });

  it("only applies active controlled tags and does not duplicate a tag", () => {
    const first = addControlledTag({
      record: learner("learner-1"),
      tagId: "stuck",
      catalog: tags,
      actorId: "teacher-1",
      occurredAt: now,
    });
    const duplicate = addControlledTag({
      record: first.record,
      tagId: "stuck",
      catalog: tags,
      actorId: "teacher-1",
      occurredAt: now,
    });

    expect(first.record.tags).toEqual(["stuck"]);
    expect(duplicate.record.tags).toEqual(["stuck"]);
    expect(duplicate.audit).toBeUndefined();
    expect(() =>
      addControlledTag({
        record: learner("learner-1"),
        tagId: "retired",
        catalog: tags,
        actorId: "teacher-1",
        occurredAt: now,
      }),
    ).toThrow("Tag is not active");
  });

  it("assigns a follow-up owner and audits the previous owner", () => {
    const result = assignFollowUpOwner({
      record: { ...learner("learner-1"), followUpOwnerId: "teacher-1" },
      ownerId: "teacher-2",
      actorId: "lead-1",
      occurredAt: now,
    });
    expect(result.record.followUpOwnerId).toBe("teacher-2");
    expect(result.audit).toMatchObject({
      before: "teacher-1",
      after: "teacher-2",
    });
  });
});

describe("learner lifecycle policy", () => {
  it("maps every status to explicit access behavior", () => {
    expect(getLearnerAccessPolicy("active")).toMatchObject({
      canSignIn: true,
      canWriteLearningProgress: true,
    });
    expect(getLearnerAccessPolicy("paused")).toMatchObject({
      canSignIn: true,
      canReadLearningContent: true,
      canWriteLearningProgress: false,
    });
    expect(getLearnerAccessPolicy("blocked").canWriteLearningProgress).toBe(
      false,
    );
    expect(
      getLearnerAccessPolicy("deleted-pending-retention").canSignIn,
    ).toBe(false);
  });

  it("requires a reason and records status and access in the audit", () => {
    expect(() =>
      changeLearnerStatus({
        record: learner("learner-1"),
        status: "blocked",
        reason: " ",
        actorId: "lead-1",
        actorRole: "lead-teacher",
        occurredAt: now,
      }),
    ).toThrow("Status change reason is required.");

    const result = changeLearnerStatus({
      record: learner("learner-1"),
      status: "blocked",
      reason: "Repeated abuse",
      actorId: "lead-1",
      actorRole: "lead-teacher",
      occurredAt: now,
    });
    expect(result.record.status).toBe("blocked");
    expect(result.record.statusHistory[0]).toMatchObject({
      from: "active",
      to: "blocked",
      reason: "Repeated abuse",
    });
    expect(result.audit?.after).toMatchObject({
      status: "blocked",
      access: { canWriteLearningProgress: false },
    });
  });

  it("restricts sensitive statuses to owners and lead teachers", () => {
    expect(() =>
      changeLearnerStatus({
        record: learner("learner-1"),
        status: "deleted-pending-retention",
        reason: "Retention request",
        actorId: "assistant-1",
        actorRole: "assistant",
        occurredAt: now,
      }),
    ).toThrow("Only an owner or lead teacher");
  });
});

describe("bulk learner operations", () => {
  it("previews a deduplicated cross-page selection before applying changes", () => {
    const preview = previewBulkOperation({
      idempotencyKey: "bulk-1",
      learnerIds: ["learner-1", "learner-2", "learner-1"],
      action: { type: "add-tag", tagId: "stuck", catalog: tags },
    });
    expect(preview).toMatchObject({
      selectedCount: 2,
      duplicateSelectionCount: 1,
      requiresConfirmation: true,
    });
    expect(preview.learnerIds).toEqual(["learner-1", "learner-2"]);
  });

  it("refuses execution without explicit confirmation", () => {
    const preview = previewBulkOperation({
      idempotencyKey: "bulk-1",
      learnerIds: ["learner-1"],
      action: { type: "assign-owner", ownerId: "teacher-1" },
    });
    expect(() =>
      confirmBulkOperation({
        preview,
        confirmed: false,
        records: new Map([["learner-1", learner("learner-1")]]),
        actorId: "lead-1",
        actorRole: "lead-teacher",
        occurredAt: now,
        store: new Map(),
      }),
    ).toThrow("requires confirmation");
  });

  it("reports partial failures without rolling back successful learners", () => {
    const preview = previewBulkOperation({
      idempotencyKey: "bulk-partial",
      learnerIds: ["learner-1", "learner-2", "missing"],
      action: { type: "assign-owner", ownerId: "teacher-1" },
    });
    const result = confirmBulkOperation({
      preview,
      confirmed: true,
      records: new Map([
        ["learner-1", learner("learner-1")],
        ["learner-2", learner("learner-2")],
      ]),
      actorId: "lead-1",
      actorRole: "lead-teacher",
      occurredAt: now,
      store: new Map(),
      canManage: (record) => record.learnerId !== "learner-2",
    });

    expect(result).toMatchObject({
      status: "partial",
      successCount: 1,
      failureCount: 2,
    });
    expect(result.records.get("learner-1")?.followUpOwnerId).toBe("teacher-1");
    expect(result.records.get("learner-2")?.followUpOwnerId).toBeUndefined();
    expect(result.failures).toEqual([
      { learnerId: "learner-2", reason: "Not authorized for learner." },
      { learnerId: "missing", reason: "Learner not found." },
    ]);
  });

  it("applies bulk tags once and replays an idempotent result", () => {
    const preview = previewBulkOperation({
      idempotencyKey: "bulk-idempotent",
      learnerIds: ["learner-1", "learner-2"],
      action: { type: "add-tag", tagId: "stuck", catalog: tags },
    });
    const store: BulkOperationStore = new Map();
    const input = {
      preview,
      confirmed: true,
      records: new Map([
        ["learner-1", learner("learner-1")],
        ["learner-2", learner("learner-2")],
      ]),
      actorId: "lead-1",
      actorRole: "lead-teacher" as const,
      occurredAt: now,
      store,
    };
    const first = confirmBulkOperation(input);
    const replay = confirmBulkOperation(input);

    expect(first.status).toBe("success");
    expect(first.audits).toHaveLength(2);
    expect(first.records.get("learner-1")?.tags).toEqual(["stuck"]);
    expect(replay.replayed).toBe(true);
    expect(replay.audits).toHaveLength(2);
  });

  it("supports confirmed bulk status changes with role enforcement", () => {
    const preview = previewBulkOperation({
      idempotencyKey: "bulk-status",
      learnerIds: ["learner-1", "learner-2"],
      action: {
        type: "update-status",
        status: "paused",
        reason: "Course temporarily paused",
      },
    });
    const result = confirmBulkOperation({
      preview,
      confirmed: true,
      records: new Map([
        ["learner-1", learner("learner-1")],
        ["learner-2", learner("learner-2")],
      ]),
      actorId: "assistant-1",
      actorRole: "assistant",
      occurredAt: now,
      store: new Map(),
    });
    expect(result.status).toBe("success");
    expect(
      [...result.records.values()].every((record) => record.status === "paused"),
    ).toBe(true);
  });
});
