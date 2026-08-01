# Jia 協作需求中心｜上線檢查清單

按照順序完成並勾選。詳細操作請參考 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)。

## A. Google Sheets

- [ ] 使用公司 Google 帳號建立試算表。
- [ ] 試算表命名為「Jia 協作任務資料庫」。
- [ ] 從試算表開啟 Apps Script。
- [ ] 將 `google-apps-script/Code.gs` 完整貼入並儲存。
- [ ] 將 Apps Script 時區設為台北。
- [ ] 在 Apps Script 編輯器中執行一次 `setupSpreadsheet`。
- [ ] 確認自動建立「工作需求」工作表與 A–K 欄。
- [ ] 部署為網頁應用程式。
- [ ] 取得以 `/exec` 結尾的正式網址。
- [ ] 開啟 `網址?action=list`，確認看到 `{"ok":true,"items":[]}`。

## B. 網站連線

- [ ] 將 `/exec` 網址貼入 `config.js` 的 `API_URL`。
- [ ] 填寫頁顯示「Google Sheets 已連線」。
- [ ] 成功發送一筆測試任務。
- [ ] Google Sheets 出現「工作需求」工作表與測試資料。
- [ ] 管理看板看得到測試任務。
- [ ] 成功改成「已完成」並輸入交付回覆。
- [ ] 追蹤頁能用任務編號看到完成狀態與回覆。

## C. GitHub

- [ ] 建立 `jia-task-hub` repository。
- [ ] 將完整網站檔案上傳至 repository 根目錄。
- [ ] 確認 `index.html` 不在第二層資料夾。
- [ ] 在 Settings → Pages 選擇 Deploy from a branch。
- [ ] 選擇 `main` 與 `/(root)`。
- [ ] 取得 GitHub Pages 正式網址。

## D. 正式上線驗收

- [ ] 正式填寫頁能建立任務。
- [ ] 正式管理頁能更新狀態與回覆。
- [ ] 正式追蹤頁能查詢任務。
- [ ] 手機版可以正常填寫與查詢。
- [ ] 已向使用者說明不要填寫敏感資料。
- [ ] 已決定管理頁的公司存取限制方式。
