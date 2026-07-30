export type Learner = {
  id: string;
  nickname: string;
  uid: string;
  uidStatus: "待審核" | "已驗證" | "需修正" | "已拒絕";
  source: string;
  lesson: string;
  learningState: "進行中" | "卡關" | "已完成" | "未啟動";
  xp: number;
  lastActive: string;
  owner: string;
};

export const learners: Learner[] = [
  { id: "PMC-1042", nickname: "K線小白", uid: "883•••219", uidStatus: "待審核", source: "YouTube", lesson: "第 2 課", learningState: "進行中", xp: 240, lastActive: "8 分鐘前", owner: "尚未指派" },
  { id: "PMC-1038", nickname: "紀律派企鵝", uid: "721•••403", uidStatus: "已驗證", source: "Discord", lesson: "第 4 課", learningState: "卡關", xp: 510, lastActive: "8 天前", owner: "助教 Mina" },
  { id: "PMC-1031", nickname: "慢慢學交易", uid: "需補填", uidStatus: "需修正", source: "Facebook", lesson: "尚未開始", learningState: "未啟動", xp: 50, lastActive: "3 天前", owner: "助教 Allen" },
  { id: "PMC-1019", nickname: "風控第一", uid: "326•••144", uidStatus: "已驗證", source: "YouTube", lesson: "初階完課", learningState: "已完成", xp: 980, lastActive: "昨天", owner: "主教練" },
  { id: "PMC-1015", nickname: "不追高", uid: "995•••702", uidStatus: "已拒絕", source: "朋友推薦", lesson: "第 1 課", learningState: "卡關", xp: 110, lastActive: "12 天前", owner: "助教 Mina" },
];

export const curriculumRows = [
  { lesson: "01", title: "交易不是猜方向", duration: "18 分", questions: 5, status: "已發布", health: "正常" },
  { lesson: "02", title: "看懂 K 線與市場結構", duration: "26 分", questions: 8, status: "已發布", health: "正常" },
  { lesson: "03", title: "風險與倉位管理", duration: "32 分", questions: 10, status: "審核中", health: "1 項提醒" },
  { lesson: "04", title: "建立可重複的交易計畫", duration: "24 分", questions: 7, status: "草稿", health: "尚未檢查" },
];

export const auditRows = [
  { time: "今天 14:32", actor: "主教練", action: "驗證 UID", target: "PMC-1038", result: "成功" },
  { time: "今天 13:10", actor: "內容編輯 Amy", action: "送出課程審核", target: "第 3 課 v4", result: "成功" },
  { time: "昨天 21:48", actor: "助教 Mina", action: "新增追蹤備註", target: "PMC-1015", result: "成功" },
  { time: "昨天 18:05", actor: "系統", action: "每日資料核對", target: "XP 帳本", result: "2 筆待查" },
];
