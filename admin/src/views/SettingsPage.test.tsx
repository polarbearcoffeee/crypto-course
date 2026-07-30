import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLegacyPinDisabled, readLegacyPin } from "../data/legacyAdminDemo";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("switches the system-governance content when a navigation tab is selected", () => {
    const { container } = render(<SettingsPage />);
    const tabs = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".settings-nav button"),
    );

    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(tabs[0]).toHaveClass("active");
    expect(tabs[1]).not.toHaveClass("active");

    const initialHeading = container.querySelector(".settings-content h2")?.textContent;
    fireEvent.click(tabs[1]);

    expect(tabs[0]).not.toHaveClass("active");
    expect(tabs[1]).toHaveClass("active");
    expect(container.querySelector(".settings-content h2")?.textContent).not.toBe(initialHeading);
  });

  it("keeps the old shared PIN only as a browser-local migration tool", () => {
    const { getByRole, getByLabelText } = render(<SettingsPage />);
    fireEvent.click(getByRole("button", { name: "舊 PIN 遷移" }));

    const pinInput = getByLabelText("舊站共用 PIN（展示值）");
    fireEvent.change(pinInput, { target: { value: "5678" } });
    fireEvent.click(getByRole("button", { name: "儲存展示值" }));
    fireEvent.click(getByRole("button", { name: "標記舊 PIN 已停用" }));

    expect(readLegacyPin()).toBe("5678");
    expect(isLegacyPinDisabled()).toBe(true);
  });
});
