# 交易修煉學院營運後台（展示測試版）

目前只用來確認後台資訊架構、操作流程與畫面呈現，不連接正式 Firebase，
也不得放入真實學員、UID、聯絡資料或正式環境憑證。

## 本機啟動

```powershell
npm.cmd install
npm.cmd run dev
```

開啟終端顯示的本機網址。畫面中的人數、比例及工作佇列皆為合成示範資料。

## 驗證

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```
