export type LearnerStatus =
  | "active"
  | "paused"
  | "blocked"
  | "deleted-pending-retention";

export type LearnerOperationsRole =
  | "owner"
  | "lead-teacher"
  | "assistant"
  | "content-editor"
  | "analyst";

export type LearnerNote = Readonly<{
  noteId: string;
  authorId: string;
  body: string;
  createdAt: string;
}>;

export type ControlledTag = Readonly<{
  tagId: string;
  label: string;
  active: boolean;
}>;

export type LearnerStatusChange = Readonly<{
  from: LearnerStatus;
  to: LearnerStatus;
  reason: string;
  actorId: string;
  changedAt: string;
}>;

export type LearnerOperationsRecord = Readonly<{
  learnerId: string;
  status: LearnerStatus;
  tags: readonly string[];
  followUpOwnerId?: string;
  notes: readonly LearnerNote[];
  statusHistory: readonly LearnerStatusChange[];
  updatedAt: string;
}>;

export type LearnerOperationsAudit = Readonly<{
  action:
    | "note-added"
    | "tag-added"
    | "follow-up-owner-assigned"
    | "status-changed";
  learnerId: string;
  actorId: string;
  reason: string;
  occurredAt: string;
  before: unknown;
  after: unknown;
}>;

export type LearnerAccessPolicy = Readonly<{
  canSignIn: boolean;
  canReadLearningContent: boolean;
  canWriteLearningProgress: boolean;
}>;

const accessByStatus: Record<LearnerStatus, LearnerAccessPolicy> = {
  active: {
    canSignIn: true,
    canReadLearningContent: true,
    canWriteLearningProgress: true,
  },
  paused: {
    canSignIn: true,
    canReadLearningContent: true,
    canWriteLearningProgress: false,
  },
  blocked: {
    canSignIn: false,
    canReadLearningContent: false,
    canWriteLearningProgress: false,
  },
  "deleted-pending-retention": {
    canSignIn: false,
    canReadLearningContent: false,
    canWriteLearningProgress: false,
  },
};

export function getLearnerAccessPolicy(
  status: LearnerStatus,
): LearnerAccessPolicy {
  return accessByStatus[status];
}

export function addLearnerNote(input: {
  record: LearnerOperationsRecord;
  noteId: string;
  authorId: string;
  body: string;
  occurredAt: string;
}): {
  record: LearnerOperationsRecord;
  audit: LearnerOperationsAudit;
} {
  requireText(input.noteId, "Note ID");
  requireText(input.authorId, "Author");
  const body = requireText(input.body, "Note");
  requireTimestamp(input.occurredAt);

  if (input.record.notes.some((note) => note.noteId === input.noteId)) {
    throw new Error("Note ID already exists.");
  }

  const note: LearnerNote = {
    noteId: input.noteId,
    authorId: input.authorId,
    body,
    createdAt: input.occurredAt,
  };
  const notes = [...input.record.notes, note].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  return {
    record: { ...input.record, notes, updatedAt: input.occurredAt },
    audit: {
      action: "note-added",
      learnerId: input.record.learnerId,
      actorId: input.authorId,
      reason: "Internal follow-up note added.",
      occurredAt: input.occurredAt,
      before: null,
      after: note,
    },
  };
}

export function addControlledTag(input: {
  record: LearnerOperationsRecord;
  tagId: string;
  catalog: readonly ControlledTag[];
  actorId: string;
  occurredAt: string;
}): {
  record: LearnerOperationsRecord;
  audit?: LearnerOperationsAudit;
} {
  requireTimestamp(input.occurredAt);
  const tag = input.catalog.find((candidate) => candidate.tagId === input.tagId);
  if (!tag?.active) throw new Error("Tag is not active in the controlled catalog.");
  if (input.record.tags.includes(input.tagId)) return { record: input.record };

  return {
    record: {
      ...input.record,
      tags: [...input.record.tags, input.tagId],
      updatedAt: input.occurredAt,
    },
    audit: {
      action: "tag-added",
      learnerId: input.record.learnerId,
      actorId: input.actorId,
      reason: `Controlled tag added: ${tag.label}`,
      occurredAt: input.occurredAt,
      before: input.record.tags,
      after: [...input.record.tags, input.tagId],
    },
  };
}

export function assignFollowUpOwner(input: {
  record: LearnerOperationsRecord;
  ownerId: string;
  actorId: string;
  occurredAt: string;
}): {
  record: LearnerOperationsRecord;
  audit?: LearnerOperationsAudit;
} {
  const ownerId = requireText(input.ownerId, "Follow-up owner");
  requireTimestamp(input.occurredAt);
  if (ownerId === input.record.followUpOwnerId) return { record: input.record };

  return {
    record: {
      ...input.record,
      followUpOwnerId: ownerId,
      updatedAt: input.occurredAt,
    },
    audit: {
      action: "follow-up-owner-assigned",
      learnerId: input.record.learnerId,
      actorId: input.actorId,
      reason: "Follow-up owner assigned.",
      occurredAt: input.occurredAt,
      before: input.record.followUpOwnerId ?? null,
      after: ownerId,
    },
  };
}

export function changeLearnerStatus(input: {
  record: LearnerOperationsRecord;
  status: LearnerStatus;
  reason: string;
  actorId: string;
  actorRole: LearnerOperationsRole;
  occurredAt: string;
}): {
  record: LearnerOperationsRecord;
  audit?: LearnerOperationsAudit;
} {
  const reason = requireText(input.reason, "Status change reason");
  requireTimestamp(input.occurredAt);
  assertStatusPermission(input.actorRole, input.status);
  if (input.status === input.record.status) return { record: input.record };

  const change: LearnerStatusChange = {
    from: input.record.status,
    to: input.status,
    reason,
    actorId: input.actorId,
    changedAt: input.occurredAt,
  };
  return {
    record: {
      ...input.record,
      status: input.status,
      statusHistory: [...input.record.statusHistory, change],
      updatedAt: input.occurredAt,
    },
    audit: {
      action: "status-changed",
      learnerId: input.record.learnerId,
      actorId: input.actorId,
      reason,
      occurredAt: input.occurredAt,
      before: {
        status: input.record.status,
        access: getLearnerAccessPolicy(input.record.status),
      },
      after: {
        status: input.status,
        access: getLearnerAccessPolicy(input.status),
      },
    },
  };
}

function assertStatusPermission(
  role: LearnerOperationsRole,
  status: LearnerStatus,
) {
  if (!["owner", "lead-teacher", "assistant"].includes(role)) {
    throw new Error("Role cannot update learner status.");
  }
  if (
    (status === "blocked" || status === "deleted-pending-retention") &&
    role !== "owner" &&
    role !== "lead-teacher"
  ) {
    throw new Error("Only an owner or lead teacher can apply this status.");
  }
}

export type BulkLearnerAction =
  | { type: "add-tag"; tagId: string; catalog: readonly ControlledTag[] }
  | { type: "assign-owner"; ownerId: string }
  | { type: "update-status"; status: LearnerStatus; reason: string };

export type BulkOperationPreview = Readonly<{
  idempotencyKey: string;
  learnerIds: readonly string[];
  action: BulkLearnerAction;
  selectedCount: number;
  duplicateSelectionCount: number;
  requiresConfirmation: true;
}>;

export type BulkOperationResult = Readonly<{
  idempotencyKey: string;
  status: "success" | "partial" | "failure";
  successCount: number;
  failureCount: number;
  records: ReadonlyMap<string, LearnerOperationsRecord>;
  audits: readonly LearnerOperationsAudit[];
  failures: readonly Readonly<{
    learnerId: string;
    reason: string;
  }>[];
  replayed: boolean;
}>;

export type BulkOperationStore = Map<string, BulkOperationResult>;

export function previewBulkOperation(input: {
  idempotencyKey: string;
  learnerIds: readonly string[];
  action: BulkLearnerAction;
}): BulkOperationPreview {
  const idempotencyKey = requireText(input.idempotencyKey, "Idempotency key");
  if (input.learnerIds.length === 0) {
    throw new Error("At least one learner must be selected.");
  }
  validateBulkAction(input.action);
  const learnerIds = [...new Set(input.learnerIds)];
  return {
    idempotencyKey,
    learnerIds,
    action: input.action,
    selectedCount: learnerIds.length,
    duplicateSelectionCount: input.learnerIds.length - learnerIds.length,
    requiresConfirmation: true,
  };
}

export function confirmBulkOperation(input: {
  preview: BulkOperationPreview;
  confirmed: boolean;
  records: ReadonlyMap<string, LearnerOperationsRecord>;
  actorId: string;
  actorRole: LearnerOperationsRole;
  occurredAt: string;
  store: BulkOperationStore;
  canManage?: (record: LearnerOperationsRecord) => boolean;
}): BulkOperationResult {
  if (!input.confirmed) throw new Error("Bulk operation requires confirmation.");
  const replay = input.store.get(input.preview.idempotencyKey);
  if (replay) return { ...replay, replayed: true };

  const records = new Map(input.records);
  const audits: LearnerOperationsAudit[] = [];
  const failures: { learnerId: string; reason: string }[] = [];
  let successCount = 0;

  for (const learnerId of input.preview.learnerIds) {
    const current = records.get(learnerId);
    if (!current) {
      failures.push({ learnerId, reason: "Learner not found." });
      continue;
    }
    if (input.canManage && !input.canManage(current)) {
      failures.push({ learnerId, reason: "Not authorized for learner." });
      continue;
    }
    try {
      const outcome = applyBulkAction({
        record: current,
        action: input.preview.action,
        actorId: input.actorId,
        actorRole: input.actorRole,
        occurredAt: input.occurredAt,
      });
      records.set(learnerId, outcome.record);
      if (outcome.audit) audits.push(outcome.audit);
      successCount += 1;
    } catch (error) {
      failures.push({
        learnerId,
        reason: error instanceof Error ? error.message : "Unknown failure.",
      });
    }
  }

  const result: BulkOperationResult = {
    idempotencyKey: input.preview.idempotencyKey,
    status:
      failures.length === 0
        ? "success"
        : successCount === 0
          ? "failure"
          : "partial",
    successCount,
    failureCount: failures.length,
    records,
    audits,
    failures,
    replayed: false,
  };
  input.store.set(input.preview.idempotencyKey, result);
  return result;
}

function applyBulkAction(input: {
  record: LearnerOperationsRecord;
  action: BulkLearnerAction;
  actorId: string;
  actorRole: LearnerOperationsRole;
  occurredAt: string;
}) {
  switch (input.action.type) {
    case "add-tag":
      return addControlledTag({
        record: input.record,
        tagId: input.action.tagId,
        catalog: input.action.catalog,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
      });
    case "assign-owner":
      return assignFollowUpOwner({
        record: input.record,
        ownerId: input.action.ownerId,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
      });
    case "update-status":
      return changeLearnerStatus({
        record: input.record,
        status: input.action.status,
        reason: input.action.reason,
        actorId: input.actorId,
        actorRole: input.actorRole,
        occurredAt: input.occurredAt,
      });
  }
}

function validateBulkAction(action: BulkLearnerAction) {
  switch (action.type) {
    case "add-tag":
      if (!action.catalog.some((tag) => tag.tagId === action.tagId && tag.active)) {
        throw new Error("Tag is not active in the controlled catalog.");
      }
      break;
    case "assign-owner":
      requireText(action.ownerId, "Follow-up owner");
      break;
    case "update-status":
      requireText(action.reason, "Status change reason");
      break;
  }
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requireTimestamp(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error("A valid timestamp is required.");
  }
}
