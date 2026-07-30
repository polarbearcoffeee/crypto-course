import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardData } from "../data/dashboard";
import type { DashboardComponentState } from "../domain/dashboardResilience";
import { DashboardPage } from "./DashboardPage";

afterEach(cleanup);

const dashboardData: DashboardData = {
  asOf: "2026-07-30T10:00:00.000Z",
  metrics: [
    {
      id: "activation",
      label: "學習啟動率",
      value: 0,
      unit: "percent",
      comparison: 0,
      numerator: 0,
      denominator: 0,
      freshness: "2026-07-30 18:00",
    },
    {
      id: "uidPending",
      label: "UID 待審核",
      value: 1,
      unit: "count",
      comparison: -1,
      numerator: 1,
      denominator: 10,
      freshness: "2026-07-30 18:00",
    },
  ],
  funnel: [
    { name: "尚未追蹤推薦落地", value: 0, rate: 0 },
    { name: "註冊完成", value: 10, rate: 100 },
  ],
  queues: [
    { label: "卡關學員", count: 2, severity: "attention" },
  ],
};

function renderDashboard(
  props: Parameters<typeof DashboardPage>[0] = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage dataOverride={dashboardData} {...props} />
    </QueryClientProvider>,
  );
}

describe("DashboardPage regression states", () => {
  it.each([
    ["loading", { status: "loading" }, false],
    [
      "ready",
      {
        status: "ready",
        data: dashboardData.metrics,
        updatedAt: "2026-07-30T10:00:00.000Z",
      },
      true,
    ],
    [
      "empty",
      {
        status: "empty",
        updatedAt: "2026-07-30T10:00:00.000Z",
        message: "沒有符合條件的資料",
      },
      false,
    ],
    [
      "partial",
      {
        status: "partial",
        data: dashboardData.metrics,
        updatedAt: "2026-07-30T10:00:00.000Z",
        completeThrough: "2026-07-30T09:00:00.000Z",
        message: "部分來源尚未完成",
      },
      true,
    ],
    [
      "stale",
      {
        status: "stale",
        data: dashboardData.metrics,
        updatedAt: "2026-07-30T10:00:00.000Z",
        lastSuccessfulAt: "2026-07-30T10:00:00.000Z",
        message: "彙總服務逾時",
      },
      true,
    ],
    [
      "error",
      {
        status: "error",
        message: "彙總服務無法使用",
        retryable: true,
      },
      false,
    ],
  ] as const)(
    "renders the %s component state without discarding valid prior data",
    (expectedStatus, metricsState, showsData) => {
      const { container } = renderDashboard({
        sectionStates: {
          metrics:
            metricsState as DashboardComponentState<
              DashboardData["metrics"]
            >,
        },
      });
      const component = container.querySelector(
        "section[aria-labelledby='metrics-title'] .dashboard-component",
      );

      expect(component).toHaveAttribute("data-state", expectedStatus);
      const activationCard = screen.queryByRole("button", {
        name: "查看學習啟動率學員名單",
      });
      if (showsData) {
        expect(activationCard).toBeInTheDocument();
      } else {
        expect(activationCard).not.toBeInTheDocument();
      }
    },
  );

  it("renders the zero-denominator state instead of 0%", () => {
    renderDashboard();
    const activation = screen.getByRole("button", {
      name: "查看學習啟動率學員名單",
    });

    expect(within(activation).getByText("—")).toBeInTheDocument();
    expect(
      within(activation).getByText(/沒有符合條件的母數/),
    ).toBeInTheDocument();
    expect({
      className: activation.className,
      label: activation.getAttribute("aria-label"),
      note: within(activation).getByText(/沒有符合條件的母數/)
        .textContent,
      value: within(activation).getByText("—").textContent,
    }).toMatchInlineSnapshot(`
      {
        "className": "metric",
        "label": "查看學習啟動率學員名單",
        "note": "沒有符合條件的母數 · 2026-07-30 18:00",
        "value": "—",
      }
    `);
    expect(
      screen.getByRole("button", {
        name: "查看尚未追蹤推薦落地學員名單",
      }),
    ).toHaveTextContent("尚未追蹤");
  });

  it("retains last-known values and exposes stale timestamp plus retry", () => {
    const onRetry = vi.fn();
    renderDashboard({
      onRetry,
      sectionStates: {
        metrics: {
          status: "stale",
          data: dashboardData.metrics,
          updatedAt: "2026-07-30T10:00:00.000Z",
          lastSuccessfulAt: "2026-07-30T10:00:00.000Z",
          message: "彙總服務逾時",
        },
      },
    });

    expect(screen.getByText("顯示上次資料")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /最後成功更新時間 2026-07-30T10:00:00.000Z/,
      ),
    ).toHaveLength(2);
    const banner = screen.getByText("顯示上次資料").closest("div");
    expect({
      className: banner?.className,
      text: banner?.textContent,
    }).toMatchInlineSnapshot(`
      {
        "className": "dashboard-state-banner stale",
        "text": "顯示上次資料彙總服務逾時，最後成功更新時間 2026-07-30T10:00:00.000Z重試",
      }
    `);
    expect(
      screen.getByRole("button", { name: "查看學習啟動率學員名單" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重試" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("masks the UID drill-down for a role without permission", () => {
    const onDrilldown = vi.fn();
    renderDashboard({ canViewUidDetails: false, onDrilldown });

    const uidCard = screen.getByRole("button", {
      name: "UID 待審核，權限受限",
    });
    expect(uidCard).toBeDisabled();
    expect({
      disabled: uidCard.hasAttribute("disabled"),
      label: uidCard.getAttribute("aria-label"),
      text: uidCard.textContent,
    }).toMatchInlineSnapshot(`
      {
        "disabled": true,
        "label": "UID 待審核，權限受限",
        "text": "UID 待審核1%11 / 10 · 2026-07-30 18:00",
      }
    `);
    fireEvent.click(uidCard);
    expect(onDrilldown).not.toHaveBeenCalled();
  });
});

describe.each([
  ["desktop", 1440],
  ["tablet", 900],
  ["mobile", 390],
] as const)("DashboardPage %s accessibility", (_label, width) => {
  it("keeps every learner drill-down keyboard operable", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
    const onDrilldown = vi.fn();
    renderDashboard({ onDrilldown });

    const buttons = screen.getAllByRole("button", {
      name: /查看.+學員名單/,
    });
    expect(buttons.length).toBe(5);

    for (const button of buttons) {
      button.focus();
      expect(button).toHaveFocus();
      fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
      fireEvent.click(button);
    }

    expect(onDrilldown).toHaveBeenCalledTimes(buttons.length);
    expect(
      onDrilldown.mock.calls.map(([event]) => event.displayedCount),
    ).toEqual([0, 1, 0, 10, 2]);
  });
});
