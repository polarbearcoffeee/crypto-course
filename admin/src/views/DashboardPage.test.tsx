import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "./DashboardPage";

describe("DashboardPage", () => {
  it("顯示資料來源狀態並避免把示範資料冒充正式資料", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("示範資料｜尚未連接正式資料庫")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "營運總覽" })).toBeInTheDocument();
    expect(screen.getByText("UID 待審")).toBeInTheDocument();
  });
});
