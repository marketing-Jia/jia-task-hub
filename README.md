# 給 Jia 的協作需求中心

> 第一次上線請從 [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) 開始，並搭配 [`SETUP_CHECKLIST.md`](./SETUP_CHECKLIST.md) 逐項完成 Google Sheets 串接與 GitHub Pages 發布。

> Google Sheets 與 Apps Script 的詳細設定、權限選擇及錯誤排除，請使用 [`GOOGLE_SHEETS_SETUP.md`](./GOOGLE_SHEETS_SETUP.md)。

一套以「發任務給 Jia」為主軸、可直接部署的內部協作需求網站，包含：

- 同仁填寫頁：填寫人、項目類別、工作說明、交付時間（可選其他／待確認）、備註。
- 發任務人追蹤頁：使用任務編號查看待處理、進行中或已完成狀態，以及 Jia 的交付回覆。
- 管理看板：預設依交付時間由近到遠排序，支援篩選、狀態更新與交付內容回覆。
- Google Sheets 後端：新資料寫入後，試算表本身也會自動依交付時間排序。
- 響應式設計：桌機與手機皆可使用。

## 先在本機預覽

直接開啟 `index.html` 即可。尚未設定 Google Sheets 時，網站會顯示「預覽模式」，送出的資料只會儲存在同一個瀏覽器中。管理者可開啟 `admin.html` 查看。

若瀏覽器不允許從本機檔案共用資料，請以任一靜態網站伺服器開啟此資料夾，例如 VS Code Live Server，或先部署至 GitHub Pages。

## 串接 Google Sheets

### 1. 建立後端

1. 新增一份 Google 試算表。
2. 在試算表選擇「擴充功能 → Apps Script」。
3. 刪除原有範例程式，將 `google-apps-script/Code.gs` 的完整內容貼入並儲存。
4. 到 Apps Script「專案設定」，將時區設成 `(GMT+08:00) 台北標準時間`。
5. 在函式選單執行一次 `setupSpreadsheet`，完成授權並確認建立 A–K 欄。
6. 點選「部署 → 新增部署作業」。
7. 類型選擇「網頁應用程式」，執行身分選擇「我」。
8. 存取權限依公司政策選擇：
   - 快速上線：選擇「任何人」。網址等同存取憑證，請勿公開散布。
   - 公司 Google Workspace：若環境允許跨站登入，可選擇「網域內的所有人」以限制公司帳號。
9. 完成部署後，複製以 `/exec` 結尾的「網頁應用程式網址」。

### 2. 讓網站連線

開啟 `config.js`，把網址貼進 `API_URL`：

```js
window.APP_CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/你的部署代碼/exec",
  APP_NAME: "給 Jia 的協作需求",
  SHEET_NAME: "工作需求",
});
```

重新整理網站後，表單右上角會顯示「Google Sheets 已連線」。第一次有人送出需求時，後端會自動建立名為「工作需求」的工作表及欄位標題。發任務人可使用 `status.html` 搭配任務編號追蹤進度；Jia 則可在 `admin.html` 更新狀態與交付回覆。

> 每次修改 `Code.gs` 後，需在 Apps Script 的「管理部署作業」建立新版本，網站才會使用新版程式。

## 部署至 GitHub Pages

1. 建立一個 GitHub repository（公司內部資料建議使用 private repository；Pages 可見性依 GitHub 方案與公司政策設定）。
2. 將本資料夾內的檔案上傳至 repository 根目錄。
3. 到 repository 的 `Settings → Pages`。
4. 在 `Build and deployment` 選擇 `Deploy from a branch`，再選擇主要分支與 `/ (root)`。
5. 等候 GitHub 提供網站網址。填寫頁是 `/index.html`，管理看板是 `/admin.html`。

## 檔案說明

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 同仁填寫工作需求 |
| `admin.html` | 需求管理、排序與篩選 |
| `status.html` | 發任務人查詢進度與交付回覆 |
| `config.js` | 設定 Google Apps Script 網址 |
| `data-store.js` | Google Sheets / 預覽模式資料存取 |
| `app.js` | 填寫頁互動與驗證 |
| `admin.js` | 管理看板、排序與篩選 |
| `status.js` | 任務編號查詢與追蹤資訊顯示 |
| `styles.css` | 全站視覺與手機版面 |
| `google-apps-script/Code.gs` | Google Sheets 後端程式 |

## 上線前的權限提醒

目前管理看板網址本身沒有獨立密碼；誰能開啟 `admin.html`，誰就能看到需求並更新狀態。追蹤頁則以任務編號作為查詢依據，不應將編號公開張貼。若內容含敏感資料，請至少採用以下其中一種方式：

- 以公司內網、VPN 或具帳號權限的託管服務限制網站存取。
- 將 Apps Script 存取權限限制在公司 Google Workspace 網域內，並實際測試 GitHub Pages 到 Apps Script 的登入流程。
- 日後加上公司 SSO；不建議只在前端 JavaScript 中放一組共用密碼，因為無法真正保護資料。
