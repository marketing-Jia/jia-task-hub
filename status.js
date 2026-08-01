(function () {
  "use strict";

  const form = document.querySelector("#tracking-search-form");
  const input = document.querySelector("#tracking-id");
  const requesterInput = document.querySelector("#tracking-requester-search");
  const submitButton = document.querySelector("#tracking-submit");
  const refreshButton = document.querySelector("#tracking-refresh");
  const loading = document.querySelector("#tracking-loading");
  const result = document.querySelector("#tracking-result");
  const errorPanel = document.querySelector("#tracking-error");
  const recentSection = document.querySelector("#recent-requests");
  const requesterResults = document.querySelector("#requester-results");
  const requesterTaskList = document.querySelector("#requester-task-list");

  function formatDate(value, withTime = true) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    }).format(date);
  }

  function formatDue(item) {
    if (item.deliveryOption === "other" || !item.deliveryTime) return "其他／待確認";
    return formatDate(item.deliveryTime);
  }

  function setText(selector, value) {
    document.querySelector(selector).textContent = value || "—";
  }

  function showError(message) {
    document.querySelector("#tracking-error-copy").textContent = message;
    errorPanel.hidden = false;
  }

  function workStatusClass(status) {
    if (status === "已完成") return "completed";
    if (status === "進行中") return "in-progress";
    return "pending";
  }

  function updateProgress(status) {
    const order = ["待處理", "進行中", "已完成"];
    const currentIndex = Math.max(0, order.indexOf(status));
    document.querySelectorAll("#tracking-progress li").forEach((step, index) => {
      step.classList.toggle("is-complete", index < currentIndex);
      step.classList.toggle("is-current", index === currentIndex);
    });
  }

  function renderItem(item) {
    setText("#tracking-title", item.title);
    setText("#tracking-description", item.description);
    setText("#tracking-result-id", item.id);
    setText("#tracking-status", item.status);
    setText("#tracking-requester", item.requester);
    setText("#tracking-category", item.category);
    setText("#tracking-due", formatDue(item));
    setText("#tracking-created", formatDate(item.createdAt));
    setText("#tracking-updated", formatDate(item.updatedAt || item.createdAt));

    const statusBadge = document.querySelector("#tracking-status");
    statusBadge.className = `work-status-badge ${item.status === "已完成" ? "completed" : item.status === "進行中" ? "in-progress" : "pending"}`;

    const notesWrap = document.querySelector("#tracking-notes-wrap");
    notesWrap.hidden = !item.notes;
    setText("#tracking-notes", item.notes);

    const reply = document.querySelector("#tracking-reply");
    reply.textContent = item.deliveryReply || "Jia 尚未提供交付回覆，更新後會顯示在這裡。";
    reply.classList.toggle("is-empty", !item.deliveryReply);
    updateProgress(item.status);
  }

  function setLoading(isLoading) {
    loading.hidden = !isLoading;
    submitButton.disabled = isLoading;
    refreshButton.disabled = isLoading;
    submitButton.textContent = isLoading ? "查詢中…" : "查詢任務";
  }

  async function lookup(id, requester = "", updateUrl = true) {
    const requestId = String(id || "").trim().toUpperCase();
    const requesterName = String(requester || "").trim();
    if (!requestId) return;
    input.value = requestId;
    requesterInput.value = requesterName;
    result.hidden = true;
    errorPanel.hidden = true;
    recentSection.hidden = true;
    requesterResults.hidden = true;
    setLoading(true);

    try {
      const item = await RequestStore.getRequest(requestId, requesterName);
      renderItem(item);
      result.hidden = false;
      if (updateUrl && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("id", item.id);
          window.history.replaceState({}, "", url);
        } catch (ignore) {}
      }
    } catch (error) {
      showError(error.message || "請確認任務編號後再試一次。");
    } finally {
      setLoading(false);
    }
  }

  function renderRequesterItems(items, requesterName) {
    requesterTaskList.replaceChildren();
    document.querySelector("#requester-results-title").textContent = `${requesterName} 的近期任務`;
    document.querySelector("#requester-results-count").textContent = `共 ${items.length} 筆`;

    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "requester-task-item";
      button.setAttribute("aria-label", `查看任務 ${item.title}，狀態 ${item.status}`);

      const summary = document.createElement("span");
      summary.className = "requester-task-summary";
      const title = document.createElement("strong");
      title.textContent = item.title || "未命名任務";
      const meta = document.createElement("small");
      meta.textContent = `${item.category}・建立於 ${formatDate(item.createdAt, false)}`;
      const id = document.createElement("code");
      id.textContent = item.id;
      summary.append(title, meta, id);

      const status = document.createElement("span");
      status.className = `work-status-badge ${workStatusClass(item.status)}`;
      status.textContent = item.status;
      button.append(summary, status);
      button.addEventListener("click", () => lookup(item.id, requesterName));
      requesterTaskList.appendChild(button);
    });
  }

  async function recoverByRequester(requester) {
    const requesterName = String(requester || "").trim();
    if (!requesterName) {
      showError("忘記任務編號時，請輸入填寫人。");
      return;
    }

    input.value = "";
    requesterInput.value = requesterName;
    result.hidden = true;
    errorPanel.hidden = true;
    recentSection.hidden = true;
    requesterResults.hidden = true;
    setLoading(true);

    try {
      const items = await RequestStore.findRequestsByRequester(requesterName);
      if (!items.length) {
        showError("找不到這位填寫人的近期任務，請確認輸入內容與送出表單時完全相同。");
        return;
      }
      renderRequesterItems(items, requesterName);
      requesterResults.hidden = false;
      if (window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("id");
          url.searchParams.delete("requester");
          window.history.replaceState({}, "", url);
        } catch (ignore) {}
      }
    } catch (error) {
      showError(error.message || "無法找回任務，請稍後再試一次。");
    } finally {
      setLoading(false);
    }
  }

  function renderRecentIds() {
    const ids = RequestStore.getTrackedRequestIds();
    const container = document.querySelector("#recent-id-list");
    container.replaceChildren();
    if (!ids.length) {
      recentSection.hidden = true;
      return;
    }
    ids.forEach((id) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = id;
      button.addEventListener("click", () => lookup(id, requesterInput.value));
      container.appendChild(button);
    });
    recentSection.hidden = false;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const requestId = input.value.trim();
    const requesterName = requesterInput.value.trim();
    if (requestId) {
      lookup(requestId, requesterName);
    } else if (requesterName) {
      recoverByRequester(requesterName);
    } else {
      result.hidden = true;
      requesterResults.hidden = true;
      recentSection.hidden = true;
      showError("請輸入任務編號，或輸入填寫人找回近期任務。");
    }
  });

  refreshButton.addEventListener("click", () => {
    lookup(input.value, requesterInput.value, false);
  });

  const initialParams = new URLSearchParams(window.location.search);
  const initialId = initialParams.get("id");
  const initialRequester = initialParams.get("requester") || "";
  if (initialId) lookup(initialId, initialRequester, false);
  else renderRecentIds();
})();
