# Legacy migration dry-run 與核對手冊

> 本手冊只描述合成／遮罩資料的測試流程。未連線至正式 Firestore 或 staging。

## Dry-run 分類

`buildLegacyMigrationDryRun` 逐筆列出以下分類。分類可重疊，例如一筆可匯入資料同時是 `valid`、`duplicate-uid` 與 `missing-source`。

| 分類 | 意義 | 是否自動匯入 |
|---|---|---|
| `valid` | ID、暱稱、XP 與 progress 基本形狀可解析 | 是 |
| `malformed` | 缺 ID／暱稱、XP 非非負整數，或 progress 不是物件 | 否，先修資料 |
| `duplicate-uid` | 正規化後 UID 出現在多位學員 | 可建立各自 pending 項目，但不可合併或驗證 |
| `missing-source` | 來源空白 | 是，來源寫成 `unknown` |
| `unknown-progress` | 未知 lesson ID 或不可解析的課程進度內容 | 學員可匯入；該進度不匯入 |

## 匯入不變條件

1. 課程版本固定為 legacy `v1`，保存原文件與 SHA-256 checksum。
2. 學員保留 `legacyLearnerId`。
3. UID 一律從 `pending` 開始。
4. XP 只建立 `legacy-import` 調整帳，不建立來源事件。
5. progress 只建立 `evidence: legacy-import` 的摘要快照。
6. `learningEvents` 必須是空陣列；`assertNoFabricatedLearningEvents` 會阻擋非空結果。
7. 所有新紀錄必須帶相同 `migrationRunId`，供核對與精準回滾。

## 核對項目

`reconcileLegacyMigration` 使用同一次 dry-run 的可匯入清單作為預期母體，避免因匯入漏筆而把較小子集誤判為成功，並比對：

- 可匯入學員總數；
- 空白來源套用 `unknown` 後的來源分布；
- 舊 XP 總數與調整帳總額；
- `passedCount >= totalModules > 0` 的完課人數；
- PM 指定的代表性學員，其來源、XP、pending UID 與零事件不變條件。

驗收時 `status` 必須是 `matched` 且 `differences` 為空。若不相等，停止寫入與切換，不可用人工修改報表掩蓋差異。

## 建議執行順序

1. 對遮罩資料執行 dry-run，保存報告、來源資料 checksum 與 `migrationRunId`。
2. 修正所有 `malformed`；確認 duplicate UID 的處理人。
3. 以相同輸入產生 curriculum、learner、UID、XP 與 progress 寫入計畫。
4. 寫入隔離 staging 後執行五類總數與代表性學員核對。
5. 驗證 `learningEvents` 集合沒有該 `migrationRunId` 的新增紀錄。
6. 完成 owner 簽核前，不得啟用 production 寫入。
