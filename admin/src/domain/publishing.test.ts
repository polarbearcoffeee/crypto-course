import { describe, expect, it } from "vitest";
import {
  assessDraftInterruption,
  buildContentHealthQueue,
  cancelScheduledPublication,
  createDirtyDraftGuard,
  executeScheduledPublication,
  markDraftDirty,
  previewQuizPolicyImpact,
  receiveRemoteDraft,
  recordDraftSaveFailure,
  rollbackPublishedCurriculum,
  schedulePublication,
  selectQuizVersionPolicy,
} from "./publishing";
import {
  createPublishedVersion,
  type CurriculumContent,
  type CurriculumDraft,
} from "./curriculum";

const content: CurriculumContent = {
  courseId: "course-1",
  title: "Risk basics",
  lessons: [
    {
      lessonId: "lesson-1",
      title: "Position sizing",
      objectives: ["Limit downside"],
      content: "Risk only a small percentage per trade.",
      videoRequired: true,
      videoUrl: "https://media.example.com/risk",
      passingThreshold: 80,
      questions: [
        {
          questionId: "question-1",
          prompt: "What should be limited?",
          options: ["Risk", "Study", "Sleep", "Notes"],
          correctOptionIndex: 0,
          explanation: "Risk is controlled before entry.",
        },
      ],
    },
  ],
};

const draft = (revision: number, title = content.title): CurriculumDraft => ({
  draftId: "draft-1",
  revision,
  editorId: "editor-1",
  updatedAt: "2026-07-30T01:00:00Z",
  content: { ...structuredClone(content), title },
});

describe("dirty draft protection", () => {
  it.each(["internal-navigation", "refresh", "close"] as const)(
    "blocks %s while preserving unsaved work",
    (interruption) => {
      const guard = markDraftDirty(
        createDirtyDraftGuard(draft(1)),
        draft(1, "Local edit"),
      );
      expect(assessDraftInterruption(guard, interruption)).toMatchObject({
        blocked: true,
        requiresConfirmation: true,
        preserveLocalDraft: true,
        reason: "unsaved-changes",
      });
    },
  );

  it("preserves a failed save and offers retry", () => {
    const guard = recordDraftSaveFailure(
      markDraftDirty(createDirtyDraftGuard(draft(1)), draft(1, "Local edit")),
      "network unavailable",
    );
    expect(assessDraftInterruption(guard, "save-failure")).toEqual({
      blocked: true,
      requiresConfirmation: false,
      preserveLocalDraft: true,
      reason: "save-failed",
      actions: ["stay", "retry-save", "save-as-new"],
    });
  });

  it("does not overwrite local work when a newer remote draft arrives", () => {
    const local = draft(2, "Unsaved local title");
    const guard = receiveRemoteDraft(
      markDraftDirty(createDirtyDraftGuard(draft(2)), local),
      draft(3, "Remote title"),
    );
    expect(guard.localDraft.content.title).toBe("Unsaved local title");
    expect(guard.remoteDraft?.content.title).toBe("Remote title");
    expect(assessDraftInterruption(guard, "remote-update")).toMatchObject({
      blocked: true,
      preserveLocalDraft: true,
      reason: "remote-update",
      actions: ["stay", "compare", "save-as-new"],
    });
  });
});

describe("quiz policy affected learner preview", () => {
  const learners = [
    {
      learnerId: "passed",
      completedLesson: true,
      passedQuizVersion: "quiz-v1",
    },
    { learnerId: "started", completedLesson: false },
    { learnerId: "new", completedLesson: false },
  ];

  it("previews each policy before it is selected", () => {
    expect(
      previewQuizPolicyImpact("preserve-previous-pass", learners),
    ).toMatchObject({
      affectedLearnerCount: 2,
      previouslyPassedLearnersAffected: 0,
    });
    expect(
      previewQuizPolicyImpact("incomplete-learners-only", learners),
    ).toMatchObject({ affectedLearnerCount: 2 });
    expect(previewQuizPolicyImpact("retake-all", learners)).toMatchObject({
      affectedLearnerCount: 3,
      previouslyPassedLearnersAffected: 1,
    });
  });

  it("creates an auditable policy selection with the preview", () => {
    expect(
      selectQuizVersionPolicy({
        lessonId: "lesson-1",
        fromQuizVersion: "quiz-v1",
        toQuizVersion: "quiz-v2",
        policy: "retake-all",
        selectedBy: "publisher-1",
        selectedAt: "2026-07-30T02:00:00Z",
        learners,
      }),
    ).toMatchObject({
      lessonId: "lesson-1",
      policy: "retake-all",
      selectedBy: "publisher-1",
      preview: { affectedLearnerCount: 3 },
    });
  });
});

describe("rollback publication", () => {
  it("restores old content as a new version without deleting history", async () => {
    const v1 = await createPublishedVersion({
      versionId: "v1",
      note: "Initial",
      publisherId: "publisher-1",
      publishedAt: "2026-07-30T01:00:00Z",
      content,
    });
    const v2Content = { ...structuredClone(content), title: "Updated title" };
    const v2 = await createPublishedVersion({
      versionId: "v2",
      previous: v1,
      note: "Update",
      publisherId: "publisher-2",
      publishedAt: "2026-07-30T02:00:00Z",
      content: v2Content,
    });
    const history = [v1, v2];

    const result = await rollbackPublishedCurriculum({
      history,
      liveVersionId: "v2",
      restoreVersionId: "v1",
      newVersionId: "v3",
      reason: "Incorrect safety guidance",
      publisherId: "publisher-3",
      publishedAt: "2026-07-30T03:00:00Z",
    });

    expect(result.version).toMatchObject({
      versionId: "v3",
      previousVersionId: "v2",
      content: { title: "Risk basics" },
    });
    expect(result.rollbackReason).toBe("Incorrect safety guidance");
    expect(history.map((version) => version.versionId)).toEqual(["v1", "v2"]);
  });
});

describe("scheduled publishing", () => {
  const scheduled = () =>
    schedulePublication({
      scheduleId: "schedule-1",
      versionId: "v2",
      content,
      scheduledFor: "2026-07-31T09:00:00+08:00",
      timezone: "Asia/Taipei",
      createdBy: "publisher-1",
      now: "2026-07-30T00:00:00Z",
      allowedMediaHosts: ["media.example.com"],
    });

  it("requires an offset, supports cancellation, and blocks cancelled execution", () => {
    expect(() =>
      schedulePublication({
        scheduleId: "schedule-without-offset",
        versionId: "v2",
        content,
        timezone: "Asia/Taipei",
        createdBy: "publisher-1",
        now: "2026-07-30T00:00:00Z",
        allowedMediaHosts: ["media.example.com"],
        scheduledFor: "2026-07-31T09:00:00",
      }),
    ).toThrow("timezone offset");
    const cancelled = cancelScheduledPublication(scheduled(), "publisher-2");
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancelledBy: "publisher-2",
    });
    expect(() =>
      executeScheduledPublication({
        schedule: cancelled,
        currentLiveVersionId: "v1",
        now: "2026-07-31T02:00:00Z",
        allowedMediaHosts: ["media.example.com"],
      }),
    ).toThrow("pending schedule");
  });

  it("runs final validation and leaves the current version live on failure", () => {
    const pending = scheduled();
    pending.content.lessons[0].videoUrl = "https://blocked.example/video";
    const result = executeScheduledPublication({
      schedule: pending,
      currentLiveVersionId: "v1",
      now: "2026-07-31T02:00:00Z",
      allowedMediaHosts: ["media.example.com"],
    });
    expect(result.liveVersionId).toBe("v1");
    expect(result.schedule.status).toBe("failed");
    expect(result.alert).toMatchObject({
      code: "final-validation-failed",
      action: "review-scheduled-version",
    });
  });

  it("atomically selects the scheduled version after final validation", () => {
    const result = executeScheduledPublication({
      schedule: scheduled(),
      currentLiveVersionId: "v1",
      now: "2026-07-31T02:00:00Z",
      allowedMediaHosts: ["media.example.com"],
    });
    expect(result).toMatchObject({
      schedule: { status: "published" },
      liveVersionId: "v2",
    });
  });
});

describe("media content-health queue", () => {
  it("flags invalid, forbidden, unavailable and unchecked media without learner IDs", () => {
    const references = [
      ["bad", "not a URL"],
      ["forbidden", "https://evil.example/video"],
      ["down", "https://media.example.com/down"],
      ["pending", "https://media.example.com/pending"],
      ["healthy", "https://media.example.com/healthy"],
    ].map(([lessonId, videoUrl]) => ({
      courseId: "course-1",
      lessonId,
      lessonTitle: lessonId,
      videoUrl,
      contentOwnerId: "owner-1",
      affectedLearnerCount: 12,
      recentLessonViews: 40,
    }));
    const queue = buildContentHealthQueue({
      references,
      allowedMediaHosts: ["media.example.com"],
      checkedAt: "2026-07-30T04:00:00Z",
      probes: [
        {
          videoUrl: "https://media.example.com/down",
          status: "unavailable",
          checkedAt: "2026-07-30T03:59:00Z",
          httpStatus: 404,
        },
        {
          videoUrl: "https://media.example.com/healthy",
          status: "available",
          checkedAt: "2026-07-30T03:59:00Z",
          httpStatus: 200,
        },
      ],
    });

    expect(queue.map((item) => item.status)).toEqual([
      "invalid-url",
      "forbidden-host",
      "unavailable",
      "not-checked",
    ]);
    expect(queue[2]).toMatchObject({
      affectedLearnerCount: 12,
      recentLessonViews: 40,
      ownerAlertRequired: true,
    });
    expect(JSON.stringify(queue)).not.toContain("learnerId");
  });
});
