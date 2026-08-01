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
      document.querySelector("#tracking-error-copy").textContent = error.message || "請確認任務編號後再試一次。";
      errorPanel.hidden = false;
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
    lookup(input.value, requesterInput.value);
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
