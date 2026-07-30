import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAdministrator } from "../data/legacyAdminDemo";
import { DemoAdminGate } from "./DemoAdminGate";

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
  }) => <a href={to} onClick={onClick} {...props}>{children}</a>,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
}));

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(cleanup);

describe("DemoAdminGate", () => {
  it("rejects an incorrect password and admits the documented demo owner", () => {
    render(<DemoAdminGate><h1>管理內容</h1></DemoAdminGate>);

    const password = screen.getByLabelText("展示密碼");
    fireEvent.change(password, { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /登入新後台/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("不正確");
    expect(screen.queryByText("管理內容")).not.toBeInTheDocument();

    fireEvent.change(password, { target: { value: demoAdministrator.password } });
    fireEvent.click(screen.getByRole("button", { name: /登入新後台/ }));

    expect(screen.getByText("管理內容")).toBeInTheDocument();
    expect(screen.getByText(demoAdministrator.displayName)).toBeInTheDocument();
  });

  it("clears the display session on logout", () => {
    render(<DemoAdminGate><h1>管理內容</h1></DemoAdminGate>);
    fireEvent.change(screen.getByLabelText("展示密碼"), {
      target: { value: demoAdministrator.password },
    });
    fireEvent.click(screen.getByRole("button", { name: /登入新後台/ }));

    fireEvent.click(screen.getByRole("button", { name: "登出" }));

    expect(screen.getByRole("heading", { name: "管理員登入" })).toBeInTheDocument();
    expect(screen.queryByText("管理內容")).not.toBeInTheDocument();
  });
});
