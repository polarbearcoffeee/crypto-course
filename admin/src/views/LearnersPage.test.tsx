import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LearnersPage } from "./LearnersPage";

describe("LearnersPage", () => {
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
});
