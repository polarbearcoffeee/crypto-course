# 採納與療程戰果

## 2026-07-31 新後台整合

- 採納：把舊版課程、題庫、學員 UID 管理、CSV 匯出與舊 PIN 遷移整合進新後台。
- 採納：加入 GitHub Pages 展示登入與平台連結總覽，集中所有操作入口。
- 採納：所有展示資料只保存在瀏覽器，並在登入頁、設定頁與文件標示安全限制。
- 保留：舊學員前台不做視覺大改，仍由 Pages 根路徑提供。
- 未採納為正式能力：展示帳密、瀏覽器資料與舊 PIN 不得被宣稱為正式登入或資料庫。
- 正式治本：後續接 Firebase Authentication、Firestore、Security Rules 與後端 API。

詳細證據見 [`06-new-admin-integration.md`](06-new-admin-integration.md)。
