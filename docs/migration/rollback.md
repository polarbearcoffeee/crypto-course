# Staging 測試匯入回滾

> `rollbackStagingImport` 是純資料清理核心，不會自行連接或刪除 Firestore。真實 staging 刪除仍需受控 adapter、權限與人工確認。

## 可刪除範圍

只允許刪除 `migrationRunId` 完全相等的以下測試匯入：

- legacy curriculum v1；
- learner summaries；
- pending UID verification；
- `legacy-import` XP adjustments；
- legacy progress snapshots。

遷移工具不寫入 `learningEvents`，所以回滾範圍也不包含該集合。若 staging 出現相同 run ID 的 learning event，視為不變條件被破壞，需先封鎖遷移並調查，不可直接當一般清理。

## 回滾步驟

1. 確認環境名稱明確為 staging，禁止 production credential。
2. 輸入完整、不可用前綴或模糊比對的 `migrationRunId`。
3. 執行 `previewStagingRollback`，記錄每個集合預計刪除筆數。
4. 將預覽筆數與該次匯入報告比對；任何差異都先停止。
5. 取得 owner 對該 run 的明確刪除同意後，由 staging adapter 執行批次刪除。
6. 再查一次五個集合，確認該 run 筆數全為 0。
7. 確認其他 run 與人工建立資料的筆數、checksum 均未改變。
8. 保存回滾時間、操作者、request ID、刪除筆數與核對結果。

## 測試保證

單元測試證明：

- 預覽會逐集合列出精確數量；
- 只刪除完全相同 run ID；
- 其他 run 的記錄保持不變；
- 原始輸入 store 不被就地修改。
