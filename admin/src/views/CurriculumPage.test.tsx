import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurriculumPage } from "./CurriculumPage";

describe("CurriculumPage", () => {
  it("marks an edited lesson as dirty and clears it after saving the draft", () => {
    const { container } = render(<CurriculumPage />);
    const titleInput = container.querySelector(".editor-panel input");
    const saveButton = container.querySelector(".editor-actions .button.primary");

    expect(titleInput).not.toBeNull();
    expect(saveButton).not.toBeNull();
    expect(container.querySelector(".unsaved")).not.toBeInTheDocument();

    fireEvent.change(titleInput!, { target: { value: "Updated lesson title" } });

    expect(container.querySelector(".unsaved")).toBeInTheDocument();

    fireEvent.click(saveButton!);

    expect(container.querySelector(".unsaved")).not.toBeInTheDocument();
  });
});
