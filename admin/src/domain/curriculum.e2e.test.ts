import { describe, expect, it } from "vitest";
import {
  createPublishedVersion,
  saveDraftOptimistically,
  validateCurriculumForPublish,
  type CurriculumContent,
  type CurriculumDraft,
} from "./curriculum";
import {
  getCurrentPublishedVersion,
  publishCurriculumVersion,
  type CurriculumLifecycleState,
  type CurriculumLifecycleVersion,
} from "./curriculumLifecycle";
import {
  executeScheduledPublication,
  rollbackPublishedCurriculum,
  schedulePublication,
} from "./publishing";

const allowedMediaHosts = ["media.example.com"];

const content = (title = "Risk basics"): CurriculumContent => ({
  courseId: "course-1",
  title,
  lessons: [
    {
      lessonId: "lesson-1",
      title: "Position sizing",
      objectives: ["Limit downside"],
      content: "Define the maximum loss before entering a trade.",
      videoRequired: true,
      videoUrl: "https://media.example.com/risk",
      passingThreshold: 80,
      questions: [
        {
          questionId: "question-1",
          prompt: "What should be defined before entry?",
          options: ["Risk", "Profit", "Volume", "News"],
          correctOptionIndex: 0,
          explanation: "Risk is controlled before entering a trade.",
        },
      ],
    },
  ],
});

const lifecycleVersion = (
  versionId: string,
  status: CurriculumLifecycleVersion["status"],
): CurriculumLifecycleVersion => ({
  versionId,
  courseId: "course-1",
  status,
  lessons: [
    {
      lessonId: "lesson-1",
      title: "Position sizing",
      summary: "Define downside before entering a trade.",
      estimatedMinutes: 12,
      learningObjectives: ["Limit downside"],
      contentPoints: ["Set invalidation", "Calculate position size"],
      videoUrl: "https://media.example.com/risk",
      videoRequired: true,
      quizQuestions: [
        {
          questionId: "question-1",
          prompt: "What should be defined before entry?",
          options: [
            { optionId: "a", text: "Risk" },
            { optionId: "b", text: "Profit" },
            { optionId: "c", text: "Volume" },
            { optionId: "d", text: "News" },
          ],
          correctOptionIndex: 0,
          explanation: "Risk is controlled before entering a trade.",
        },
      ],
      passingScore: 80,
      status: "active",
      versionNote: `Version ${versionId}`,
    },
  ],
  authorId: "editor-1",
  updatedAt: "2026-07-30T01:00:00Z",
  ...(status === "published"
    ? {
        publisherId: "publisher-1",
        publishedAt: "2026-07-30T01:00:00Z",
      }
    : {}),
});

const lifecycleState = (): CurriculumLifecycleState => ({
  versions: {
    v1: lifecycleVersion("v1", "published"),
    v2: lifecycleVersion("v2", "in-review"),
  },
  currentPublishedVersionId: "v1",
});

const draft = (
  revision: number,
  curriculum = content(),
): CurriculumDraft => ({
  draftId: "draft-1",
  revision,
  editorId: "editor-1",
  updatedAt: "2026-07-30T01:00:00Z",
  content: curriculum,
});

describe("curriculum publishing end-to-end", () => {
  it("blocks an invalid publication and keeps the current version live", () => {
    const state = lifecycleState();
    const invalid = content();
    invalid.lessons[0].videoUrl = "https://blocked.example.com/risk";

    const issues = validateCurriculumForPublish(invalid, allowedMediaHosts);

    expect(issues).toContainEqual(
      expect.objectContaining({
        path: "lessons[0].videoUrl",
        code: "invalid-media-url",
      }),
    );
    expect(getCurrentPublishedVersion(state)?.versionId).toBe("v1");
    expect(state.versions.v2.status).toBe("in-review");
  });

  it("validates and atomically publishes a valid reviewed version", () => {
    const state = lifecycleState();

    expect(
      validateCurriculumForPublish(content("Risk basics v2"), allowedMediaHosts),
    ).toEqual([]);

    const published = publishCurriculumVersion(
      state,
      "v2",
      "publisher-2",
      "2026-07-30T02:00:00Z",
    );

    expect(getCurrentPublishedVersion(published)).toMatchObject({
      versionId: "v2",
      status: "published",
      publisherId: "publisher-2",
    });
    expect(published.versions.v1.status).toBe("archived");
    expect(state.currentPublishedVersionId).toBe("v1");
    expect(state.versions.v1.status).toBe("published");
  });

  it("reports a stale draft conflict without changing published content", () => {
    const state = lifecycleState();
    const incoming = draft(2, content("Unsaved editor version"));

    const result = saveDraftOptimistically(draft(3), incoming, 2);

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") return;
    expect(result.actions).toEqual(["reload", "compare", "save-as-new"]);
    expect(result.differences).toContainEqual(
      expect.objectContaining({ path: "title", kind: "changed" }),
    );
    expect(getCurrentPublishedVersion(state)?.versionId).toBe("v1");
  });

  it("restores prior content as a new version and preserves history", async () => {
    const v1 = await createPublishedVersion({
      versionId: "v1",
      note: "Initial publication",
      publisherId: "publisher-1",
      publishedAt: "2026-07-30T01:00:00Z",
      content: content(),
    });
    const v2 = await createPublishedVersion({
      versionId: "v2",
      previous: v1,
      note: "Updated publication",
      publisherId: "publisher-2",
      publishedAt: "2026-07-30T02:00:00Z",
      content: content("Incorrect update"),
    });
    const history = [v1, v2];

    const rollback = await rollbackPublishedCurriculum({
      history,
      liveVersionId: "v2",
      restoreVersionId: "v1",
      newVersionId: "v3",
      reason: "Restore verified safety guidance",
      publisherId: "publisher-3",
      publishedAt: "2026-07-30T03:00:00Z",
    });

    expect(rollback.version).toMatchObject({
      versionId: "v3",
      previousVersionId: "v2",
      content: { title: "Risk basics" },
    });
    expect(rollback.restoredFromVersionId).toBe("v1");
    expect(history.map((version) => version.versionId)).toEqual(["v1", "v2"]);
    expect(v2.content.title).toBe("Incorrect update");
  });

  it("leaves the live version unchanged when scheduled final validation fails", () => {
    const scheduled = schedulePublication({
      scheduleId: "schedule-1",
      versionId: "v2",
      content: content("Scheduled update"),
      scheduledFor: "2026-07-31T09:00:00+08:00",
      timezone: "Asia/Taipei",
      createdBy: "publisher-2",
      now: "2026-07-30T00:00:00Z",
      allowedMediaHosts,
    });
    scheduled.content.lessons[0].videoUrl =
      "https://blocked.example.com/risk";

    const execution = executeScheduledPublication({
      schedule: scheduled,
      currentLiveVersionId: "v1",
      now: "2026-07-31T02:00:00Z",
      allowedMediaHosts,
    });

    expect(execution).toMatchObject({
      liveVersionId: "v1",
      schedule: { status: "failed" },
      alert: {
        code: "final-validation-failed",
        action: "review-scheduled-version",
      },
    });
  });

  it("isolates a learner's current-version snapshot from a later publish", () => {
    const state = lifecycleState();
    const learnerCurrentVersion = getCurrentPublishedVersion(state);

    const published = publishCurriculumVersion(
      state,
      "v2",
      "publisher-2",
      "2026-07-30T02:00:00Z",
    );

    expect(learnerCurrentVersion).toMatchObject({
      versionId: "v1",
      status: "published",
    });
    expect(getCurrentPublishedVersion(state)?.versionId).toBe("v1");
    expect(getCurrentPublishedVersion(published)?.versionId).toBe("v2");
    expect(learnerCurrentVersion).not.toBe(
      getCurrentPublishedVersion(published),
    );
  });
});
