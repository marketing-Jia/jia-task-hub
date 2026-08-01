/**
 * 給 Jia 的協作需求中心｜Google Sheets 後端
 *
 * 使用方式：
 * 1. 在 Google 試算表中開啟「擴充功能 → Apps Script」。
 * 2. 將此檔案完整貼到 Code.gs。
 * 3. 在編輯器中手動執行一次 setupSpreadsheet。
 * 4. 部署為網頁應用程式，再將部署網址填入網站的 config.js。
 */

const SHEET_NAME = '工作需求';
const HEADERS = ['編號', '建立時間', '填寫人', '項目類別', '工作說明', '交付時間', '備註', '交付方式', '狀態', '交付回覆', '最後更新時間'];
const CATEGORIES = ['行銷', '行政', '營運', '業務', '其他'];
const WORK_STATUSES = ['待處理', '進行中', '已完成'];

/**
 * 第一次部署前，請在 Apps Script 編輯器中手動執行一次此函式。
 * 它會記住目前綁定的試算表，讓網頁應用程式可穩定讀寫同一份資料庫。
 */
function setupSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('找不到目前綁定的試算表，請從 Google Sheets 的「擴充功能 → Apps Script」開啟此專案。');
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  const sheet = getOrCreateSheet_();
  Logger.log('設定完成：' + spreadsheet.getName() + ' / ' + sheet.getName());
  return '設定完成：' + spreadsheet.getName();
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'list');
    if (action !== 'list' && action !== 'get') {
      return json_({ ok: false, error: '不支援的操作。' });
    }

    const sheet = getOrCreateSheet_();
    if (action === 'get') {
      const id = clean_(e && e.parameter && e.parameter.id, 40);
      if (!id) return json_({ ok: false, error: '請提供任務編號。' });
      const row = findRequestRow_(sheet, id);
      if (!row) return json_({ ok: false, error: '找不到此任務，請確認編號是否正確。' });
      const item = rowToItem_(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
      return json_({ ok: true, item: item });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return json_({ ok: true, items: [] });
    }

    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    const items = values
      .filter(function (row) { return row[0]; })
      .map(rowToItem_)
      .sort(function (a, b) {
        const aTime = new Date(a.deliveryTime).getTime();
        const bTime = new Date(b.deliveryTime).getTime();
        const aSort = a.deliveryOption === 'other' || isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
        const bSort = b.deliveryOption === 'other' || isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
        return aSort - bSort;
      });

    return json_({ ok: true, items: items });
  } catch (error) {
    return json_({ ok: false, error: error.message || '讀取資料失敗。' });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const params = (e && e.parameter) || {};
    const action = String(params.action || 'create');
    if (action === 'update') {
      const sheet = getOrCreateSheet_();
      const id = clean_(params.id, 40);
      const status = clean_(params.status, 20);
      const deliveryReply = clean_(params.deliveryReply, 2000);
      if (!id) throw new Error('缺少任務編號。');
      if (WORK_STATUSES.indexOf(status) === -1) throw new Error('任務狀態不正確。');

      const row = findRequestRow_(sheet, id);
      if (!row) throw new Error('找不到此任務。');
      const updatedAt = new Date();
      sheet.getRange(row, 9, 1, 3).setValues([[status, safeCell_(deliveryReply), updatedAt]]);
      const item = rowToItem_(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
      return json_({ ok: true, item: item });
    }

    if (action !== 'create') {
      return json_({ ok: false, error: '不支援的操作。' });
    }

    const requester = clean_(params.requester, 40);
    const category = clean_(params.category, 10);
    const description = clean_(params.description, 800);
    const notes = clean_(params.notes, 500);
    const deliveryOption = String(params.deliveryOption || 'specified') === 'other' ? 'other' : 'specified';
    const deliveryTime = deliveryOption === 'other' ? null : new Date(String(params.deliveryTime || ''));

    if (!requester) throw new Error('請填寫填寫人。');
    if (CATEGORIES.indexOf(category) === -1) throw new Error('項目類別不正確。');
    if (!description) throw new Error('請填寫工作說明。');
    if (deliveryOption === 'specified' && isNaN(deliveryTime.getTime())) throw new Error('交付時間格式不正確。');

    const sheet = getOrCreateSheet_();
    const createdAt = new Date();
    const id = makeRequestId_(createdAt);
    sheet.appendRow([
      id,
      createdAt,
      safeCell_(requester),
      category,
      safeCell_(description),
      deliveryTime || '',
      safeCell_(notes),
      deliveryOption === 'other' ? '其他／待確認' : '指定時間',
      '待處理',
      '',
      createdAt,
    ]);

    const lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).sort({ column: 6, ascending: true });
    }

    return json_({
      ok: true,
      item: {
        id: id,
        createdAt: createdAt.toISOString(),
        requester: requester,
        category: category,
        description: description,
        deliveryTime: deliveryTime ? deliveryTime.toISOString() : '',
        deliveryOption: deliveryOption,
        notes: notes,
        status: '待處理',
        deliveryReply: '',
        updatedAt: createdAt.toISOString(),
      },
    });
  } catch (error) {
    return json_({ ok: false, error: error.message || '新增資料失敗。' });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function getOrCreateSheet_() {
  const spreadsheet = getConfiguredSpreadsheet_();

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some(function (header, index) {
    return currentHeaders[index] !== header;
  });

  if (needsHeaders && sheet.getLastRow() <= 1) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#16342f')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 155);
    sheet.setColumnWidth(2, 145);
    sheet.setColumnWidth(3, 130);
    sheet.setColumnWidth(4, 90);
    sheet.setColumnWidth(5, 360);
    sheet.setColumnWidth(6, 145);
    sheet.setColumnWidth(7, 300);
    sheet.setColumnWidth(8, 100);
    sheet.setColumnWidth(9, 100);
    sheet.setColumnWidth(10, 360);
    sheet.setColumnWidth(11, 145);
    sheet.getRange('B:B').setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange('F:F').setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange('K:K').setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange('A:K').setVerticalAlignment('middle').setWrap(true);
  } else if (needsHeaders && currentHeaders.slice(0, 7).every(function (header, index) { return header === HEADERS[index]; })) {
    const existingRows = Math.max(sheet.getLastRow() - 1, 0);
    sheet.getRange(1, 8, 1, 4).setValues([HEADERS.slice(7)])
      .setBackground('#16342f')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    if (existingRows > 0) {
      if (!currentHeaders[7]) sheet.getRange(2, 8, existingRows, 1).setValue('指定時間');
      if (!currentHeaders[8]) sheet.getRange(2, 9, existingRows, 1).setValue('待處理');
    }
    sheet.setColumnWidth(8, 100);
    sheet.setColumnWidth(9, 100);
    sheet.setColumnWidth(10, 360);
    sheet.setColumnWidth(11, 145);
    sheet.getRange('K:K').setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange('A:K').setVerticalAlignment('middle').setWrap(true);
  }

  return sheet;
}

function getConfiguredSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('尚未設定試算表。請先在 Apps Script 編輯器中執行 setupSpreadsheet。');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function rowToItem_(row) {
  return {
    id: String(row[0] || ''),
    createdAt: toIso_(row[1]),
    requester: String(row[2] || ''),
    category: String(row[3] || '其他'),
    description: String(row[4] || ''),
    deliveryTime: toIso_(row[5]),
    notes: String(row[6] || ''),
    deliveryOption: row[7] === 'other' || row[7] === '其他／待確認' || (!row[7] && !row[5]) ? 'other' : 'specified',
    status: WORK_STATUSES.indexOf(String(row[8] || '')) >= 0 ? String(row[8]) : '待處理',
    deliveryReply: String(row[9] || ''),
    updatedAt: toIso_(row[10] || row[1]),
  };
}

function findRequestRow_(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const finder = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(id))
    .matchEntireCell(true)
    .findNext();
  return finder ? finder.getRow() : 0;
}

function toIso_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? String(value || '') : parsed.toISOString();
}

function makeRequestId_(date) {
  const timezone = Session.getScriptTimeZone() || 'Asia/Taipei';
  const day = Utilities.formatDate(date, timezone, 'yyyyMMdd');
  const suffix = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return 'REQ-' + day + '-' + suffix;
}

function clean_(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeCell_(value) {
  const text = String(value || '');
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
