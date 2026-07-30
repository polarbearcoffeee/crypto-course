import { describe, expect, it } from "vitest";
import {
  addQuizQuestion,
  getCurrentPublishedVersion,
  publishCurriculumVersion,
  removeQuizQuestion,
  reorderLessons,
  transitionCurriculumVersion,
  updateLesson,
  updateQuizQuestion,
  type CurriculumLifecycleState,
  type CurriculumLifecycleVersion,
  type LessonEditorModel,
  type QuizQuestion,
} from "./curriculumLifecycle";

const question: QuizQuestion = {
  questionId: "q-1",
  prompt: "What limits a loss?",
  options: [
    { optionId: "a", text: "A stop loss" },
    { optionId: "b", text: "Leverage" },
    { optionId: "c", text: "Hope" },
    { optionId: "d", text: "A larger position" },
  ],
  correctOptionIndex: 0,
  explanation: "A stop loss defines the exit before entry.",
};

const lesson = (lessonId = "lesson-1"): LessonEditorModel => ({
  lessonId,
  title: "Risk foundations",
  summary: "Plan downside before entering a trade.",
  estimatedMinutes: 12,
  learningObjectives: ["Calculate risk per trade"],
  contentPoints: ["Set invalidation", "Size the position"],
  videoUrl: "https://media.example.com/risk",
  videoRequired: true,
  quizQuestions: [question],
  passingScore: 80,
  status: "active",
  versionNote: "Initial structured lesson",
});

const version = (
  versionId: string,
  status: CurriculumLifecycleVersion["status"] = "draft",
): CurriculumLifecycleVersion => ({
  versionId,
  courseId: "beginner",
  status,
  lessons: [lesson()],
  authorId: "editor-1",
  updatedAt: "2026-07-30T01:00:00Z",
});

describe("curriculum lifecycle", () => {
  it("moves through review, schedule, publication and archive", () => {
    const reviewed = transitionCurriculumVersion(version("v2"), {
      type: "submit-review",
      actorId: "editor-1",
      at: "2026-07-30T02:00:00Z",
    });
    const scheduled = transitionCurriculumVersion(reviewed, {
      type: "schedule",
      actorId: "lead-1",
      at: "2026-07-30T03:00:00Z",
      scheduledFor: "2026-07-31T03:00:00+08:00",
    });
    const published = transitionCurriculumVersion(scheduled, {
      type: "publish",
      actorId: "publisher-1",
      at: "2026-07-31T03:00:00+08:00",
    });
    const archived = transitionCurriculumVersion(published, {
      type: "archive",
      actorId: "publisher-1",
      at: "2026-08-01T03:00:00+08:00",
    });

    expect(reviewed.status).toBe("in-review");
    expect(scheduled).toMatchObject({
      status: "scheduled",
      reviewerId: "lead-1",
      scheduledFor: "2026-07-31T03:00:00+08:00",
    });
    expect(published).toMatchObject({
      status: "published",
      publisherId: "publisher-1",
      scheduledFor: undefined,
    });
    expect(archived).toMatchObject({
      status: "archived",
      archivedAt: "2026-08-01T03:00:00+08:00",
    });
    expect(version("v2").status).toBe("draft");
  });

  it("rejects invalid transitions and schedule times", () => {
    expect(() =>
      transitionCurriculumVersion(version("v1"), {
        type: "publish",
        actorId: "publisher-1",
        at: "2026-07-30T02:00:00Z",
      }),
    ).toThrow("Cannot publish");

    const reviewed = version("v2", "in-review");
    expect(() =>
      transitionCurriculumVersion(reviewed, {
        type: "schedule",
        actorId: "lead-1",
        at: "2026-07-30T02:00:00Z",
        scheduledFor: "2026-07-30T01:00:00Z",
      }),
    ).toThrow("future time");
  });

  it("atomically advances the current pointer and archives the old version", () => {
    const state: CurriculumLifecycleState = {
      versions: {
        v1: {
          ...version("v1", "published"),
          publisherId: "publisher-0",
          publishedAt: "2026-07-29T01:00:00Z",
        },
        v2: version("v2", "in-review"),
      },
      currentPublishedVersionId: "v1",
    };

    const next = publishCurriculumVersion(
      state,
      "v2",
      "publisher-1",
      "2026-07-30T04:00:00Z",
    );

    expect(next.currentPublishedVersionId).toBe("v2");
    expect(next.versions.v1.status).toBe("archived");
    expect(getCurrentPublishedVersion(next)).toMatchObject({
      versionId: "v2",
      status: "published",
    });
    expect(state.versions.v1.status).toBe("published");
    expect(state.currentPublishedVersionId).toBe("v1");
  });

  it("detects an invalid current-version pointer", () => {
    expect(() =>
      getCurrentPublishedVersion({
        versions: { v1: version("v1", "draft") },
        currentPublishedVersionId: "v1",
      }),
    ).toThrow("Current pointer");
  });
});

describe("structured lesson and quiz editor", () => {
  it("contains every required editor field", () => {
    expect(lesson()).toMatchObject({
      title: "Risk foundations",
      summary: "Plan downside before entering a trade.",
      estimatedMinutes: 12,
      learningObjectives: ["Calculate risk per trade"],
      contentPoints: ["Set invalidation", "Size the position"],
      videoUrl: "https://media.example.com/risk",
      videoRequired: true,
      passingScore: 80,
      status: "active",
      versionNote: "Initial structured lesson",
      quizQuestions: [
        expect.objectContaining({
          prompt: "What limits a loss?",
          correctOptionIndex: 0,
          explanation: "A stop loss defines the exit before entry.",
        }),
      ],
    });
  });

  it("updates lesson fields without mutating the original", () => {
    const original = lesson();
    const updated = updateLesson(original, {
      title: "Updated risk foundations",
      prerequisiteLessonId: "intro",
      learningObjectives: ["Define risk", "Calculate position size"],
    });

    expect(updated).toMatchObject({
      title: "Updated risk foundations",
      prerequisiteLessonId: "intro",
      learningObjectives: ["Define risk", "Calculate position size"],
    });
    expect(original.title).toBe("Risk foundations");
    expect(original.prerequisiteLessonId).toBeUndefined();
    expect(original.learningObjectives).toEqual(["Calculate risk per trade"]);
  });

  it("adds, edits and removes quiz questions immutably", () => {
    const original = lesson();
    const second = { ...question, questionId: "q-2", prompt: "Second question" };
    const added = addQuizQuestion(original, second);
    const edited = updateQuizQuestion(added, "q-2", {
      prompt: "Updated second question",
      explanation: "Updated explanation",
    });
    const removed = removeQuizQuestion(edited, "q-1");

    expect(original.quizQuestions).toHaveLength(1);
    expect(added.quizQuestions).toHaveLength(2);
    expect(edited.quizQuestions[1]).toMatchObject({
      prompt: "Updated second question",
      explanation: "Updated explanation",
    });
    expect(added.quizQuestions[1].prompt).toBe("Second question");
    expect(removed.quizQuestions.map((item) => item.questionId)).toEqual(["q-2"]);
  });

  it("rejects duplicate and unknown question IDs", () => {
    expect(() => addQuizQuestion(lesson(), question)).toThrow(
      "Duplicate question ID",
    );
    expect(() => updateQuizQuestion(lesson(), "missing", {})).toThrow(
      "Unknown question ID",
    );
    expect(() => removeQuizQuestion(lesson(), "missing")).toThrow(
      "Unknown question ID",
    );
  });

  it("reorders every draft lesson exactly once without mutation", () => {
    const original: CurriculumLifecycleVersion = {
      ...version("v1"),
      lessons: [lesson("lesson-1"), lesson("lesson-2")],
    };
    const reordered = reorderLessons(original, ["lesson-2", "lesson-1"]);

    expect(reordered.lessons.map((item) => item.lessonId)).toEqual([
      "lesson-2",
      "lesson-1",
    ]);
    expect(original.lessons.map((item) => item.lessonId)).toEqual([
      "lesson-1",
      "lesson-2",
    ]);
    expect(() => reorderLessons(original, ["lesson-1", "lesson-1"])).toThrow(
      "exactly once",
    );
    expect(() =>
      reorderLessons({ ...original, status: "in-review" }, [
        "lesson-2",
        "lesson-1",
      ]),
    ).toThrow("only be reordered in a draft");
  });
});
