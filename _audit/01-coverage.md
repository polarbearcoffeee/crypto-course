# 入口點名冊

## 機械化分母

- 專案檔案：3 個，共 1,631 行。
- HTML 頁面：2 個（`index.html` 1,521 行；`advanced-course.html` 35 行）。
- 說明文件：1 個（`README.md` 75 行）。
- 前台分頁：6 個。
- 固定課程：6 堂，每堂 3 題，共 18 題。
- Firebase 資料入口：3 個訂閱、3 類寫入。
- 自動測試、API、排程、Webhook：0。

## 頁面與正常入口

- ✅ `/index.html`：註冊門、主應用與教師後台。
- ✅ `/advanced-course.html`：完成全部課程後的預留頁；也可直接輸入網址抵達。
- ✅ `dashboard`：儀表板、XP、簽到、當前任務、關卡進度。
- ✅ `map`：六堂課、影片狀態、測驗、進階課程入口。
- ✅ `growth`：成就與最近 30 筆 XP 紀錄。
- ✅ `leaderboard`：全學員 XP 排行。
- ✅ `rules`：XP 與簽到規則。
- ✅ `admin`：PIN 門、課程編輯、學員資料、PIN 更新。

## 前台高頻動作

- ✅ 新學員：開啟 Bitunix 推薦連結 → 填暱稱 → 填 UID → 進入課程。
- ✅ 舊學員：憑本機 `studentId` 直接進入。
- ✅ 修改暱稱：右上角頭像 → `prompt`。
- ✅ 簽到：每日一次；第 7／14／30 天另加獎勵。
- ✅ 標記影片已看：每課一次、加 10 XP。
- ✅ 測驗：作答、送出、失敗重答、通過後重測。
- ✅ 闖關：前一課通過後解鎖下一課。
- ✅ 成就：7 種條件。
- ✅ 進階入口：程式判定完成六課後啟用。

## 教師／管理入口

- ✅ PIN 解鎖與登出。
- ✅ 課程欄位：`id`、`title`、`meta`、`points[]`、`videoUrl`、`quiz[].q`、`quiz[].options[]`、`quiz[].correct`。
- ✅ 學員欄位：`id`、`name`、`bitunixUid`、`trafficSource`、`xp`、`level`、`levelName`、`passedCount`、`totalModules`、`badgeCount`、`checkinStreak`、`progress`、`lastActive`。
- ✅ 課程整包儲存。
- ✅ PIN 更新。
- ⏭️ 學員新增／編輯／刪除／停權：程式沒有入口；依產品現況列為候選缺口，待規模判斷。
- ⏭️ 搜尋／篩選／分頁／匯出：程式沒有入口；待站③判斷急迫度。
- ⏭️ 操作紀錄／版本回復：程式與倉庫未見；Firestore 主控台設定不在倉庫，標為未覆蓋。

## Firebase／本機資料入口

- ✅ `ta_content/curriculum`：即時讀取；教師整包覆寫。
- ✅ `ta_settings/app`：即時讀取；教師更新 PIN。
- ✅ `ta_students/{studentId}`：全表即時讀取；學員瀏覽器合併寫入自己的文件。
- ✅ `localStorage`：課程進度、影片狀態、XP 紀錄、簽到、暱稱、學員 ID、UID、來源。
- ✅ `sessionStorage`：後台解鎖狀態。
- ❓ Firestore Security Rules：不在倉庫，無法檢查。
- ❓ 正式 Firestore 目前實際課程內容：依安全紅線不讀正式資料。

## 檔案覆蓋

- ✅ `README.md`：全文閱讀。
- ✅ `index.html`：全文與所有事件／資料入口閱讀。
- ✅ `advanced-course.html`：全文閱讀。
- ⏭️ 正式站與正式 Firebase：明確跳過，避免讀寫真實學員資料。
