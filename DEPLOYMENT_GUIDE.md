# Jia 協作需求中心｜逐步上線指南

這份指南會把網站從目前的「本機預覽模式」，依序完成：

1. 建立 Google Sheets 資料庫。
2. 部署 Google Apps Script 後端。
3. 將網站連上試算表並完成測試。
4. 將完整網站上傳到 GitHub。
5. 啟用 GitHub Pages，取得正式網址。

建議按照順序進行，不要先跳到 GitHub Pages。先確認 Google Sheets 可以正常新增、查詢及更新任務，再公開網站會比較容易排除問題。

---

## 上線前需要準備

- 一個公司 Google 或 Google Workspace 帳號。
- 一個 GitHub 帳號。
- 本資料夾中的完整網站檔案。
- 約 20–30 分鐘設定時間。

> 注意：GitHub Pages 網站通常可被公開瀏覽。網站目前沒有公司 SSO 或管理者登入功能，不要填寫客戶個資、密碼、合約或其他敏感資料。正式內部使用前，建議再加上公司身分驗證或限制於內網／VPN。

---

# 第一階段：建立 Google Sheets 後端

## 步驟 1：新增試算表

1. 登入公司 Google 帳號。
2. 前往 Google Sheets。
3. 建立一份空白試算表。
4. 將檔名改為：`Jia 協作任務資料庫`。

不需要自行建立欄位。第一次收到任務時，程式會自動建立「工作需求」工作表與以下欄位：

- 編號
- 建立時間
- 填寫人
- 項目類別
- 工作標題
- 工作說明
- 交付時間
- 備註
- 交付方式
- 狀態
- 交付回覆
- 最後更新時間

完成後，可在 [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) 勾選第一項。

## 步驟 2：加入 Apps Script 程式

1. 在剛建立的試算表中，點選「擴充功能 → Apps Script」。
2. 開啟預設的 `Code.gs`。
3. 刪除其中原本的範例內容。
4. 開啟本網站資料夾內的 [`google-apps-script/Code.gs`](./google-apps-script/Code.gs)。
5. 複製全部內容並貼入 Apps Script 編輯器。
6. 點選「儲存」。
7. 在 Apps Script 左側開啟「專案設定」。
8. 將時區設為 `(GMT+08:00) 台北標準時間`。
9. 回到程式編輯器，在函式選單選擇 `setupSpreadsheet` 並執行一次。
10. 完成 Google 授權。
11. 確認試算表已出現「工作需求」工作表與 A–L 欄標題，且 J 欄可使用狀態下拉選單。

完整的試算表專用說明請見 [`GOOGLE_SHEETS_SETUP.md`](./GOOGLE_SHEETS_SETUP.md)。

此後端已包含：

- 新增任務。
- 讀取並依交付時間排序任務。
- 依任務編號查詢進度，忘記編號時可用完整填寫人內容找回近期任務。
- 更新「待處理／進行中／已完成」。
- 儲存 Jia 的交付回覆。

## 步驟 3：部署為網頁應用程式

1. 在 Apps Script 右上角點選「部署 → 新增部署作業」。
2. 在「選取類型」旁點選齒輪，選擇「網頁應用程式」。
3. 說明可填：`Jia 協作需求後端 v1`。
4. 「執行身分」選擇：`我`。
5. 「誰可以存取」依公司政策選擇：
   - 測試最快：`任何人`。
   - 公司 Google Workspace：可嘗試限制為公司網域，但必須實測 GitHub Pages 跨站存取是否正常。
6. 點選「部署」。
7. 依畫面完成 Google 授權。
8. 複製以 `/exec` 結尾的網頁應用程式網址。

Google 官方部署說明：[Deploy an Apps Script web app](https://developers.google.com/apps-script/guides/web)

## 步驟 4：先測試後端網址

將下列網址中的 `你的AppsScript網址` 換成剛取得的 `/exec` 網址，貼進瀏覽器：

```text
你的AppsScript網址?action=list
```

全新資料庫正常時，會看到類似內容：

```json
{"ok":true,"items":[]}
```

若看到 Google 權限或找不到頁面的錯誤，先不要修改網站，回到 Apps Script 的「部署 → 管理部署作業」確認存取權限及網址。

---

# 第二階段：讓網站連上 Google Sheets

## 步驟 5：設定後端網址

開啟 [`config.js`](./config.js)，找到：

```js
API_URL: "",
```

貼上剛才的 `/exec` 網址，例如：

```js
window.APP_CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/你的部署代碼/exec",
  APP_NAME: "給 Jia 的協作需求",
  SHEET_NAME: "工作需求",
});
```

請確認：

- 使用的是 `/exec` 正式部署網址，不是 `/dev` 測試網址。
- 網址前後沒有多餘空格。
- 雙引號與逗號仍然保留。

## 步驟 6：進行完整串接測試

依序測試以下流程：

1. 開啟 `index.html`。
2. 右上方模式標示應從「預覽模式」變成「Google Sheets 已連線」。
3. 發送一筆測試任務。
4. 記下成功畫面的任務編號。
5. 回到 Google Sheets，確認「工作需求」工作表已自動建立並出現資料。
6. 開啟 `admin.html`，確認看得到測試任務。
7. 點選「處理／回覆」，將狀態改為「已完成」並輸入測試交付內容。
8. 開啟 `status.html`，輸入任務編號確認可查詢。
9. 再清除任務編號，只輸入與送出時相同的填寫人內容，確認可找回近期任務。
10. 確認追蹤頁顯示「已完成」與 Jia 的交付回覆。

只有上述十項全部成功，才建議進入 GitHub 上架階段。

---

# 第三階段：上傳 GitHub

本網站是純靜態 HTML/CSS/JavaScript，不需要安裝套件或執行建置。GitHub 官方建議，沒有特殊建置需求的網站可以直接從分支發布。

## 步驟 7：建立 GitHub repository

1. 登入 GitHub。
2. 點選右上角「＋ → New repository」。
3. Repository name 建議填：`jia-task-hub`。
4. Description 可填：`給 Jia 的內部協作需求與任務追蹤網站`。
5. 選擇 Public 或 Private：
   - GitHub Pages 是否支援 private repository，會依個人／公司方案而異。
   - 即使 repository 是 private，發布後的 Pages 網站仍可能公開，請依公司 GitHub 方案確認。
6. 不需要勾選新增 README、`.gitignore` 或 License，因為完整包已包含需要的檔案。
7. 點選「Create repository」。

## 步驟 8：上傳完整網站檔案

在新 repository 頁面：

1. 點選「uploading an existing file」或「Add file → Upload files」。
2. 將 `department-request-center` 資料夾中的「所有內容」拖入上傳區。
3. 確認 `index.html` 位於 repository 根目錄，不是再包在第二層資料夾中。
4. Commit message 填：`Initial Jia task hub release`。
5. 點選「Commit changes」。

repository 根目錄至少應看得到：

```text
index.html
admin.html
status.html
styles.css
app.js
admin.js
status.js
data-store.js
config.js
.nojekyll
google-apps-script/
```

## 步驟 9：啟用 GitHub Pages

1. 進入 repository 的「Settings」。
2. 左側選擇「Pages」。
3. 在「Build and deployment」的 Source 選擇：`Deploy from a branch`。
4. Branch 選擇：`main`。
5. Folder 選擇：`/ (root)`。
6. 點選「Save」。
7. 等待 GitHub 完成部署，通常需要幾分鐘。
8. 回到 Pages 設定頁取得正式網站網址。

GitHub 官方說明：[Configure a publishing source for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

正式網址通常會是：

```text
https://你的GitHub帳號.github.io/jia-task-hub/
```

各頁網址：

```text
填寫頁：https://你的GitHub帳號.github.io/jia-task-hub/
追蹤頁：https://你的GitHub帳號.github.io/jia-task-hub/status.html
管理頁：https://你的GitHub帳號.github.io/jia-task-hub/admin.html
```

---

# 第四階段：上線驗收

## 步驟 10：從正式網址再次測試

請不要只測試首頁是否能開啟。使用 GitHub Pages 正式網址完整驗證：

- [ ] 手機與電腦皆能開啟填寫頁。
- [ ] 表單顯示「Google Sheets 已連線」。
- [ ] 可以建立任務並取得任務編號。
- [ ] Google Sheets 收到資料。
- [ ] 管理看板可以更新狀態與交付回覆。
- [ ] 追蹤頁可以用任務編號查詢，也能用完整填寫人內容找回近期任務。
- [ ] 選擇「其他／待確認」時不要求日期。
- [ ] 完成任務不再列入逾期與近期工作量。

---

# 日後更新方式

## 修改網站文字或版面

修改檔案後重新上傳到 GitHub 的相同位置並提交，GitHub Pages 會自動重新發布。

## 修改 Apps Script 後端

只在 Apps Script 按「儲存」不會更新正式 `/exec` 版本。請：

1. 點選「部署 → 管理部署作業」。
2. 選擇目前部署。
3. 點選編輯。
4. 建立新版本。
5. 點選部署。

通常原本的 `/exec` 網址可以繼續使用，不需要再次修改 `config.js`。

## 先備份資料

Google Sheets 是主要資料庫。建議：

- 每月複製一次試算表備份。
- 不要任意刪除或更換欄位順序。
- 若需要增加新功能，先複製一份測試表再更新 Apps Script。

---

# 常見問題

## 網站仍顯示「預覽模式」

- 檢查 `config.js` 的 `API_URL` 是否仍為空白。
- 確認修改的是已上傳 GitHub 的那份 `config.js`。
- 重新整理頁面或清除舊快取。

## 表單顯示已連線，但送出失敗

- 確認網址是 `/exec`，不是 `/dev`。
- 到 Apps Script「管理部署作業」確認存取權限。
- 確認已重新部署包含最新 `Code.gs` 的版本。
- 直接開啟 `你的AppsScript網址?action=list` 查看是否回傳 JSON。

## GitHub Pages 顯示 404

- 確認 `index.html` 位於 repository 根目錄。
- 確認 Pages source 是 `main` 與 `/(root)`。
- 確認 GitHub 帳號電子郵件已驗證。
- 到 repository 的 Actions 頁檢查 Pages deployment 是否完成。

## 發任務人查不到任務

- 確認輸入完整任務編號。
- 確認追蹤頁與填寫頁使用相同的 `config.js`。
- 到 Google Sheets 檢查該編號是否存在。
