# 合成舊新數量比對報告

> 資料狀態：本機合成資料。這不是正式 Firestore 匯出，也不能當成正式遷移證明。

| 項目 | 舊系統 | 新系統 | 差異 | 狀態 | 說明 |
| --- | ---: | ---: | ---: | --- | --- |
| learners | 20 | 19 | -1 | explained | `duplicate-removed`：兩筆合成舊資料屬於同一學員，依 dry-run 合併。證據 `synthetic-dry-run:duplicate-01`。 |
| progress | 16 | 16 | 0 | matching | 無差異。 |
| xp | 800 | 800 | 0 | matching | 無差異。 |
| uid | 18 | 18 | 0 | matching | 無差異。 |
| sources | 4 | 3 | -1 | explained | `unknown-source-normalized`：空白來源統一併入 `unknown`。證據 `synthetic-dry-run:source-01`。 |
| courses | 1 | 1 | 0 | matching | 無差異。 |

結果：`accepted`。兩項差異都有原因、文字說明及證據 ID；沒有未解釋差異。

正式切換時必須以 staging 的舊資料匯出與新資料庫統計重新產生此表，不能沿用上述數字。
