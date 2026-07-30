import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { readRuntimeConfig } from "../config/env";
import { getMetricDefinition, metricIds } from "../domain/metrics";
import { can, permissions, roles } from "../domain/permissions";
import {
  reconcileDailySummary,
  type ReconciliationEvent,
  type ReconciliationXpEntry,
} from "../domain/reconciliation";
import { auditLogSchema } from "../domain/schemas";
import { SettingsPage } from "../views/SettingsPage";

afterEach(cleanup);

describe("release acceptance quality gates", () => {
  it("keeps the reporting and access-control contracts complete", () => {
    expect(roles).toHaveLength(5);
    expect(permissions).toHaveLength(11);
    expect(permissions.every((permission) => can("owner", permission))).toBe(true);

    expect(metricIds).toHaveLength(11);
    for (const metricId of metricIds) {
      const definition = getMetricDefinition(metricId);

      expect(definition.id).toBe(metricId);
      expect(definition.source.length).toBeGreaterThan(0);
      expect(definition.timezone).toBe("Asia/Taipei");
      expect(definition.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("has no automatically detectable accessibility violations on governance", async () => {
    const { container } = render(createElement(SettingsPage));
    const result = await axe(container, {
      rules: {
        // jsdom cannot calculate real rendered colors; contrast stays a manual browser check.
        "color-contrast": { enabled: false },
      },
    });

    expect(result.violations).toEqual([]);
  });

  it("reconciles a representative daily batch within the local smoke budget", () => {
    const recordCount = 2_500;
    const events: ReconciliationEvent[] = Array.from(
      { length: recordCount },
      (_, index) => ({
        eventId: `event-${index}`,
        occurredAt: "2026-07-30T00:00:00.000Z",
        receivedAt: "2026-07-30T00:00:01.000Z",
      }),
    );
    const xpEntries: ReconciliationXpEntry[] = Array.from(
      { length: recordCount },
      (_, index) => ({
        ledgerEntryId: `xp-${index}`,
        amount: 5,
        createdAt: "2026-07-30T00:00:02.000Z",
      }),
    );

    const startedAt = performance.now();
    const result = reconcileDailySummary(
      {
        reportingDate: "2026-07-30",
        eventCount: recordCount,
        xpEntryCount: recordCount,
        xpAmount: recordCount * 5,
      },
      events,
      xpEntries,
      "2026-07-31T02:00:00.000+08:00",
    );
    const durationMs = performance.now() - startedAt;

    expect(result.status).toBe("matched");
    expect(durationMs).toBeLessThan(2_000);
  });

  it("opens a high-severity issue when summary and ledgers disagree", () => {
    const result = reconcileDailySummary(
      {
        reportingDate: "2026-07-30",
        eventCount: 2,
        xpEntryCount: 1,
        xpAmount: 20,
      },
      [
        {
          eventId: "event-1",
          occurredAt: "2026-07-30T00:00:00.000Z",
          receivedAt: "2026-07-30T00:00:01.000Z",
        },
      ],
      [
        {
          ledgerEntryId: "xp-1",
          amount: 10,
          createdAt: "2026-07-30T00:00:02.000Z",
        },
      ],
      "2026-07-31T02:00:00.000+08:00",
    );

    expect(result.status).toBe("mismatch");
    expect(result.issue).toMatchObject({
      type: "summary-ledger-mismatch",
      severity: "high",
      state: "open",
    });
  });

  it("enforces the automated portion of the release security checklist", () => {
    expect(() =>
      readRuntimeConfig({
        VITE_APP_ENV: "production",
        VITE_DATA_SOURCE: "demo",
      }),
    ).toThrow("Production cannot use demo data or a demo fallback.");

    for (const role of roles.filter((role) => role !== "owner")) {
      expect(can(role, "administrator.manage")).toBe(false);
      expect(can(role, "settings.manage")).toBe(false);
    }

    const auditWithoutReason = auditLogSchema.safeParse({
      auditId: "audit-1",
      actorId: "owner-1",
      action: "settings.update",
      targetType: "settings",
      targetId: "settings-v2",
      before: {},
      after: {},
      reason: " ",
      requestId: "request-1",
      result: "success",
      occurredAt: "2026-07-30T10:00:00.000+08:00",
    });

    expect(auditWithoutReason.success).toBe(false);
  });
});
