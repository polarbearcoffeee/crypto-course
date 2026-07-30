import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformLinksPage } from "./PlatformLinksPage";

describe("PlatformLinksPage", () => {
  it("collects public, admin, GitHub and acceptance links in one page", () => {
    render(<PlatformLinksPage />);

    expect(screen.getByRole("link", { name: /課程前台/ })).toHaveAttribute(
      "href",
      "https://polarbearcoffeee.github.io/crypto-course/",
    );
    expect(screen.getByRole("link", { name: /新後台儀表板/ })).toHaveAttribute(
      "href",
      "https://polarbearcoffeee.github.io/crypto-course/admin/",
    );
    expect(screen.getByRole("link", { name: /學員營運/ })).toHaveAttribute(
      "href",
      "/crypto-course/admin/#/learners",
    );
    expect(screen.getByRole("link", { name: /GitHub 程式碼倉庫/ })).toHaveAttribute(
      "href",
      "https://github.com/polarbearcoffeee/crypto-course",
    );
    expect(screen.getByRole("heading", { name: "網站地圖" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /營運後台/ })).toHaveAttribute(
      "href",
      "https://polarbearcoffeee.github.io/crypto-course/admin/",
    );
    const siteMap = screen.getByRole("region", { name: "網站地圖" });
    expect(within(siteMap).getByText("闖關地圖")).toBeInTheDocument();
    expect(within(siteMap).getByText("系統治理")).toBeInTheDocument();
  });
});
