import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "../ui/AdminShell";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    activeOptions: _activeOptions,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    to: string;
    activeOptions?: unknown;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={to}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
}));

afterEach(cleanup);

describe("後台殼層可存取性", () => {
  it("提供具名稱的主要導覽與主要內容語義區域", () => {
    render(
      <AdminShell>
        <h1>測試頁面</h1>
      </AdminShell>,
    );

    expect(screen.getByRole("complementary", { name: "主要導覽" })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("測試頁面");
  });

  it("導覽連結與行動版選單按鈕均可取得鍵盤焦點", () => {
    render(<AdminShell>內容</AdminShell>);

    const menuButton = screen.getByRole("button", { name: "開啟導覽" });
    const firstNavigationLink = screen.getByRole("link", { name: "營運總覽" });

    menuButton.focus();
    expect(menuButton).toHaveFocus();

    firstNavigationLink.focus();
    expect(firstNavigationLink).toHaveFocus();
    expect(firstNavigationLink).toHaveAttribute("href", "/");
  });

  it("可展開、收合行動版選單，選擇導覽後會自動關閉", () => {
    render(<AdminShell>內容</AdminShell>);

    const menuButton = screen.getByRole("button", { name: "開啟導覽" });
    expect(menuButton).toHaveAttribute("aria-controls", "primary-navigation");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    expect(screen.getByRole("button", { name: "關閉導覽" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("complementary", { name: "主要導覽" })).toHaveStyle({
      display: "flex",
    });

    fireEvent.click(screen.getByRole("link", { name: "學員營運" }));
    expect(screen.getByRole("button", { name: "開啟導覽" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
