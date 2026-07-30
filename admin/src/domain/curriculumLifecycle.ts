export type CurriculumStatus =
  | "draft"
  | "in-review"
  | "scheduled"
  | "published"
  | "archived";

export type QuizOption = Readonly<{
  optionId: string;
  text: string;
}>;

export type QuizQuestion = Readonly<{
  questionId: string;
  prompt: string;
  options: readonly QuizOption[];
  correctOptionIndex: number;
  explanation: string;
}>;

export type LessonEditorModel = Readonly<{
  lessonId: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  learningObjectives: readonly string[];
  contentPoints: readonly string[];
  videoUrl?: string;
  videoRequired: boolean;
  quizQuestions: readonly QuizQuestion[];
  passingScore: number;
  prerequisiteLessonId?: string;
  status: "active" | "inactive";
  versionNote: string;
}>;

export type CurriculumLifecycleVersion = Readonly<{
  versionId: string;
  courseId: string;
  status: CurriculumStatus;
  lessons: readonly LessonEditorModel[];
  authorId: string;
  updatedAt: string;
  reviewerId?: string;
  reviewedAt?: string;
  scheduledFor?: string;
  publisherId?: string;
  publishedAt?: string;
  archivedAt?: string;
}>;

export type CurriculumLifecycleState = Readonly<{
  versions: Readonly<Record<string, CurriculumLifecycleVersion>>;
  currentPublishedVersionId?: string;
}>;

export type CurriculumTransition =
  | Readonly<{ type: "submit-review"; actorId: string; at: string }>
  | Readonly<{ type: "return-to-draft"; actorId: string; at: string }>
  | Readonly<{
      type: "schedule";
      actorId: string;
      at: string;
      scheduledFor: string;
    }>
  | Readonly<{ type: "cancel-schedule"; actorId: string; at: string }>
  | Readonly<{ type: "publish"; actorId: string; at: string }>
  | Readonly<{ type: "archive"; actorId: string; at: string }>;

const allowedTransitions: Readonly<
  Record<CurriculumStatus, readonly CurriculumTransition["type"][]>
> = {
  draft: ["submit-review"],
  "in-review": ["return-to-draft", "schedule", "publish"],
  scheduled: ["cancel-schedule", "publish"],
  published: ["archive"],
  archived: [],
};

export function transitionCurriculumVersion(
  version: CurriculumLifecycleVersion,
  transition: CurriculumTransition,
): CurriculumLifecycleVersion {
  if (!allowedTransitions[version.status].includes(transition.type)) {
    throw new Error(
      `Cannot ${transition.type} a curriculum in ${version.status} state.`,
    );
  }

  switch (transition.type) {
    case "submit-review":
      return copyVersion(version, {
        status: "in-review",
        updatedAt: transition.at,
      });
    case "return-to-draft":
      return copyVersion(version, {
        status: "draft",
        updatedAt: transition.at,
        reviewerId: transition.actorId,
        reviewedAt: transition.at,
      });
    case "schedule":
      if (
        !isValidDate(transition.scheduledFor) ||
        Date.parse(transition.scheduledFor) <= Date.parse(transition.at)
      ) {
        throw new Error("Scheduled publication must be a valid future time.");
      }
      return copyVersion(version, {
        status: "scheduled",
        updatedAt: transition.at,
        reviewerId: transition.actorId,
        reviewedAt: transition.at,
        scheduledFor: transition.scheduledFor,
      });
    case "cancel-schedule":
      return copyVersion(version, {
        status: "in-review",
        updatedAt: transition.at,
        scheduledFor: undefined,
      });
    case "publish":
      return copyVersion(version, {
        status: "published",
        updatedAt: transition.at,
        reviewerId: version.reviewerId ?? transition.actorId,
        reviewedAt: version.reviewedAt ?? transition.at,
        scheduledFor: undefined,
        publisherId: transition.actorId,
        publishedAt: transition.at,
      });
    case "archive":
      return copyVersion(version, {
        status: "archived",
        updatedAt: transition.at,
        archivedAt: transition.at,
      });
  }
}

export function publishCurriculumVersion(
  state: CurriculumLifecycleState,
  versionId: string,
  publisherId: string,
  publishedAt: string,
): CurriculumLifecycleState {
  const candidate = state.versions[versionId];
  if (!candidate) throw new Error(`Unknown curriculum version: ${versionId}.`);

  const published = transitionCurriculumVersion(candidate, {
    type: "publish",
    actorId: publisherId,
    at: publishedAt,
  });
  const versions = cloneVersions(state.versions);
  const previousId = state.currentPublishedVersionId;

  if (previousId && previousId !== versionId) {
    const previous = versions[previousId];
    if (!previous || previous.status !== "published") {
      throw new Error("Current pointer must reference a published version.");
    }
    versions[previousId] = transitionCurriculumVersion(previous, {
      type: "archive",
      actorId: publisherId,
      at: publishedAt,
    });
  }

  versions[versionId] = published;
  return {
    versions,
    currentPublishedVersionId: versionId,
  };
}

export function getCurrentPublishedVersion(
  state: CurriculumLifecycleState,
): CurriculumLifecycleVersion | undefined {
  if (!state.currentPublishedVersionId) return undefined;
  const current = state.versions[state.currentPublishedVersionId];
  if (!current || current.status !== "published") {
    throw new Error("Current pointer must reference a published version.");
  }
  return cloneVersion(current);
}

export function updateLesson(
  lesson: LessonEditorModel,
  changes: Partial<
    Omit<LessonEditorModel, "lessonId" | "quizQuestions"> & {
      quizQuestions: readonly QuizQuestion[];
    }
  >,
): LessonEditorModel {
  return cloneLesson({ ...lesson, ...changes });
}

export function addQuizQuestion(
  lesson: LessonEditorModel,
  question: QuizQuestion,
): LessonEditorModel {
  if (
    lesson.quizQuestions.some(
      (candidate) => candidate.questionId === question.questionId,
    )
  ) {
    throw new Error(`Duplicate question ID: ${question.questionId}.`);
  }
  return updateLesson(lesson, {
    quizQuestions: [...lesson.quizQuestions, cloneQuestion(question)],
  });
}

export function updateQuizQuestion(
  lesson: LessonEditorModel,
  questionId: string,
  changes: Partial<Omit<QuizQuestion, "questionId">>,
): LessonEditorModel {
  let found = false;
  const quizQuestions = lesson.quizQuestions.map((question) => {
    if (question.questionId !== questionId) return cloneQuestion(question);
    found = true;
    return cloneQuestion({ ...question, ...changes });
  });
  if (!found) throw new Error(`Unknown question ID: ${questionId}.`);
  return updateLesson(lesson, { quizQuestions });
}

export function removeQuizQuestion(
  lesson: LessonEditorModel,
  questionId: string,
): LessonEditorModel {
  const quizQuestions = lesson.quizQuestions.filter(
    (question) => question.questionId !== questionId,
  );
  if (quizQuestions.length === lesson.quizQuestions.length) {
    throw new Error(`Unknown question ID: ${questionId}.`);
  }
  return updateLesson(lesson, { quizQuestions });
}

export function reorderLessons(
  version: CurriculumLifecycleVersion,
  orderedLessonIds: readonly string[],
): CurriculumLifecycleVersion {
  if (version.status !== "draft") {
    throw new Error("Lessons can only be reordered in a draft.");
  }
  const existingIds = version.lessons.map((lesson) => lesson.lessonId);
  if (
    orderedLessonIds.length !== existingIds.length ||
    new Set(orderedLessonIds).size !== existingIds.length ||
    existingIds.some((id) => !orderedLessonIds.includes(id))
  ) {
    throw new Error("Lesson order must contain every lesson exactly once.");
  }
  const byId = new Map(
    version.lessons.map((lesson) => [lesson.lessonId, lesson] as const),
  );
  return copyVersion(version, {
    lessons: orderedLessonIds.map((id) => cloneLesson(byId.get(id)!)),
  });
}

function copyVersion(
  version: CurriculumLifecycleVersion,
  changes: Partial<CurriculumLifecycleVersion>,
): CurriculumLifecycleVersion {
  return {
    ...cloneVersion(version),
    ...changes,
    lessons: changes.lessons
      ? changes.lessons.map(cloneLesson)
      : version.lessons.map(cloneLesson),
  };
}

function cloneVersion(
  version: CurriculumLifecycleVersion,
): CurriculumLifecycleVersion {
  return {
    ...version,
    lessons: version.lessons.map(cloneLesson),
  };
}

function cloneLesson(lesson: LessonEditorModel): LessonEditorModel {
  return {
    ...lesson,
    learningObjectives: [...lesson.learningObjectives],
    contentPoints: [...lesson.contentPoints],
    quizQuestions: lesson.quizQuestions.map(cloneQuestion),
  };
}

function cloneQuestion(question: QuizQuestion): QuizQuestion {
  return {
    ...question,
    options: question.options.map((option) => ({ ...option })),
  };
}

function cloneVersions(
  versions: Readonly<Record<string, CurriculumLifecycleVersion>>,
): Record<string, CurriculumLifecycleVersion> {
  return Object.fromEntries(
    Object.entries(versions).map(([id, version]) => [id, cloneVersion(version)]),
  );
}

function isValidDate(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Date.parse(value));
}
