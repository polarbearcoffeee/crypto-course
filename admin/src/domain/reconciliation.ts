export type DailySummary = Readonly<{
  reportingDate: string;
  eventCount: number;
  xpEntryCount: number;
  xpAmount: number;
}>;

export type ReconciliationEvent = Readonly<{
  eventId: string;
  occurredAt: string;
  receivedAt: string;
}>;

export type ReconciliationXpEntry = Readonly<{
  ledgerEntryId: string;
  amount: number;
  createdAt: string;
}>;

export type ReconciliationDifference = Readonly<{
  field: "eventCount" | "xpEntryCount" | "xpAmount";
  expected: number;
  actual: number;
}>;

export type SummaryLedgerMismatchIssue = Readonly<{
  issueId: string;
  type: "summary-ledger-mismatch";
  recordId: string;
  severity: "high";
  state: "open";
  sample: Readonly<{
    differences: readonly ReconciliationDifference[];
  }>;
  detectedAt: string;
}>;

export type DailyReconciliationResult = Readonly<{
  reportingDate: string;
  status: "matched" | "mismatch";
  actual: Omit<DailySummary, "reportingDate">;
  differences: readonly ReconciliationDifference[];
  issue?: SummaryLedgerMismatchIssue;
}>;

function reportingDateInTaipei(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function reconcileDailySummary(
  summary: DailySummary,
  events: readonly ReconciliationEvent[],
  xpEntries: readonly ReconciliationXpEntry[],
  detectedAt: string,
): DailyReconciliationResult {
  const dailyEvents = events.filter(
    (event) => reportingDateInTaipei(event.occurredAt) === summary.reportingDate,
  );
  const dailyXpEntries = xpEntries.filter(
    (entry) => reportingDateInTaipei(entry.createdAt) === summary.reportingDate,
  );
  const actual = {
    eventCount: dailyEvents.length,
    xpEntryCount: dailyXpEntries.length,
    xpAmount: dailyXpEntries.reduce((total, entry) => total + entry.amount, 0),
  };
  const differences = (
    ["eventCount", "xpEntryCount", "xpAmount"] as const
  ).flatMap((field) =>
    summary[field] === actual[field]
      ? []
      : [{ field, expected: summary[field], actual: actual[field] }],
  );

  if (differences.length === 0) {
    return {
      reportingDate: summary.reportingDate,
      status: "matched",
      actual,
      differences,
    };
  }

  return {
    reportingDate: summary.reportingDate,
    status: "mismatch",
    actual,
    differences,
    issue: {
      issueId: `summary-ledger-mismatch:${summary.reportingDate}`,
      type: "summary-ledger-mismatch",
      recordId: summary.reportingDate,
      severity: "high",
      state: "open",
      sample: { differences },
      detectedAt,
    },
  };
}

export type ReconciliationStatus = "matched" | "mismatch" | "not-run";

export type SystemHealth = Readonly<{
  status: "healthy" | "degraded" | "critical";
  ingestion: Readonly<{
    lagSeconds: number;
    failureCount: number;
    status: "healthy" | "delayed" | "failed";
  }>;
  reconciliation: Readonly<{
    status: ReconciliationStatus;
  }>;
}>;

export function buildSystemHealth(input: {
  now: string;
  latestReceivedAt: string;
  ingestionFailureCount: number;
  reconciliationStatus: ReconciliationStatus;
  delayedAfterSeconds?: number;
}): SystemHealth {
  const lagSeconds = Math.max(
    0,
    Math.floor(
      (new Date(input.now).getTime() - new Date(input.latestReceivedAt).getTime()) /
        1_000,
    ),
  );
  const delayedAfterSeconds = input.delayedAfterSeconds ?? 300;
  const ingestionStatus =
    input.ingestionFailureCount > 0
      ? "failed"
      : lagSeconds > delayedAfterSeconds
        ? "delayed"
        : "healthy";
  const status =
    ingestionStatus === "failed" || input.reconciliationStatus === "mismatch"
      ? "critical"
      : ingestionStatus === "delayed" ||
          input.reconciliationStatus === "not-run"
        ? "degraded"
        : "healthy";

  return {
    status,
    ingestion: {
      lagSeconds,
      failureCount: input.ingestionFailureCount,
      status: ingestionStatus,
    },
    reconciliation: {
      status: input.reconciliationStatus,
    },
  };
}
