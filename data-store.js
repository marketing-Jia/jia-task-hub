(function () {
  "use strict";

  const STORAGE_KEY = "department-work-requests-v1";
  const TRACKED_IDS_KEY = "jia-tracked-request-ids-v1";
  const CATEGORIES = ["行銷", "行政", "營運", "業務", "其他"];
  const WORK_STATUSES = ["待處理", "進行中", "已完成"];

  function getConfig() {
    return window.APP_CONFIG || {};
  }

  function isRemoteMode() {
    return Boolean(String(getConfig().API_URL || "").trim());
  }

  function getMode() {
    return isRemoteMode() ? "remote" : "local";
  }

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("無法讀取本機資料", error);
      return [];
    }
  }

  function writeLocal(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function rememberRequestId(id) {
    if (!id) return;
    let ids = [];
    try {
      ids = JSON.parse(localStorage.getItem(TRACKED_IDS_KEY) || "[]");
      if (!Array.isArray(ids)) ids = [];
    } catch (error) {
      ids = [];
    }
    const next = [String(id), ...ids.filter((item) => item !== id)].slice(0, 20);
    localStorage.setItem(TRACKED_IDS_KEY, JSON.stringify(next));
  }

  function getTrackedRequestIds() {
    try {
      const ids = JSON.parse(localStorage.getItem(TRACKED_IDS_KEY) || "[]");
      return Array.isArray(ids) ? ids.map(String).slice(0, 20) : [];
    } catch (error) {
      return [];
    }
  }

  function generateId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const suffix = Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "0");
    return `REQ-${y}${m}${d}-${suffix}`;
  }

  function normalizeItem(item) {
    const deliveryTime = String(item.deliveryTime || item["交付時間"] || "");
    const rawDeliveryOption = String(item.deliveryOption || item["交付方式"] || (deliveryTime ? "specified" : "other"));
    return {
      id: String(item.id || item["編號"] || ""),
      createdAt: String(item.createdAt || item["建立時間"] || ""),
      requester: String(item.requester || item["填寫人"] || ""),
      category: String(item.category || item["項目類別"] || "其他"),
      title: String(item.title || item["工作標題"] || item.description || item["工作說明"] || ""),
      description: String(item.description || item["工作說明"] || ""),
      deliveryTime,
      deliveryOption: rawDeliveryOption === "other" || rawDeliveryOption === "其他／待確認" ? "other" : "specified",
      notes: String(item.notes || item["備註"] || ""),
      status: WORK_STATUSES.includes(String(item.status || item["狀態"] || ""))
        ? String(item.status || item["狀態"])
        : "待處理",
      deliveryReply: String(item.deliveryReply || item["交付回覆"] || ""),
      updatedAt: String(item.updatedAt || item["最後更新時間"] || item.createdAt || item["建立時間"] || ""),
    };
  }

  async function parseResponse(response) {
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error("後端回應格式不正確，請確認 Apps Script 部署網址。");
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "資料傳送失敗，請稍後再試。");
    }
    return payload;
  }

  async function createRequest(data) {
    if (!CATEGORIES.includes(data.category)) {
      throw new Error("項目類別不正確。");
    }
    if (!String(data.title || "").trim()) {
      throw new Error("請填寫工作標題。");
    }

    if (!isRemoteMode()) {
      const item = normalizeItem({
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        status: "待處理",
        deliveryReply: "",
      });
      const items = readLocal();
      items.push(item);
      writeLocal(items);
      rememberRequestId(item.id);
      await new Promise((resolve) => setTimeout(resolve, 350));
      return item;
    }

    const body = new URLSearchParams({
      action: "create",
      requester: data.requester,
      category: data.category,
      title: data.title,
      description: data.description,
      deliveryTime: data.deliveryTime,
      notes: data.notes || "",
      deliveryOption: data.deliveryOption || "specified",
    });
    const response = await fetch(getConfig().API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      redirect: "follow",
    });
    const payload = await parseResponse(response);
    const item = normalizeItem(payload.item || payload.data || {});
    rememberRequestId(item.id);
    return item;
  }

  async function listRequests() {
    if (!isRemoteMode()) {
      await new Promise((resolve) => setTimeout(resolve, 220));
      return readLocal().map(normalizeItem);
    }

    const url = new URL(getConfig().API_URL);
    url.searchParams.set("action", "list");
    url.searchParams.set("_", Date.now().toString());
    const response = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    const payload = await parseResponse(response);
    const items = payload.items || payload.data || [];
    return Array.isArray(items) ? items.map(normalizeItem) : [];
  }

  async function getRequest(id, requester = "") {
    const requestId = String(id || "").trim();
    const requesterName = String(requester || "").trim();
    if (!requestId) throw new Error("請輸入任務編號。");

    if (!isRemoteMode()) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      const item = readLocal().map(normalizeItem).find((request) => request.id === requestId);
      if (!item) throw new Error("找不到此任務，請確認編號是否正確。");
      if (requesterName && item.requester.toLocaleLowerCase("zh-Hant") !== requesterName.toLocaleLowerCase("zh-Hant")) {
        throw new Error("找不到符合任務編號與填寫人的任務，請確認後再試一次。");
      }
      rememberRequestId(item.id);
      return item;
    }

    const url = new URL(getConfig().API_URL);
    url.searchParams.set("action", "get");
    url.searchParams.set("id", requestId);
    if (requesterName) url.searchParams.set("requester", requesterName);
    url.searchParams.set("_", Date.now().toString());
    const response = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    const payload = await parseResponse(response);
    const item = normalizeItem(payload.item || payload.data || {});
    if (!item.id) throw new Error("找不到此任務，請確認編號是否正確。");
    rememberRequestId(item.id);
    return item;
  }

  async function updateRequest(id, changes) {
    const requestId = String(id || "").trim();
    const status = String(changes.status || "");
    const deliveryReply = String(changes.deliveryReply || "").trim();
    if (!requestId) throw new Error("缺少任務編號。");
    if (!WORK_STATUSES.includes(status)) throw new Error("任務狀態不正確。");

    if (!isRemoteMode()) {
      const items = readLocal().map(normalizeItem);
      const index = items.findIndex((item) => item.id === requestId);
      if (index < 0) throw new Error("找不到此任務。");
      items[index] = normalizeItem({
        ...items[index],
        status,
        deliveryReply,
        updatedAt: new Date().toISOString(),
      });
      writeLocal(items);
      await new Promise((resolve) => setTimeout(resolve, 220));
      return items[index];
    }

    const body = new URLSearchParams({
      action: "update",
      id: requestId,
      status,
      deliveryReply,
    });
    const response = await fetch(getConfig().API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      redirect: "follow",
    });
    const payload = await parseResponse(response);
    return normalizeItem(payload.item || payload.data || {});
  }

  window.RequestStore = Object.freeze({
    createRequest,
    listRequests,
    getRequest,
    updateRequest,
    getTrackedRequestIds,
    getMode,
    categories: CATEGORIES.slice(),
    workStatuses: WORK_STATUSES.slice(),
  });
})();
