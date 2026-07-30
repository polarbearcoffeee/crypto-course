export const metricIds = [
  "registration",
  "verification",
  "activation",
  "7d-active",
  "completion",
  "stuck",
  "advanced-eligible",
  "retention",
  "source",
  "lesson",
  "question",
] as const;

export type MetricId = (typeof metricIds)[number];

export type MetricDefinition = Readonly<{
  id: MetricId;
  name: string;
  source: readonly string[];
  numerator: string;
  denominator: string;
  window: string;
  timezone: "Asia/Taipei";
  latePolicy: string;
  refresh: string;
  version: string;
}>;

const defaults = {
  timezone: "Asia/Taipei",
  latePolicy:
    "依 occurredAt 歸入原統計日；延遲 7 天內於下一次每日彙總回補，超過 7 天標記待對帳。",
  refresh: "每小時增量更新，每日 02:00 完整重算。",
  version: "1.0.0",
} as const;

export const metricDictionary: Readonly<Record<MetricId, MetricDefinition>> = {
  registration: {
    ...defaults,
    id: "registration",
    name: "註冊人數",
    source: ["registration_submitted"],
    numerator: "期間內成功註冊的不重複 learnerId 數",
    denominator: "不適用（人數指標）",
    window: "依 registration_submitted.occurredAt 所在日、週或月",
  },
  verification: {
    ...defaults,
    id: "verification",
    name: "UID 驗證率",
    source: ["registration_submitted", "uid_status_changed"],
    numerator: "分母中在觀察窗內首次變為 verified 的不重複 learnerId 數",
    denominator: "期間內成功註冊且提交 UID 的不重複 learnerId 數",
    window: "註冊後 7 個完整日",
  },
  activation: {
    ...defaults,
    id: "activation",
    name: "學習啟動率",
    source: ["registration_submitted", "lesson_started"],
    numerator: "分母中至少產生一次 lesson_started 的不重複 learnerId 數",
    denominator: "期間內成功註冊的不重複 learnerId 數",
    window: "註冊後 7 個完整日",
  },
  "7d-active": {
    ...defaults,
    id: "7d-active",
    name: "近 7 日活躍學員",
    source: [
      "lesson_started",
      "video_marked_watched",
      "quiz_started",
      "quiz_submitted",
      "lesson_completed",
      "checkin_recorded",
    ],
    numerator: "最近 7 個完整日內至少產生一次有效學習事件的不重複 learnerId 數",
    denominator: "不適用（人數指標）",
    window: "報表 asOf 前 7 個完整日，不含當日未結束區間",
  },
  completion: {
    ...defaults,
    id: "completion",
    name: "完課率",
    source: ["registration_submitted", "beginner_course_completed"],
    numerator: "分母中產生 beginner_course_completed 的不重複 learnerId 數",
    denominator: "所選註冊 cohort 的不重複 learnerId 數",
    window: "註冊後 30 個完整日",
  },
  stuck: {
    ...defaults,
    id: "stuck",
    name: "卡關學員率",
    source: ["lesson_started", "lesson_completed", "quiz_submitted"],
    numerator: "已開始但未完成目前單元，且連續 72 小時沒有進度事件的 learnerId 數",
    denominator: "已啟動且尚未完成課程的不重複 learnerId 數",
    window: "以報表 asOf 回看最近一次進度事件",
  },
  "advanced-eligible": {
    ...defaults,
    id: "advanced-eligible",
    name: "進階資格達成率",
    source: ["beginner_course_completed", "advanced_eligible"],
    numerator: "分母中產生 advanced_eligible 的不重複 learnerId 數",
    denominator: "產生 beginner_course_completed 的不重複 learnerId 數",
    window: "初階完課後 30 個完整日",
  },
  retention: {
    ...defaults,
    id: "retention",
    name: "D7 留存率",
    source: [
      "registration_submitted",
      "lesson_started",
      "quiz_submitted",
      "lesson_completed",
      "checkin_recorded",
    ],
    numerator: "分母中在註冊後第 7 日產生至少一次有效學習事件的 learnerId 數",
    denominator: "所選註冊 cohort 的不重複 learnerId 數",
    window: "第 7 日 00:00 至第 8 日 00:00 前",
  },
  source: {
    ...defaults,
    id: "source",
    name: "來源轉換率",
    source: ["referral_landing", "registration_submitted", "beginner_course_completed"],
    numerator: "所選來源歸因下達成目標事件的不重複 learnerId 數",
    denominator: "同一歸因來源的有效 referral_landing 不重複 sessionId 數",
    window: "首次落地後 30 個完整日；first-touch 與 latest-touch 分開報告",
  },
  lesson: {
    ...defaults,
    id: "lesson",
    name: "單元完成率",
    source: ["lesson_started", "quiz_submitted", "lesson_completed"],
    numerator: "所選課程版本與單元中產生 lesson_completed 的不重複 learnerId 數",
    denominator: "同版本與單元中產生 lesson_started 的不重複 learnerId 數",
    window: "首次開始單元後 14 個完整日",
  },
  question: {
    ...defaults,
    id: "question",
    name: "題目首次答對率",
    source: ["quiz_started", "quiz_submitted"],
    numerator: "所選 quizVersion 與 questionId 首次作答正確的不重複 learnerId 數",
    denominator: "同版本與題目有首次作答紀錄的不重複 learnerId 數",
    window: "依 quiz_submitted.occurredAt 所在報表期間",
  },
};

export function getMetricDefinition(id: MetricId): MetricDefinition {
  return metricDictionary[id];
}
