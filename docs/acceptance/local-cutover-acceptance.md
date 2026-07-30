# 本機切換驗收紀錄

本文件只證明「合成資料在本機的契約與規則可驗收」，不代表 Firebase、正式帳號、備份還原、正式資料遷移或正式部署已完成。

## OpenSpec 10.2：角色與合成 UID 驗收

- 測試資料的學員 ID、驗證 ID 一律以 `synthetic-` 開頭，避免誤用真實資料。
- 五種角色 × 十一項權限全部逐格比對，共 55 個權限判斷。
- `owner`、`lead-teacher`、`assistant` 可看完整合成 UID。
- `content-editor`、`analyst` 只能看到遮罩後四碼。
- 測試入口：`admin/src/acceptance/roleAcceptance.test.ts`。

| 角色 | 儀表板 | UID／個資 | UID 審核 | 學員編輯 | 匯出 | 課程編輯 | 發布／回滾 | 設定／管理員 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| owner | 可 | 可 | 可 | 可 | 可 | 可 | 可 | 可 |
| lead-teacher | 可 | 可 | 可 | 可 | 可 | 可 | 可 | 不可 |
| assistant | 可 | 可 | 可 | 可 | 不可 | 不可 | 不可 | 不可 |
| content-editor | 可 | 不可 | 不可 | 不可 | 不可 | 可 | 不可 | 不可 |
| analyst | 可 | 不可 | 不可 | 不可 | 可（遮罩） | 不可 | 不可 | 不可 |

## OpenSpec 10.3：舊新數量比對

比對固定涵蓋 `learners`、`progress`、`xp`、`uid`、`sources`、`courses` 六類。

- 數量一致：標示 `matching`。
- 數量不同且有原因、文字說明及證據 ID：標示 `explained`。
- 數量不同但缺少任何一項說明證據：標示 `unexplained`，整份報告不得通過。
- 比對器可輸出 Markdown 表格，讓正式 dry-run 的差異可以人工覆核。
- 測試入口：`admin/src/acceptance/countComparison.test.ts`。

## OpenSpec 10.6：四組獨立可逆閘門

UID 審核、學員備註／標籤、課程發布、設定管理各有獨立閘門。所有環境預設關閉。

- 每次異動必須包含操作者、原因、時間、唯一 change ID。
- 每次異動使用 revision 防止舊頁面覆蓋新設定。
- 回滾會回到該次異動前的值，並保留 `rollbackOf` 稽核關聯。
- 單獨開啟一個閘門不會連動其他三個閘門。
- 測試入口：`admin/src/acceptance/featureGates.test.ts`。

## OpenSpec 10.8：學員端契約轉接

舊前台目前會訂閱完整 `ta_students` 集合，也會在 `renderAll()` 期間呼叫完整學員快照寫入。新契約將它們拆成：

1. 目前課程的單筆文件讀取。
2. 當前學員摘要的單筆文件讀取。
3. 最多 100 筆的有界排行榜查詢。
4. 只有註冊、送出 UID、完成影片、送出測驗、打卡等明確使用者動作才能產生 `submit-event` 命令。
5. 畫面重繪只呼叫 `projectLearnerRenderModel()`；此函式不接受資料庫或寫入器，因此重繪不會寫資料。

目前依任務邊界只提供純轉接器與測試，尚未修改 `index.html`。正式接線時，應將既有 Firebase callback 改接上述讀取計畫，將按鈕事件改接 `adaptLearnerAction()`，並移除 `renderAll()` 內的寫入呼叫。

## 本機驗收指令

在 `admin` 目錄執行：

```powershell
npm test -- --run src/acceptance
npm run typecheck
```

正式勾選切換完成前，仍需在 staging 使用五個具名測試帳號、Firebase emulator／staging rules 與實際 API 接線再次驗收。
