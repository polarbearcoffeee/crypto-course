import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDemoLessons } from "../data/legacyAdminDemo";
import { CurriculumPage } from "./CurriculumPage";

describe("CurriculumPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("marks an edited lesson as dirty and clears it after saving the draft", () => {
    const { container } = render(<CurriculumPage />);
    const titleInput = container.querySelector(".editor-panel input");
    const saveButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".editor-actions button"),
    ).find((button) => button.textContent?.includes("儲存草稿"));

    expect(titleInput).not.toBeNull();
    expect(saveButton).not.toBeNull();
    expect(container.querySelector(".unsaved")).not.toBeInTheDocument();

    fireEvent.change(titleInput!, { target: { value: "Updated lesson title" } });

    expect(container.querySelector(".unsaved")).toBeInTheDocument();

    fireEvent.click(saveButton!);

    expect(container.querySelector(".unsaved")).not.toBeInTheDocument();
    expect(readDemoLessons()[0]?.title).toBe("Updated lesson title");
  });

  it("shows all six imported legacy lessons and their quiz editor", () => {
    const { container, getByRole } = render(<CurriculumPage />);

    expect(container.querySelectorAll(".lesson-row")).toHaveLength(6);
    fireEvent.click(getByRole("button", { name: /第 6 課：新手必懂的 10 個幣圈術語/ }));

    expect(container.querySelectorAll(".quiz-question")).toHaveLength(3);
    expect(container.querySelector(".editor-panel")).toHaveTextContent("HODL 的意思最接近");
  });
});
