import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  CurriculumPreview,
  type CurriculumPreviewState,
  type CurriculumPreviewViewport,
} from "./CurriculumPreview";

const lesson = {
  title: "風險管理入門",
  description: "學習如何設定停損與控制單筆交易風險。",
  question: "單筆交易建議承擔多少風險？",
  options: ["1% 至 2%", "10%", "25%", "不需要限制"],
};

const states: readonly CurriculumPreviewState[] = [
  "locked",
  "unlocked",
  "failed",
  "passed",
  "empty",
  "error",
];

const viewports: readonly CurriculumPreviewViewport[] = ["desktop", "mobile"];

afterEach(cleanup);

describe("CurriculumPreview", () => {
  viewports.forEach((viewport) => {
    states.forEach((state) => {
      it(`renders the ${state} state with ${viewport} preview semantics`, () => {
        render(
          <CurriculumPreview
            state={state}
            viewport={viewport}
            lesson={lesson}
            errorMessage="測試用載入錯誤"
          />,
        );

        const label = viewport === "desktop" ? "桌機課程預覽" : "手機課程預覽";
        const preview = screen.getByRole("region", { name: label });

        expect(preview).toHaveAttribute("data-preview-only", "true");
        expect(preview).toHaveAttribute("data-state", state);
        expect(preview).toHaveAttribute("data-viewport", viewport);
        expect(preview).toHaveTextContent(viewport === "desktop" ? "桌機模式" : "手機模式");
        expect(preview).toHaveTextContent("唯讀");
        expect(screen.queryByRole("button", { name: /發布/ })).not.toBeInTheDocument();
      });
    });
  });

  it.each([
    ["locked", "課程尚未解鎖"],
    ["unlocked", "可以開始學習"],
    ["failed", "測驗尚未通過"],
    ["passed", "本單元已通過"],
    ["empty", "尚無可預覽內容"],
    ["error", "測試用載入錯誤"],
  ] as const)("shows the expected copy for %s", (state, expectedCopy) => {
    render(
      <CurriculumPreview
        state={state}
        viewport="desktop"
        lesson={lesson}
        errorMessage="測試用載入錯誤"
      />,
    );

    expect(screen.getByText(expectedCopy)).toBeInTheDocument();
  });

  it("does not expose quiz content while the lesson is locked", () => {
    render(<CurriculumPreview state="locked" viewport="desktop" lesson={lesson} />);

    expect(screen.queryByText(lesson.question)).not.toBeInTheDocument();
  });
});
