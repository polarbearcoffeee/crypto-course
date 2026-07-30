import { describe, expect, it } from "vitest";

import {
  buildSystemHealth,
  reconcileDailySummary,
  type ReconciliationEvent,
  type ReconciliationXpEntry,
} from "./reconciliation";

const events: ReconciliationEvent[] = [
  {
    eventId: "event-1",
    occurredAt: "2026-07-30T15:59:59.000Z",
    receivedAt: "2026-07-30T16:00:01.000Z",
  },
  {
    eventId: "event-next-day",
    occurredAt: "2026-07-30T16:00:00.000Z",
    receivedAt: "2026-07-30T16:00:02.000Z",
  },
];

const xpEntries: ReconciliationXpEntry[] = [
  {
    ledgerEntryId: "xp-1",
    amount: 10,
    createdAt: "2026-07-30T15:30:00.000Z",
  },
];

describe("daily summary reconciliation", () => {
  it("matches a summary against event and XP ledgers using Taipei dates", () => {
    const result = reconcileDailySummary(
      {
        reportingDate: "2026-07-30",
        eventCount: 1,
        xpEntryCount: 1,
        xpAmount: 10,
      },
      events,
      xpEntries,
      "2026-07-31T02:00:00.000+08:00",
    );

    expect(result.status).toBe("matched");
    expect(result.differences).toEqual([]);
    expect(result.issue).toBeUndefined();
  });

  it("creates an open data-quality issue for mismatched totals", () => {
    const result = reconcileDailySummary(
      {
        reportingDate: "2026-07-30",
        eventCount: 2,
        xpEntryCount: 1,
        xpAmount: 20,
      },
      events,
      xpEntries,
      "2026-07-31T02:00:00.000+08:00",
    );

    expect(result.status).toBe("mismatch");
    expect(result.differences).toEqual([
      { field: "eventCount", expected: 2, actual: 1 },
      { field: "xpAmount", expected: 20, actual: 10 },
    ]);
    expect(result.issue).toMatchObject({
      issueId: "summary-ledger-mismatch:2026-07-30",
      type: "summary-ledger-mismatch",
      recordId: "2026-07-30",
      severity: "high",
      state: "open",
    });
  });
});

describe("system health", () => {
  it("reports healthy ingestion and reconciliation", () => {
    expect(
      buildSystemHealth({
        now: "2026-07-30T10:05:00.000Z",
        latestReceivedAt: "2026-07-30T10:04:00.000Z",
        ingestionFailureCount: 0,
        reconciliationStatus: "matched",
      }),
    ).toEqual({
      status: "healthy",
      ingestion: {
        lagSeconds: 60,
        failureCount: 0,
        status: "healthy",
      },
      reconciliation: { status: "matched" },
    });
  });

  it("reports delayed ingestion as degraded", () => {
    const health = buildSystemHealth({
      now: "2026-07-30T10:10:01.000Z",
      latestReceivedAt: "2026-07-30T10:00:00.000Z",
      ingestionFailureCount: 0,
      reconciliationStatus: "matched",
    });

    expect(health.status).toBe("degraded");
    expect(health.ingestion).toMatchObject({
      lagSeconds: 601,
      status: "delayed",
    });
  });

  it("reports ingestion failures as critical", () => {
    const health = buildSystemHealth({
      now: "2026-07-30T10:05:00.000Z",
      latestReceivedAt: "2026-07-30T10:04:00.000Z",
      ingestionFailureCount: 2,
      reconciliationStatus: "matched",
    });

    expect(health.status).toBe("critical");
    expect(health.ingestion).toMatchObject({
      failureCount: 2,
      status: "failed",
    });
  });

  it("reports reconciliation mismatches as critical", () => {
    const health = buildSystemHealth({
      now: "2026-07-30T10:05:00.000Z",
      latestReceivedAt: "2026-07-30T10:04:00.000Z",
      ingestionFailureCount: 0,
      reconciliationStatus: "mismatch",
    });

    expect(health.status).toBe("critical");
    expect(health.reconciliation.status).toBe("mismatch");
  });
});
