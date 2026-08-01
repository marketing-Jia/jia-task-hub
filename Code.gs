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
const LEGACY_HEADERS = ['編號', '建立時間', '填寫人', '項目類別', '工作說明', '交付時間', '備註', '交付方式', '狀態', '交付回覆', '最後更新時間'];
const PREVIOUS_HEADERS = ['編號', '建立時間', '填寫人', '項目類別', '工作標題', '工作說明', '交付時間', '備註', '交付方式', '狀態', '交付回覆', '最後更新時間'];
const TIME_HEADERS = ['編號', '建立時間', '填寫人', '項目類別', '工作標題', '工作說明', '交付時間', '備註', '交付方式', '狀態', '交付回覆', '最後更新時間', '內部排程日期'];
const HEADERS = ['編號', '建立時間', '填寫人', '項目類別', '工作標題', '工作說明', '交付日期', '備註', '交付方式', '狀態', '交付回覆', '最後更新時間', '內部排程日期'];
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

/**
 * 在 Google Sheets 直接修改任務狀態或交付回覆時，自動更新最後更新時間。
 * 此函式為綁定試算表的簡易觸發條件，不需要另外建立觸發器。
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAME || range.getRow() < 2) return;

  const firstColumn = range.getColumn();
  const lastColumn = range.getLastColumn();
  const editedStatusOrReply = firstColumn <= 11 && lastColumn >= 10;
  const editedInternalSchedule = firstColumn <= 13 && lastColumn >= 13;
  if (!editedStatusOrReply && !editedInternalSchedule) return;

  sheet.getRange(range.getRow(), 12, range.getNumRows(), 1).setValue(new Date());
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'list');
    if (action !== 'list' && action !== 'get' && action !== 'findByRequester') {
      return json_({ ok: false, error: '不支援的操作。' });
    }

    const sheet = getOrCreateSheet_();
    if (action === 'get') {
      const id = clean_(e && e.parameter && e.parameter.id, 40);
      const requester = clean_(e && e.parameter && e.parameter.requester, 40);
      if (!id) return json_({ ok: false, error: '請提供任務編號。' });
      const row = findRequestRow_(sheet, id);
      if (!row) return json_({ ok: false, error: '找不到此任務，請確認編號是否正確。' });
      const item = rowToItem_(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
      if (requester && normalizeSearch_(item.requester) !== normalizeSearch_(requester)) {
        return json_({ ok: false, error: '找不到符合任務編號與填寫人的任務，請確認後再試一次。' });
      }
      return json_({ ok: true, item: toPublicItem_(item) });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return json_({ ok: true, items: [] });
    }

    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    if (action === 'findByRequester') {
      const requester = clean_(e && e.parameter && e.parameter.requester, 40);
      if (!requester) return json_({ ok: false, error: '請提供填寫人。' });
      const requesterItems = values
        .filter(function (row) { return row[0]; })
        .map(rowToItem_)
        .filter(function (item) { return normalizeSearch_(item.requester) === normalizeSearch_(requester); })
        .sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })
        .slice(0, 10)
        .map(toRequesterSummary_);
      return json_({ ok: true, items: requesterItems });
    }

    const items = values
      .filter(function (row) { return row[0]; })
      .map(rowToItem_)
      .sort(function (a, b) {
        const aTime = new Date(a.deliveryOption === 'other' ? a.internalScheduleTime : a.deliveryTime).getTime();
        const bTime = new Date(b.deliveryOption === 'other' ? b.internalScheduleTime : b.deliveryTime).getTime();
        const aSort = isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
        const bSort = isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
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
      const hasInternalScheduleTime = Object.prototype.hasOwnProperty.call(params, 'internalScheduleTime');
      const internalScheduleText = clean_(params.internalScheduleTime, 40);
      if (!id) throw new Error('缺少任務編號。');
      if (WORK_STATUSES.indexOf(status) === -1) throw new Error('任務狀態不正確。');

      const row = findRequestRow_(sheet, id);
      if (!row) throw new Error('找不到此任務。');
      const updatedAt = new Date();
      const currentValues = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
      let internalScheduleTime = currentValues[12] || '';
      if (hasInternalScheduleTime) {
        internalScheduleTime = internalScheduleText ? new Date(internalScheduleText) : '';
        if (internalScheduleText && isNaN(internalScheduleTime.getTime())) {
          throw new Error('內部排程日期格式不正確。');
        }
      }
      sheet.getRange(row, 10, 1, 4).setValues([[status, safeCell_(deliveryReply), updatedAt, internalScheduleTime]]);
      const item = rowToItem_(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
      return json_({ ok: true, item: item });
    }

    if (action !== 'create') {
      return json_({ ok: false, error: '不支援的操作。' });
    }

    const requester = clean_(params.requester, 40);
    const category = clean_(params.category, 10);
    const title = clean_(params.title, 120);
    const description = clean_(params.description, 800);
    const notes = clean_(params.notes, 500);
    const deliveryOption = String(params.deliveryOption || 'specified') === 'other' ? 'other' : 'specified';
    const deliveryTime = deliveryOption === 'other' ? null : new Date(String(params.deliveryTime || ''));

    if (!requester) throw new Error('請填寫填寫人。');
    if (CATEGORIES.indexOf(category) === -1) throw new Error('項目類別不正確。');
    if (!title) throw new Error('請填寫工作標題。');
    if (!description) throw new Error('請填寫工作說明。');
    if (deliveryOption === 'specified' && isNaN(deliveryTime.getTime())) throw new Error('交付日期格式不正確。');

    const sheet = getOrCreateSheet_();
    const createdAt = new Date();
    const id = makeRequestId_(createdAt);
    sheet.appendRow([
      id,
      createdAt,
      safeCell_(requester),
      category,
      safeCell_(title),
      safeCell_(description),
      deliveryTime || '',
      safeCell_(notes),
      deliveryOption === 'other' ? '其他／待確認' : '指定日期',
      '待處理',
      '',
      createdAt,
      '',
    ]);

    const lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).sort({ column: 7, ascending: true });
    }

    return json_({
      ok: true,
      item: {
        id: id,
        createdAt: createdAt.toISOString(),
        requester: requester,
        category: category,
        title: title,
        description: description,
        deliveryTime: deliveryTime ? deliveryTime.toISOString() : '',
        deliveryOption: deliveryOption,
        notes: notes,
        status: '待處理',
        deliveryReply: '',
        updatedAt: createdAt.toISOString(),
        internalScheduleTime: '',
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

  migrateHeaders_(sheet);
  formatSheet_(sheet);

  return sheet;
}

function migrateHeaders_(sheet) {
  const lastRow = sheet.getLastRow();
  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  const isCurrent = HEADERS.every(function (header, index) { return currentHeaders[index] === header; });
  if (isCurrent) return;

  const usesTimeHeader = TIME_HEADERS.every(function (header, index) { return currentHeaders[index] === header; });
  if (usesTimeHeader) {
    sheet.getRange(1, 7).setValue('交付日期');
    return;
  }

  const isPrevious = PREVIOUS_HEADERS.every(function (header, index) { return currentHeaders[index] === header; });
  if (isPrevious) {
    sheet.getRange(1, 7).setValue('交付日期');
    sheet.getRange(1, 13).setValue('內部排程日期');
    return;
  }

  if (lastRow <= 1 && currentHeaders.every(function (header) { return !header; })) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const hasLegacyPrefix = LEGACY_HEADERS.slice(0, 7).every(function (header, index) {
    return currentHeaders[index] === header;
  });
  if (!hasLegacyPrefix) {
    throw new Error('工作需求欄位結構不符，請勿調換前 13 欄；若需要協助，請先備份試算表。');
  }

  const existingRows = Math.max(lastRow - 1, 0);
  sheet.getRange(1, 8, 1, 4).setValues([LEGACY_HEADERS.slice(7)]);
  if (existingRows > 0) {
    if (!currentHeaders[7]) sheet.getRange(2, 8, existingRows, 1).setValue('指定日期');
    if (!currentHeaders[8]) sheet.getRange(2, 9, existingRows, 1).setValue('待處理');
  }

  sheet.insertColumnBefore(5);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (existingRows > 0) {
    const descriptions = sheet.getRange(2, 6, existingRows, 1).getDisplayValues();
    const titles = descriptions.map(function (row) {
      return [safeCell_(clean_(row[0], 120) || '既有任務')];
    });
    sheet.getRange(2, 5, existingRows, 1).setValues(titles);
  }
}

function formatSheet_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground('#16342f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  [155, 145, 130, 90, 220, 360, 145, 300, 100, 100, 360, 145, 155].forEach(function (width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
  sheet.getRange('B:B').setNumberFormat('yyyy/mm/dd hh:mm');
  sheet.getRange('G:G').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('L:L').setNumberFormat('yyyy/mm/dd hh:mm');
  sheet.getRange('M:M').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('A:M').setVerticalAlignment('middle').setWrap(true);

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(WORK_STATUSES, true)
    .setAllowInvalid(false)
    .setHelpText('請選擇：待處理、進行中或已完成')
    .build();
  const statusRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(2, 10, statusRows, 1).setDataValidation(statusRule);
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
    title: String(row[4] || row[5] || ''),
    description: String(row[5] || ''),
    deliveryTime: toIso_(row[6]),
    notes: String(row[7] || ''),
    deliveryOption: row[8] === 'other' || row[8] === '其他／待確認' || (!row[8] && !row[6]) ? 'other' : 'specified',
    status: WORK_STATUSES.indexOf(String(row[9] || '')) >= 0 ? String(row[9]) : '待處理',
    deliveryReply: String(row[10] || ''),
    updatedAt: toIso_(row[11] || row[1]),
    internalScheduleTime: toIso_(row[12]),
  };
}

function toPublicItem_(item) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    requester: item.requester,
    category: item.category,
    title: item.title,
    description: item.description,
    deliveryTime: item.deliveryTime,
    notes: item.notes,
    deliveryOption: item.deliveryOption,
    status: item.status,
    deliveryReply: item.deliveryReply,
    updatedAt: item.updatedAt,
  };
}

function toRequesterSummary_(item) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    requester: item.requester,
    category: item.category,
    title: item.title,
    deliveryTime: item.deliveryTime,
    deliveryOption: item.deliveryOption,
    status: item.status,
    updatedAt: item.updatedAt,
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

function normalizeSearch_(value) {
  return String(value || '').trim().toLowerCase();
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
