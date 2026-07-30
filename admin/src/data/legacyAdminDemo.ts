import { learners as initialLearners, type Learner } from "./demo";

export type DemoQuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type DemoLesson = {
  id: string;
  title: string;
  meta: string;
  points: string[];
  videoUrl: string;
  passThreshold: number;
  status: "已發布" | "審核中" | "草稿";
  quiz: DemoQuizQuestion[];
};

export type DemoLearner = Learner & {
  notes: string[];
};

export const demoAdministrator = Object.freeze({
  username: "admin",
  password: "1234",
  displayName: "PMC 展示 Owner",
  role: "Owner",
});

export const demoSessionKey = "crypto-course-admin-demo-session";
const lessonStorageKey = "crypto-course-admin-demo-lessons";
const learnerStorageKey = "crypto-course-admin-demo-learners";
const legacyPinStorageKey = "crypto-course-admin-demo-legacy-pin";
const legacyPinDisabledStorageKey = "crypto-course-admin-demo-legacy-pin-disabled";

export const defaultLegacyLessons: DemoLesson[] = [
  {
    id: "what-is-crypto",
    title: "第 1 課：加密貨幣到底是什麼？",
    meta: "約 8 分鐘閱讀",
    points: [
      "加密貨幣是一種用密碼學技術保護、記錄在「區塊鏈」這種公開帳本上的數位資產。",
      "跟銀行帳戶不同：沒有中間單位幫你保管，你的資產由你自己的「錢包」掌控。",
      "比特幣（BTC）是第一個、也是市值最大的加密貨幣，但市場上有上千種不同用途的幣。",
      "先建立觀念：加密貨幣是一個新的資產類別，不是穩賺不賠的提款機。",
    ],
    videoUrl: "",
    passThreshold: 80,
    status: "已發布",
    quiz: [
      {
        id: "what-is-crypto-1",
        prompt: "加密貨幣的資產記錄主要保存在哪裡？",
        options: ["銀行的內部資料庫", "區塊鏈這種公開帳本", "交易所的內部試算表", "政府的登記系統"],
        correctIndex: 1,
      },
      {
        id: "what-is-crypto-2",
        prompt: "下列哪句話最符合本課精神？",
        options: ["加密貨幣保證穩定獲利", "加密貨幣是新資產類別，需自行研究風險", "只要買比特幣就不會賠錢", "價格完全不會波動"],
        correctIndex: 1,
      },
      {
        id: "what-is-crypto-3",
        prompt: "加密貨幣跟一般銀行帳戶最大的不同是？",
        options: ["資產由自己的錢包掌控，沒有銀行代為保管", "一定要臨櫃才能開戶", "有政府存款保險保障", "無法轉帳給別人"],
        correctIndex: 0,
      },
    ],
  },
  {
    id: "blockchain-basics",
    title: "第 2 課：區塊鏈基礎，白話版",
    meta: "約 10 分鐘閱讀",
    points: [
      "區塊鏈可以想成一本「所有人都有一份、寫錯不能擦掉」的帳本。",
      "每一筆交易被打包成「區塊」，一個接一個串起來，所以叫「區塊鏈」。",
      "因為帳本公開又不能竄改，才能在沒有銀行的情況下讓大家互相信任交易記錄。",
      "不用懂程式碼，只要記得：公開、難篡改、大家共同維護，就是核心精神。",
    ],
    videoUrl: "",
    passThreshold: 80,
    status: "已發布",
    quiz: [
      {
        id: "blockchain-basics-1",
        prompt: "區塊鏈最貼切的比喻是？",
        options: ["只有銀行能看的秘密帳本", "公開、大家共同維護、難以竄改的帳本", "可以隨時修改歷史紀錄的雲端硬碟", "只存在單一伺服器的資料庫"],
        correctIndex: 1,
      },
      {
        id: "blockchain-basics-2",
        prompt: "為什麼「不能竄改」這個特性很重要？",
        options: ["讓大家能在沒有銀行的情況下互相信任交易紀錄", "讓交易速度變得更快", "讓政府可以直接控制帳本", "讓私鑰變得不重要"],
        correctIndex: 0,
      },
      {
        id: "blockchain-basics-3",
        prompt: "「區塊鏈」這個名稱的由來是？",
        options: ["因為它只有一個區塊", "交易被打包成區塊，一個接一個串起來", "因為每個區塊都是正方形", "跟礦工挖到的石頭有關"],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "wallets-keys",
    title: "第 3 課：錢包與私鑰——資產安全的第一道防線",
    meta: "約 10 分鐘閱讀",
    points: [
      "錢包不是存幣的「容器」，而是用來保管你「私鑰」的工具，私鑰才是資產所有權的證明。",
      "「熱錢包」連網方便交易，「冷錢包（硬體錢包）」離線保存，安全性更高，適合放長期資產。",
      "私鑰／助記詞（12～24 個英文單字）絕對不能給任何人看、不能拍照上傳雲端、不能貼給客服。",
      "口訣：忘記密碼可以救，私鑰丟了通常沒人救得回來。",
    ],
    videoUrl: "",
    passThreshold: 80,
    status: "審核中",
    quiz: [
      {
        id: "wallets-keys-1",
        prompt: "私鑰代表什麼？",
        options: ["只是一個備用密碼", "資產所有權的證明，遺失通常無法救回", "交易所的客服帳號", "可以隨意分享的公開資訊"],
        correctIndex: 1,
      },
      {
        id: "wallets-keys-2",
        prompt: "冷錢包（硬體錢包）的特點是？",
        options: ["離線保存，適合長期資產，安全性較高", "一定要連網才能用", "比熱錢包更容易被盜", "不需要任何密碼"],
        correctIndex: 0,
      },
      {
        id: "wallets-keys-3",
        prompt: "助記詞（12～24 個單字）該怎麼處理？",
        options: ["拍照存雲端方便查詢", "貼給自稱客服的人核對", "絕對不給任何人看，也不上傳雲端", "分享在社群貼文炫耀"],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "buying-crypto",
    title: "第 4 課：怎麼買到人生第一筆加密貨幣",
    meta: "約 9 分鐘閱讀",
    points: [
      "交易所分兩種：中心化交易所（CEX，操作簡單、需實名認證）與去中心化交易所（DEX，需自備錢包）。",
      "新手建議先從信譽良好、有實名認證（KYC）機制的中心化交易所開始，操作介面較友善。",
      "下單前先搞懂「市價單」與「限價單」的差別，避免因為滑價買貴、賣便宜。",
      "小額練習優先：先用你可以承受全部損失的小金額熟悉流程，再慢慢加碼。",
    ],
    videoUrl: "",
    passThreshold: 80,
    status: "已發布",
    quiz: [
      {
        id: "buying-crypto-1",
        prompt: "CEX 跟 DEX 的差別是？",
        options: ["CEX 是中心化交易所需實名認證，DEX 是去中心化需自備錢包", "兩者完全一樣", "DEX 一定比 CEX 安全", "CEX 不需要任何認證"],
        correctIndex: 0,
      },
      {
        id: "buying-crypto-2",
        prompt: "市價單跟限價單的差別是？",
        options: ["市價單以目前市場價格立即成交，限價單可指定價格等待成交", "兩者完全相同", "限價單一定比較貴", "市價單只能用來賣出"],
        correctIndex: 0,
      },
      {
        id: "buying-crypto-3",
        prompt: "新手第一次交易建議怎麼做？",
        options: ["直接投入全部資金", "先用可承受全部損失的小金額熟悉流程", "跟親友借錢加碼", "不用了解流程直接下大單"],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "security-scams",
    title: "第 5 課：資安意識與常見詐騙手法",
    meta: "約 12 分鐘閱讀",
    points: [
      "常見詐騙：假客服私訊要你的私鑰／驗證碼、假投資群組帶單、假交易所釣魚連結。",
      "「保證獲利」「內線消息」「限時翻倍」——只要看到這幾個關鍵字，先假設是詐騙。",
      "務必開啟雙重驗證（2FA），優先使用驗證器 App 而非簡訊驗證。",
      "任何要求你「先付款才能提現」「先繳保證金解鎖資產」的情況，一律是詐騙。",
    ],
    videoUrl: "",
    passThreshold: 80,
    status: "已發布",
    quiz: [
      {
        id: "security-scams-1",
        prompt: "遇到「保證獲利」「限時翻倍」的訊息應該？",
        options: ["立刻打錢卡位", "先假設是詐騙，提高警覺", "分享給更多朋友一起參加", "把私鑰給對方核對身分"],
        correctIndex: 1,
      },
      {
        id: "security-scams-2",
        prompt: "雙重驗證（2FA）建議優先用哪種方式？",
        options: ["簡訊驗證", "驗證器 App", "完全不開", "用生日當驗證碼"],
        correctIndex: 1,
      },
      {
        id: "security-scams-3",
        prompt: "「先繳保證金才能解鎖提現」的情況通常是？",
        options: ["正常的交易所規定", "一定是詐騙", "只要金額小就安全", "政府規定的稅"],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "glossary",
    title: "第 6 課：新手必懂的 10 個幣圈術語",
    meta: "約 7 分鐘閱讀",
    points: [
      "HODL：長期持有不輕易賣出的態度（源自打字錯誤的迷因）。",
      "FOMO／FUD：追高的恐慌性追漲心理／散布恐懼或假消息帶風向。",
      "Gas Fee：在區塊鏈上執行交易需要支付的手續費。",
      "穩定幣（Stablecoin）：價值錨定法幣（如美元）、波動較小的加密貨幣。",
      "市值（Market Cap）：一種幣的「現價 × 流通供應量」，粗略反映該幣的規模。",
    ],
    videoUrl: "",
    passThreshold: 80,
    status: "草稿",
    quiz: [
      {
        id: "glossary-1",
        prompt: "HODL 的意思最接近？",
        options: ["立刻賣出換現金", "長期持有不輕易賣出", "每天頻繁交易", "只買穩定幣"],
        correctIndex: 1,
      },
      {
        id: "glossary-2",
        prompt: "Gas Fee 指的是？",
        options: ["交易所的會員費", "在區塊鏈上執行交易需支付的手續費", "買幣送的贈品", "政府徵收的稅"],
        correctIndex: 1,
      },
      {
        id: "glossary-3",
        prompt: "穩定幣（Stablecoin）的特點是？",
        options: ["價值錨定法幣如美元，波動較小", "波動比比特幣更大", "完全沒有價值", "只能用來投票"],
        correctIndex: 0,
      },
    ],
  },
];

const defaultDemoLearners: DemoLearner[] = initialLearners.map((learner) => ({
  ...learner,
  notes: [],
}));

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

function saveStored<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function verifyDemoAdministrator(username: string, password: string): boolean {
  return (
    username.trim().toLowerCase() === demoAdministrator.username &&
    password === demoAdministrator.password
  );
}

export function readDemoLessons(): DemoLesson[] {
  return readStored(lessonStorageKey, defaultLegacyLessons);
}

export function saveDemoLessons(lessons: DemoLesson[]): void {
  saveStored(lessonStorageKey, lessons);
}

export function resetDemoLessons(): DemoLesson[] {
  const lessons = clone(defaultLegacyLessons);
  saveDemoLessons(lessons);
  return lessons;
}

export function readDemoLearners(): DemoLearner[] {
  return readStored(learnerStorageKey, defaultDemoLearners);
}

export function saveDemoLearners(learners: DemoLearner[]): void {
  saveStored(learnerStorageKey, learners);
}

export function readLegacyPin(): string {
  return window.localStorage.getItem(legacyPinStorageKey) ?? "1234";
}

export function saveLegacyPin(pin: string): void {
  window.localStorage.setItem(legacyPinStorageKey, pin);
}

export function isLegacyPinDisabled(): boolean {
  return window.localStorage.getItem(legacyPinDisabledStorageKey) === "true";
}

export function setLegacyPinDisabled(disabled: boolean): void {
  window.localStorage.setItem(legacyPinDisabledStorageKey, String(disabled));
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function buildLearnerCsv(learners: readonly DemoLearner[]): string {
  const header = ["學員編號", "暱稱", "展示 UID", "UID 狀態", "來源", "學習進度", "目前課程", "XP", "最後活動", "追蹤人"];
  const rows = learners.map((learner) => [
    learner.id,
    learner.nickname,
    learner.uid,
    learner.uidStatus,
    learner.source,
    learner.learningState,
    learner.lesson,
    learner.xp,
    learner.lastActive,
    learner.owner,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
