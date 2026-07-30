import { describe, expect, it } from "vitest";
import {
  compareCurricula,
  createPublishedVersion,
  reloadAfterConflict,
  saveConflictAsNewDraft,
  saveDraftOptimistically,
  validateCurriculumForPublish,
  type CurriculumContent,
  type CurriculumDraft,
} from "./curriculum";

const validContent: CurriculumContent = {
  courseId: "beginner",
  title: "交易基礎",
  lessons: [
    {
      lessonId: "lesson-1",
      title: "風險管理",
      objectives: ["理解停損"],
      content: "先決定風險，再決定部位。",
      videoRequired: true,
      videoUrl: "https://media.example.com/risk",
      passingThreshold: 80,
      questions: [
        {
          questionId: "question-1",
          prompt: "下單前先做什麼？",
          options: ["決定風險", "追價", "加槓桿", "忽略停損"],
          correctOptionIndex: 0,
          explanation: "風險必須在下單前決定。",
        },
      ],
    },
    {
      lessonId: "lesson-2",
      title: "建立交易計畫",
      objectives: ["完成交易計畫"],
      content: "記錄進場、停損與離場條件。",
      videoRequired: false,
      passingThreshold: 75,
      prerequisiteLessonId: "lesson-1",
      questions: [
        {
          questionId: "question-2",
          prompt: "交易計畫需要什麼？",
          options: ["離場條件", "感覺", "口號", "預言"],
          correctOptionIndex: 0,
          explanation: "可執行的離場條件才能控制風險。",
        },
      ],
    },
  ],
};

const draft = (revision: number, content = validContent): CurriculumDraft => ({
  draftId: "draft-1",
  revision,
  editorId: "editor-1",
  updatedAt: `2026-07-30T0${revision}:00:00Z`,
  content,
});

describe("curriculum publication validation", () => {
  it("accepts complete curriculum content", () => {
    expect(
      validateCurriculumForPublish(validContent, ["media.example.com"]),
    ).toEqual([]);
  });

  it("returns exact paths for every invalid publication field", () => {
    const invalid: CurriculumContent = {
      ...structuredClone(validContent),
      title: " ",
    };
    invalid.lessons[0] = {
      ...invalid.lessons[0],
      title: "",
      objectives: [],
      content: "",
      videoUrl: "http://evil.example/video",
      prerequisiteLessonId: "lesson-2",
      passingThreshold: 101,
      questions: [
        {
          questionId: "bad-question",
          prompt: "",
          options: ["one", "", "three"],
          correctOptionIndex: 3,
          explanation: "",
        },
      ],
    };

    const issues = validateCurriculumForPublish(invalid, [
      "media.example.com",
    ]);
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "title",
        "lessons[0].title",
        "lessons[0].objectives",
        "lessons[0].content",
        "lessons[0].videoUrl",
        "lessons[0].prerequisiteLessonId",
        "lessons[0].passingThreshold",
        "lessons[0].questions[0].prompt",
        "lessons[0].questions[0].options",
        "lessons[0].questions[0].correctOptionIndex",
        "lessons[0].questions[0].explanation",
      ]),
    );
  });
});

describe("optimistic curriculum draft saves", () => {
  it("increments the revision when the expected revision is current", () => {
    const result = saveDraftOptimistically(draft(2), draft(2), 2);
    expect(result.status).toBe("saved");
    if (result.status === "saved") expect(result.draft.revision).toBe(3);
  });

  it("preserves the current draft and offers all conflict actions", () => {
    const current = draft(3);
    const incoming = draft(2, {
      ...structuredClone(validContent),
      title: "編輯者 B 的標題",
    });
    const result = saveDraftOptimistically(current, incoming, 2);

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") return;
    expect(result.actions).toEqual(["reload", "compare", "save-as-new"]);
    expect(reloadAfterConflict(result)).toEqual(current);
    expect(result.differences).toContainEqual(
      expect.objectContaining({ path: "title", kind: "changed" }),
    );
    expect(saveConflictAsNewDraft(result, "draft-2")).toMatchObject({
      draftId: "draft-2",
      revision: 1,
      content: { title: "編輯者 B 的標題" },
    });
    expect(current.content.title).toBe("交易基礎");
  });
});

describe("immutable published curriculum versions", () => {
  it("records metadata, SHA-256 checksum and a complete comparison", async () => {
    const v1 = await createPublishedVersion({
      versionId: "v1",
      note: "初版",
      publisherId: "publisher-1",
      publishedAt: "2026-07-30T01:00:00Z",
      content: validContent,
    });
    const nextContent = structuredClone(validContent);
    nextContent.title = "交易紀律基礎";
    nextContent.lessons.reverse();
    nextContent.lessons[0].videoUrl = "https://media.example.com/plan-v2";
    nextContent.lessons[0].questions[0].options[0] = "明確離場條件";

    const v2 = await createPublishedVersion({
      versionId: "v2",
      previous: v1,
      note: "更新教材與題目",
      publisherId: "publisher-2",
      publishedAt: "2026-07-30T02:00:00Z",
      content: nextContent,
    });

    expect(v2).toMatchObject({
      previousVersionId: "v1",
      note: "更新教材與題目",
      publisherId: "publisher-2",
    });
    expect(v2.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(v2.diffFromPrevious).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "title", kind: "changed" }),
        expect.objectContaining({ path: "lessons", kind: "reordered" }),
        expect.objectContaining({
          path: "lessons[lessonId=lesson-2].videoUrl",
          kind: "added",
        }),
        expect.objectContaining({
          path: "lessons[lessonId=lesson-2].questions[questionId=question-2].options[0]",
          kind: "changed",
        }),
      ]),
    );
    expect(Object.isFrozen(v2)).toBe(true);
    expect(Object.isFrozen(v2.content.lessons)).toBe(true);
  });

  it("reports added and removed lessons, questions and answer changes", () => {
    const next = structuredClone(validContent);
    next.lessons.shift();
    next.lessons[0].questions.push({
      questionId: "question-3",
      prompt: "新增題目",
      options: ["A", "B", "C", "D"],
      correctOptionIndex: 1,
      explanation: "B",
    });

    const differences = compareCurricula(validContent, next);
    expect(differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "lessons[lessonId=lesson-1]",
          kind: "removed",
        }),
        expect.objectContaining({
          path: "lessons[lessonId=lesson-2].questions[questionId=question-3]",
          kind: "added",
        }),
      ]),
    );
  });
});
