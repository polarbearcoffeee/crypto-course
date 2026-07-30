# 舊資料欄位對照與遮罩規則

> 狀態：工具與對照文件已完成；尚未讀取、匯出或寫入任何真實 staging 資料。

## 來源邊界

| 舊集合 | 舊文件／欄位 | 新資料用途 | 遷移規則 |
|---|---|---|---|
| `ta_students` | Firestore 文件 ID / `id` | `learner.legacyLearnerId` | 保留原值供回查；新 ID 為 `legacy:{legacyLearnerId}`，不跨裝置自動合併。 |
| `ta_students` | `name` | `learner.nickname` | 原值遷移；紅acted staging 匯出只使用 `legacy-learner-N` 別名。 |
| `ta_students` | `bitunixUid` | pending UID 驗證項目 | 一律設為 `pending`，不宣稱已由 Bitunix 驗證；重複值只列人工檢查，不自動合併。 |
| `ta_students` | `trafficSource` | `sourceFirst`、`sourceLatest` | 空白改為 `unknown`，同時出現在 dry-run 的 `missing-source` 類別。 |
| `ta_students` | `xp` | XP 調整帳 | 建立單筆 `legacy-import` 調整；不倒推事件，重跑以 `migrationRunId + legacyLearnerId` 保持冪等。 |
| `ta_students` | `passedCount` / `totalModules` | 學習狀態摘要 | 兩者相等且總數大於 0 時標為 `completed`；否則只作摘要證據。 |
| `ta_students` | `progress` | v1 課程進度快照 | 只接收已知課程 ID 與可解析形狀，證據標為 `legacy-import`；未知課程列入資料品質報告。 |
| `ta_students` | `lastActive` | `lastActiveAt` | 可解析的日期轉為 ISO 字串；不當作歷史學習事件。 |
| `ta_content/curriculum` | 完整文件 | immutable legacy curriculum `v1` | 原文件完整凍結保存，以 canonical JSON 計算 SHA-256；可用預先記錄的 checksum 阻擋來源漂移。 |
| `ta_settings/app` | `pin` | 不遷移 | 共用 PIN 不可進入 staging 匯出或新權限模型。 |
| `ta_settings/app` | 其他欄位 | 尚未自動映射 | 先由 owner 逐欄確認；遮罩工具目前只輸出 `pinRemoved: true`。 |

## Redacted export 安全界線

`createRedactedLegacyExport` 是純記憶體工具，不包含 Firebase 憑證、讀取器或 staging 寫入器：

- 暱稱改為依列序號產生的別名。
- 舊 learner ID 與 UID 使用至少 16 字元、每次執行專用的秘密 salt 後做 SHA-256。
- 相同 UID 會得到相同 fingerprint，足以在遮罩資料內找重複候選。
- 原始姓名、learner ID、UID、共用 PIN 不會出現在結果。
- 結果固定標記 `stagingWritePerformed: false`，避免把「工具已完成」誤報成「真實資料已匯出」。

正式使用時，salt 必須放在受控秘密管理服務，不可寫進 repo、log 或輸出檔。staging 寫入器需另行審查與授權。
