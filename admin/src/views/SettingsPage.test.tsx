import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
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
});
