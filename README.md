# 交易修煉學院（PMC企鵝戰隊）— 工程交接文件

給接手開發的工程團隊看的技術說明。專案負責人／PM：`polarbearcoffeee`（GitHub 帳號）。

## 2026 新後台整合狀態

- 學員前台：https://polarbearcoffeee.github.io/crypto-course/
- 新營運後台：https://polarbearcoffeee.github.io/crypto-course/admin/
- 展示帳號：`owner@pmc.demo`
- 展示密碼：`PMC-demo-2026`
- 部署流程：推送到 `main` 後，由 `.github/workflows/pages.yml` 建置 React 後台並部署 GitHub Pages。

新後台已整合舊版的課程與題庫編輯、學員與 UID 管理、CSV 匯出、舊 PIN 遷移及
平台連結總覽。GitHub Pages 版本仍是**純展示站**：登入與資料儲存只在瀏覽器內
模擬，不等同 VPS，也沒有正式資料庫或伺服器端權限保護。

目前倉庫 Pages 設定仍是 legacy 分支發布，因此 `admin/index.html` 與 `admin/assets/`
也會保存一份可直接發布的正式建置。它們由 `npm.cmd run build:pages` 自動產生，
不得手動修改；若倉庫 Owner 日後把 Pages Source 切成 GitHub Actions，現有 workflow
也可直接發布同一份產物。

下方「原始系統說明」保留舊版架構脈絡；新後台的使用與驗證方式請看
[`admin/README.md`](admin/README.md)。

## 專案是什麼

一個給「PMC企鵝戰隊」社群使用的加密貨幣交易紀律訓練網站，兩個角色：

- **學員（前台）**：註冊（填暱稱＋Bitunix 交易所會員編號）→ 上 6 堂新手課程（文字重點＋教學影片＋課後測驗）→ 賺 XP、解成就、比排行榜 → 全部通過後解鎖「進階課程」（目前是敬請期待頁）。
- **教師（後台）**：用共用 PIN 登入，可以線上編輯 6 堂課的內容／測驗題目、查看所有學員的學習數據與 Bitunix UID。

商業脈絡：這是一個交易導師（人設「老K」）用來篩選／培養透過他的 Bitunix 推薦連結註冊的學員的工具，UID 收集**純粹是自報資料**，網站沒有、也不可能跟 Bitunix 做真的驗證比對（那是 Bitunix 私人的聯盟後台）。

## 原始系統說明：線上網址 / 倉庫 / 部署

- 正式站：https://polarbearcoffeee.github.io/crypto-course/
- 倉庫：https://github.com/polarbearcoffeee/crypto-course
- 部署方式：**GitHub Pages + GitHub Actions**。`main` 更新後，工作流程會保留舊學員前台並建置 `admin/` React 後台，再一起發布。沒有 staging 環境。

## 原始學員前台技術棧

**這一節只描述原始學員前台。新後台使用 React、TypeScript、Vite 與 Vitest。**

- 沒有 `package.json`、沒有 bundler（Webpack/Vite 都沒有）、沒有框架（沒有 React/Vue）、沒有 TypeScript、沒有 CSS 預處理器、沒有 linter、沒有測試框架。
- 全部程式碼在兩個檔案裡：
  - `index.html`（約 1500 行）— 主應用程式，inline `<style>` + 一個大的 vanilla `<script>` 區塊。
  - `advanced-course.html`（約 35 行）— 進階課程的「敬請期待」預留頁，純靜態，尚未開發。
- 唯一的外部依賴：**Firebase v10.12.0 modular SDK**，透過 `<script type="module">` 直接從 `gstatic.com` 做 ESM import（不是透過 npm 安裝的）。
- 前端框架選型：無。畫面切換是純手刻的 `switchTab()` + CSS class 切換（`.view` / `.view.active`），沒有路由套件，網址列不會反映目前分頁，重新整理永遠回到儀表板。

**開發方式**：直接編輯 `index.html`，存檔後用瀏覽器打開（或跑 `python3 -m http.server`）就能看到結果。沒有任何「build」步驟。

## 前端架構重點

- **狀態管理**：模組層級的一般 JS 變數（`MODULES`、`studentId`、`fbOk`、`allStudents`、`quizState` 等），加上 `localStorage` 做本機持久化。沒有任何狀態管理套件，也沒有 virtual DOM。
- **渲染模式**：`renderAll()` 是唯一的「重新畫面」入口，內部依序呼叫 `renderDashboard()`／`renderMap()`／`renderGrowth()`／`renderLeaderboard()`／`renderAdmin()`／`syncStudentToFirestore()`。**每次呼叫都是把對應區塊的 `innerHTML` 整個重建**，沒有 diff、沒有局部更新。`renderAll()` 在幾乎每個使用者互動（切分頁、簽到、送出測驗、Firestore 即時更新）都會被呼叫，包括使用者當下沒有在看的分頁也會被重新渲染（只是因為該分頁的容器是 `display:none` 所以看不到）。**如果要重構成有框架的版本，這是最需要注意的地方**——目前資料量小所以沒感覺，但這個「全部重畫」的模式不會隨資料量放大而 scale。
- **動效系統**：CSS `@keyframes`（`viewIn` 負責分頁/卡片的淡入上浮，`passPulse` 負責測驗過關的光暈脈衝），全部包在 `prefers-reduced-motion` 判斷裡自動降級成純淡入。**特別注意 `justPassedId` 這個一次性旗標**：因為卡片是每次 `renderMap()` 都整個重建的新 DOM 節點，如果直接把「過關動畫」的 class 綁在 `.module.passed` 上，會導致每次任何無關的操作（例如簽到）觸發 `renderAll()` 時，所有已經過關很久的卡片全部重新播放一次動畫。目前的解法是用一個模組層級的 `justPassedId` 變數，只在「這次測驗剛好從沒過變成過」的那一次渲染標記該卡片、渲染完立刻清空。**之後任何新增的「一次性慶祝動效」都要照這個模式做**，不要直接把 animation 綁在永久性的 state class 上。
- **無障礙**：分頁的鍵盤 focus 目前是瀏覽器預設樣式，右上角「改暱稱」的頭像目前**不是**真正的可鍵盤操作按鈕（純裝飾 `<span>` + click handler）——這是已知缺口，之前的 UI 健檢報告已經記錄，還沒修。

## 資料模型（Firebase / Firestore）

**重要**：這個專案**沒有自己的 Firebase 專案**，共用另一個專案（`airport-car`，原本是業主另一個「機場接送」專案在用），靠 collection 名稱前綴 `ta_` 區隔，不要跟同專案下其他前綴（`ac_` 是另一個「寵物餐包」專案在用）搞混。Firebase config 直接寫死在 `index.html` 開頭的 `<script type="module">` 裡（apiKey 等資訊不是密鑰等級的機密——Firebase 的 client config 本來就設計成公開的，真正的存取控制要靠 Firestore Security Rules，見下方「安全性」）。

| Collection / 文件 | 內容 | 誰寫入 |
|---|---|---|
| `ta_content/curriculum` | `{ modules: [...], updatedAt }`——完整的課程內容（6 堂課的標題／文字重點／影片網址／測驗題目與正確答案）。前台用 `onSnapshot` 即時訂閱，若這份文件不存在則 fallback 用寫死在程式碼裡的 `DEFAULT_MODULES`。 | 教師後台編輯後整包覆寫 |
| `ta_students/{studentId}` | 一位（匿名）學員的完整狀態：`name`、`bitunixUid`、`trafficSource`（`?ref=` 行銷來源追蹤，最近才加）、`xp`、`level`、`levelName`、`passedCount`、`totalModules`、`badgeCount`、`checkinStreak`、`progress`（各課通過狀態）、`lastActive`。`studentId` 是前端隨機產生、存在該裝置的 `localStorage`，**不是真實帳號**，換裝置或清瀏覽器資料就是全新學員。 | 每次 XP／進度變動時，該學員自己的瀏覽器用 `setDoc(..., {merge:true})` 寫回自己那份文件 |
| `ta_settings/app` | `{ pin }`——教師後台的共用密碼，預設 `"1234"`。 | 教師後台的「更新密碼」表單 |

**沒有 Cloud Functions，沒有任何後端程式碼**。所有讀寫都是瀏覽器直接呼叫 Firestore SDK，資料驗證只能靠 Firestore Security Rules（設定在 Firebase 主控台，**不在這個倉庫裡**，交接時要另外跟業主要主控台權限才看得到/改得動）。目前的 rules 顯然是允許任何人匿名讀寫這幾個 collection（因為前端沒有任何登入流程），這代表：

## 安全性 / 身分模型（工程團隊務必先讀這段再評估風控）

**這個網站裡沒有任何一處是「真的」身分驗證**：

- **學員身分**：純粹是瀏覽器產生的隨機 ID + 使用者自己輸入的暱稱，沒有密碼、沒有 email 驗證、沒有登入機制。任何人都可以看到/竄改任何學員的 Firestore 文件（只要知道文件 ID，而 ID 本身沒有防猜測機制）。
- **教師後台**：單一組**全部教師共用**的 PIN（不是每人一組帳密），存在 `ta_settings/app.pin`，前端直接明碼比對，沒有登入嘗試次數限制、沒有 session token、只有 `sessionStorage` 記住「這個分頁解鎖過」。知道 PIN 的人可以竄改全部學員看到的課程內容、看到所有學員的 Bitunix UID。
- **註冊時填的 Bitunix UID 完全沒有驗證**——這是業主明確決定的（不做審核卡關，只收集資料給他自己事後去 Bitunix 後台肉眼核對），不是技術疏漏，但工程團隊如果要加強審核流程，需要跟業主重新確認需求，不是純技術問題。

如果要往「真正的商業產品」方向重構，**身分與權限模型基本上要整個重做**（例如加 Firebase Authentication、按角色設計 Security Rules），現在的版本是「能動、資料量小、社群內部用」等級，不建議直接擴大招生規模而不先補這塊。

## 已知技術債 / 限制

- **沒有分頁機制**：`ta_students` 用 `onSnapshot(collection(...))` 抓「整個 collection」，沒有 `limit()`。學員數一多，每個人的瀏覽器都要下載全部學員的資料（含 Bitunix UID）來畫排行榜——這也是一個資料外洩疑慮，不只是效能問題。
- **單一 HTML 檔案、無建置流程**：目前 1500 行左右還能維護，但持續加功能下去，遲早需要拆檔案／導入建置工具（哪怕只是簡單的 bundler）。
- **沒有任何自動化測試**。
- **全站唯一的密碼是明碼儲存在 Firestore、明碼比對**，沒有雜湊。
- **`gh` CLI 在這台開發機上不是持續安裝的**（僅供參考，跟正式站無關，是操作這個 repo 時可能遇到的環境細節）；`git push` 本身沒有問題，帳號憑證已設定好。
- **`justPassedId` 一次性動畫旗標**只覆蓋「測驗過關」這一種情境，如果之後加其他「慶祝時刻」（例如解成就的動畫），需要照同樣模式各自加一個旗標，不要圖方便直接綁在永久 class 上。

## 待確認事項（交接時建議直接問業主）

- 進階課程（`advanced-course.html`）目前是空頁，內容規劃／上線時程需要跟業主確認。
- Firestore Security Rules 目前的實際內容（在 Firebase 主控台，需要業主開權限）。
- 是否要把「Bitunix UID 審核」從現在的「不擋人、事後人工核對」升級成「送出後鎖住、教師手動核准才解鎖課程」——這是產品決策，程式碼改動不大，但要業主拍板。
