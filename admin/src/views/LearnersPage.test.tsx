import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDemoLearners } from "../data/legacyAdminDemo";
import { LearnersPage } from "./LearnersPage";

describe("LearnersPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("filters learners and shows a recoverable empty state", () => {
    const { container } = render(<LearnersPage />);
    const searchInput = container.querySelector(".search-field input");

    expect(searchInput).not.toBeNull();
    expect(container.querySelectorAll(".data-table tbody tr").length).toBeGreaterThan(0);

    fireEvent.change(searchInput!, {
      target: { value: "no-learner-can-match-this-query" },
    });

    expect(container.querySelectorAll(".data-table tbody tr")).toHaveLength(0);
    const emptyState = container.querySelector(".empty-state");
    expect(emptyState).toBeInTheDocument();

    fireEvent.click(emptyState!.querySelector("button")!);

    expect(searchInput).toHaveValue("");
    expect(container.querySelectorAll(".data-table tbody tr").length).toBeGreaterThan(0);
    expect(container.querySelector(".empty-state")).not.toBeInTheDocument();
  });

  it("updates UID status and saves an internal follow-up note", () => {
    const { container, getByRole, getByPlaceholderText } = render(<LearnersPage />);
    fireEvent.click(container.querySelector(".data-table tbody tr")!);

    fireEvent.click(getByRole("button", { name: "核准" }));
    expect(readDemoLearners()[0]?.uidStatus).toBe("已驗證");

    fireEvent.change(getByPlaceholderText("輸入助教追蹤內容"), {
      target: { value: "明天再次確認學習進度" },
    });
    fireEvent.click(getByRole("button", { name: /新增備註/ }));

    expect(readDemoLearners()[0]?.notes[0]).toContain("明天再次確認學習進度");
  });
});
