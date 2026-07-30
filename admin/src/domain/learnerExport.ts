import { can, type Role } from "./permissions";
import {
  learnerSchema,
  privateLearnerSchema,
  type AuditLog,
  type Learner,
  type PrivateLearner,
} from "./schemas";

export const LEARNER_EXPORT_HEADERS = [
  "learner_id",
  "nickname",
  "uid",
  "source",
  "registration_time",
  "current_status",
  "exported_at",
  "filter_summary",
] as const;

export type LearnerExportRow = Readonly<{
  learner: unknown;
  privateLearner?: unknown;
}>;

export type LearnerExportRequest = Readonly<{
  actorId: string;
  role: Role;
  reason: string;
  exportedAt: string;
  auditId: string;
  requestId: string;
  filters: Readonly<Record<string, string | readonly string[]>>;
  rows: readonly LearnerExportRow[];
}>;

export type RejectedExportRow = Readonly<{
  rowIndex: number;
  learnerId?: string;
  reason: string;
}>;

export type LearnerExportResult = Readonly<{
  csv: string;
  exportedCount: number;
  rejectedRows: readonly RejectedExportRow[];
  filterSummary: string;
  audit: AuditLog;
}>;

export type BulkSelection = ReadonlySet<string>;

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function uidForRole(role: Role, uid: string | undefined): string {
  if (!uid) {
    return "";
  }
  if (can(role, "learner.pii.view")) {
    return uid;
  }
  return uid.length <= 4 ? "****" : `****${uid.slice(-4)}`;
}

function extractLearnerId(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "learnerId" in value &&
    typeof value.learnerId === "string"
  ) {
    return value.learnerId;
  }
  return undefined;
}

export function summarizeExportFilters(
  filters: Readonly<Record<string, string | readonly string[]>>,
): string {
  const entries = Object.entries(filters)
    .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== ""))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      const normalized = Array.isArray(value) ? [...value].sort().join("|") : value;
      return `${key}=${normalized}`;
    });

  return entries.length === 0 ? "all learners" : entries.join("; ");
}

export function canExportFullUid(role: Role): boolean {
  return can(role, "learner.export") && can(role, "learner.pii.view");
}

export function createBulkSelection(
  learnerIds: readonly string[] = [],
): BulkSelection {
  return new Set(learnerIds);
}

export function updateBulkSelection(
  current: BulkSelection,
  learnerIds: readonly string[],
  selected: boolean,
): BulkSelection {
  const next = new Set(current);
  for (const learnerId of learnerIds) {
    if (selected) {
      next.add(learnerId);
    } else {
      next.delete(learnerId);
    }
  }
  return next;
}

export function assertLearnerWriteAllowed(
  learner: Pick<Learner, "learnerId" | "status">,
  operation: "learning-event" | "profile-update" | "admin-status-update",
): void {
  if (learner.status === "blocked" && operation !== "admin-status-update") {
    throw new Error(`Learner ${learner.learnerId} is blocked from writes.`);
  }
  if (
    learner.status === "deleted-pending-retention" &&
    operation !== "admin-status-update"
  ) {
    throw new Error(
      `Learner ${learner.learnerId} is pending deletion and cannot be written.`,
    );
  }
}

function parseRow(
  row: LearnerExportRow,
):
  | { learner: Learner; privateLearner?: PrivateLearner }
  | { reason: string; learnerId?: string } {
  const learnerResult = learnerSchema.safeParse(row.learner);
  if (!learnerResult.success) {
    return {
      learnerId: extractLearnerId(row.learner),
      reason: "Malformed learner row.",
    };
  }

  if (row.privateLearner === undefined) {
    return { learner: learnerResult.data };
  }

  const privateResult = privateLearnerSchema.safeParse(row.privateLearner);
  if (
    !privateResult.success ||
    privateResult.data.learnerId !== learnerResult.data.learnerId
  ) {
    return {
      learnerId: learnerResult.data.learnerId,
      reason: "Malformed or mismatched private learner row.",
    };
  }

  return {
    learner: learnerResult.data,
    privateLearner: privateResult.data,
  };
}

export function exportLearnersToCsv(
  request: LearnerExportRequest,
): LearnerExportResult {
  if (!can(request.role, "learner.export")) {
    throw new Error(`Role ${request.role} cannot export learners.`);
  }
  if (request.reason.trim() === "") {
    throw new Error("Learner exports require a reason.");
  }

  const filterSummary = summarizeExportFilters(request.filters);
  const rejectedRows: RejectedExportRow[] = [];
  const exportedRows: string[] = [];

  request.rows.forEach((row, rowIndex) => {
    const parsed = parseRow(row);
    if ("reason" in parsed) {
      rejectedRows.push({
        rowIndex,
        learnerId: parsed.learnerId,
        reason: parsed.reason,
      });
      return;
    }

    const values = [
      parsed.learner.learnerId,
      parsed.learner.nickname,
      uidForRole(request.role, parsed.privateLearner?.uidCurrent),
      parsed.learner.sourceFirst,
      parsed.learner.createdAt,
      parsed.learner.status,
      request.exportedAt,
      filterSummary,
    ];
    exportedRows.push(values.map(csvCell).join(","));
  });

  const exportedCount = exportedRows.length;
  const audit: AuditLog = {
    auditId: request.auditId,
    actorId: request.actorId,
    action: "learner.export",
    targetType: "learner-export",
    targetId: request.auditId,
    before: null,
    after: {
      exportedCount,
      rejectedCount: rejectedRows.length,
      filterSummary,
      uidAccess: canExportFullUid(request.role) ? "full" : "masked",
      headers: [...LEARNER_EXPORT_HEADERS],
    },
    reason: request.reason.trim(),
    requestId: request.requestId,
    result: rejectedRows.length === 0 ? "success" : "partial",
    occurredAt: request.exportedAt,
  };

  const header = LEARNER_EXPORT_HEADERS.map(csvCell).join(",");
  return {
    csv: `\uFEFF${[header, ...exportedRows].join("\r\n")}\r\n`,
    exportedCount,
    rejectedRows,
    filterSummary,
    audit,
  };
}
