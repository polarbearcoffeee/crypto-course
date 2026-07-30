export type CurriculumQuestion = {
  questionId: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
};

export type CurriculumLesson = {
  lessonId: string;
  title: string;
  objectives: string[];
  content: string;
  videoUrl?: string;
  videoRequired: boolean;
  questions: CurriculumQuestion[];
  prerequisiteLessonId?: string;
  passingThreshold: number;
};

export type CurriculumContent = {
  courseId: string;
  title: string;
  lessons: CurriculumLesson[];
};

export type ValidationIssue = {
  path: string;
  code:
    | "required"
    | "invalid-media-url"
    | "invalid-option-count"
    | "invalid-correct-answer"
    | "invalid-prerequisite"
    | "invalid-threshold";
  message: string;
};

export type CurriculumDraft = {
  draftId: string;
  revision: number;
  editorId: string;
  updatedAt: string;
  content: CurriculumContent;
};

export type CurriculumDiff = {
  path: string;
  kind: "added" | "removed" | "changed" | "reordered";
  before?: unknown;
  after?: unknown;
};

export type PublishedCurriculumVersion = Readonly<{
  versionId: string;
  previousVersionId?: string;
  note: string;
  checksum: string;
  publisherId: string;
  publishedAt: string;
  content: Readonly<CurriculumContent>;
  diffFromPrevious: readonly Readonly<CurriculumDiff>[];
}>;

const isBlank = (value: string | undefined) => !value?.trim();

export function validateCurriculumForPublish(
  curriculum: CurriculumContent,
  allowedMediaHosts: readonly string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lessonIds = new Set(curriculum.lessons.map((lesson) => lesson.lessonId));

  if (isBlank(curriculum.title)) {
    issues.push({
      path: "title",
      code: "required",
      message: "Course title is required.",
    });
  }

  curriculum.lessons.forEach((lesson, lessonIndex) => {
    const base = `lessons[${lessonIndex}]`;
    if (isBlank(lesson.title)) {
      issues.push({
        path: `${base}.title`,
        code: "required",
        message: "Lesson title is required.",
      });
    }
    if (
      lesson.objectives.length === 0 ||
      lesson.objectives.some((objective) => isBlank(objective))
    ) {
      issues.push({
        path: `${base}.objectives`,
        code: "required",
        message: "At least one non-empty learning objective is required.",
      });
    }
    if (isBlank(lesson.content)) {
      issues.push({
        path: `${base}.content`,
        code: "required",
        message: "Lesson content is required.",
      });
    }

    if (lesson.videoRequired || lesson.videoUrl) {
      let validMediaUrl = false;
      try {
        const url = new URL(lesson.videoUrl ?? "");
        validMediaUrl =
          url.protocol === "https:" &&
          allowedMediaHosts.some(
            (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
          );
      } catch {
        validMediaUrl = false;
      }
      if (!validMediaUrl) {
        issues.push({
          path: `${base}.videoUrl`,
          code: "invalid-media-url",
          message: "A valid HTTPS video URL from an allowed host is required.",
        });
      }
    }

    if (
      lesson.prerequisiteLessonId &&
      (!lessonIds.has(lesson.prerequisiteLessonId) ||
        lesson.prerequisiteLessonId === lesson.lessonId ||
        curriculum.lessons.findIndex(
          (candidate) => candidate.lessonId === lesson.prerequisiteLessonId,
        ) >= lessonIndex)
    ) {
      issues.push({
        path: `${base}.prerequisiteLessonId`,
        code: "invalid-prerequisite",
        message: "Prerequisite must reference an earlier lesson.",
      });
    }
    if (
      !Number.isFinite(lesson.passingThreshold) ||
      lesson.passingThreshold < 0 ||
      lesson.passingThreshold > 100
    ) {
      issues.push({
        path: `${base}.passingThreshold`,
        code: "invalid-threshold",
        message: "Passing threshold must be between 0 and 100.",
      });
    }
    if (lesson.questions.length === 0) {
      issues.push({
        path: `${base}.questions`,
        code: "required",
        message: "At least one quiz question is required.",
      });
    }

    lesson.questions.forEach((question, questionIndex) => {
      const questionBase = `${base}.questions[${questionIndex}]`;
      if (isBlank(question.prompt)) {
        issues.push({
          path: `${questionBase}.prompt`,
          code: "required",
          message: "Question text is required.",
        });
      }
      if (
        question.options.length !== 4 ||
        question.options.some((option) => isBlank(option))
      ) {
        issues.push({
          path: `${questionBase}.options`,
          code: "invalid-option-count",
          message: "Exactly four non-empty options are required.",
        });
      }
      if (
        !Number.isInteger(question.correctOptionIndex) ||
        question.correctOptionIndex < 0 ||
        question.correctOptionIndex >= question.options.length
      ) {
        issues.push({
          path: `${questionBase}.correctOptionIndex`,
          code: "invalid-correct-answer",
          message: "Correct answer must reference an existing option.",
        });
      }
      if (isBlank(question.explanation)) {
        issues.push({
          path: `${questionBase}.explanation`,
          code: "required",
          message: "Answer explanation is required.",
        });
      }
    });
  });

  return issues;
}

export type DraftSaveResult =
  | { status: "saved"; draft: CurriculumDraft }
  | {
      status: "conflict";
      current: CurriculumDraft;
      incoming: CurriculumDraft;
      differences: CurriculumDiff[];
      actions: readonly ["reload", "compare", "save-as-new"];
    };

export function saveDraftOptimistically(
  current: CurriculumDraft,
  incoming: CurriculumDraft,
  expectedRevision: number,
): DraftSaveResult {
  if (
    current.draftId !== incoming.draftId ||
    current.revision !== expectedRevision
  ) {
    return {
      status: "conflict",
      current: structuredClone(current),
      incoming: structuredClone(incoming),
      differences: compareCurricula(current.content, incoming.content),
      actions: ["reload", "compare", "save-as-new"],
    };
  }

  return {
    status: "saved",
    draft: {
      ...structuredClone(incoming),
      revision: current.revision + 1,
    },
  };
}

export function reloadAfterConflict(result: Extract<DraftSaveResult, { status: "conflict" }>) {
  return structuredClone(result.current);
}

export function saveConflictAsNewDraft(
  result: Extract<DraftSaveResult, { status: "conflict" }>,
  newDraftId: string,
): CurriculumDraft {
  if (isBlank(newDraftId) || newDraftId === result.current.draftId) {
    throw new Error("A distinct new draft ID is required.");
  }
  return {
    ...structuredClone(result.incoming),
    draftId: newDraftId,
    revision: 1,
  };
}

export function compareCurricula(
  before: CurriculumContent | undefined,
  after: CurriculumContent,
): CurriculumDiff[] {
  const differences: CurriculumDiff[] = [];
  compareValues(before, after, "", differences);
  return differences;
}

function compareValues(
  before: unknown,
  after: unknown,
  path: string,
  differences: CurriculumDiff[],
) {
  if (before === undefined && after !== undefined) {
    differences.push({ path: path || "$", kind: "added", after });
    return;
  }
  if (before !== undefined && after === undefined) {
    differences.push({ path: path || "$", kind: "removed", before });
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const identityKey = getIdentityKey(before, after);
    if (identityKey) {
      const beforeIds = before.map((value) => String(value[identityKey]));
      const afterIds = after.map((value) => String(value[identityKey]));
      if (
        beforeIds.length === afterIds.length &&
        beforeIds.some((id, index) => afterIds[index] !== id) &&
        beforeIds.every((id) => afterIds.includes(id))
      ) {
        differences.push({
          path,
          kind: "reordered",
          before: beforeIds,
          after: afterIds,
        });
      }
      const beforeById = new Map(
        before.map((value) => [String(value[identityKey]), value]),
      );
      const afterById = new Map(
        after.map((value) => [String(value[identityKey]), value]),
      );
      for (const id of new Set([...beforeIds, ...afterIds])) {
        compareValues(
          beforeById.get(id),
          afterById.get(id),
          `${path}[${identityKey}=${id}]`,
          differences,
        );
      }
      return;
    }
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      compareValues(before[index], after[index], `${path}[${index}]`, differences);
    }
    return;
  }
  if (isRecord(before) && isRecord(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      compareValues(
        before[key],
        after[key],
        path ? `${path}.${key}` : key,
        differences,
      );
    }
    return;
  }
  if (!Object.is(before, after)) {
    differences.push({ path: path || "$", kind: "changed", before, after });
  }
}

function getIdentityKey(
  before: unknown[],
  after: unknown[],
): "lessonId" | "questionId" | undefined {
  const records = [...before, ...after];
  if (records.length === 0 || !records.every(isRecord)) return undefined;
  if (records.every((record) => typeof record.lessonId === "string")) {
    return "lessonId";
  }
  if (records.every((record) => typeof record.questionId === "string")) {
    return "questionId";
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function createPublishedVersion(input: {
  versionId: string;
  previous?: PublishedCurriculumVersion;
  note: string;
  publisherId: string;
  publishedAt: string;
  content: CurriculumContent;
}): Promise<PublishedCurriculumVersion> {
  if (isBlank(input.versionId) || isBlank(input.note) || isBlank(input.publisherId)) {
    throw new Error("Version ID, version note, and publisher are required.");
  }
  const content = structuredClone(input.content);
  const serialized = stableStringify(content);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized),
  );
  const checksum = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return deepFreeze({
    versionId: input.versionId,
    previousVersionId: input.previous?.versionId,
    note: input.note.trim(),
    checksum,
    publisherId: input.publisherId,
    publishedAt: input.publishedAt,
    content,
    diffFromPrevious: compareCurricula(input.previous?.content as CurriculumContent | undefined, content),
  });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
