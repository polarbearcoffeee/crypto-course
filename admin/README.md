# 交易修煉學院營運後台（展示測試版）

目前只用來確認後台資訊架構、操作流程與畫面呈現，不連接正式 Firebase，
也不得放入真實學員、UID、聯絡資料或正式環境憑證。

## GitHub Pages 展示

- 新後台：https://polarbearcoffeee.github.io/crypto-course/admin/
- 學員前台：https://polarbearcoffeee.github.io/crypto-course/
- GitHub：https://github.com/polarbearcoffeee/crypto-course

展示登入資料：

```text
帳號：owner@pmc.demo
密碼：PMC-demo-2026
```

> 這組帳密只是在瀏覽器內模擬登入畫面，不是真正的伺服器驗證。展示資料保存在
> `localStorage`，清除網站資料或更換瀏覽器後會重置，不可用來保存真實資料。

新後台已整合舊版的 6 堂課、18 題測驗、學員 UID 審核、學習狀態、內部備註、
CSV 匯出與舊共用 PIN 遷移工具。正式上線仍需接上 Firebase Authentication、
Firestore、Security Rules 與可信任的後端 API。

## 本機啟動

```powershell
npm.cmd install
npm.cmd run dev
```

開啟終端顯示網址後的 `/crypto-course/admin/vite.html`。畫面中的人數、比例及工作佇列
皆為合成示範資料。`index.html` 與 `assets/` 是提供舊式 GitHub Pages 直接發布的
自動產物，請勿手動編輯。

## 驗證

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

若要同步提交給舊式 GitHub Pages 的正式建置檔：

```powershell
npm.cmd run build:pages
```
