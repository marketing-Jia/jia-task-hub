(function () {
  "use strict";

  const state = {
    items: [],
    search: "",
    category: "all",
    status: "all",
    workStatus: "all",
    direction: "asc",
  };

  const tbody = document.querySelector("#request-tbody");
  const mobileList = document.querySelector("#mobile-request-list");
  const emptyState = document.querySelector("#empty-state");
  const toast = document.querySelector("#toast");

  const categoryClass = {
    行銷: "marketing",
    行政: "admin",
    營運: "operations",
    業務: "sales",
    其他: "other",
  };

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[char]);
  }

  function showToast(message, type = "error") {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => (toast.hidden = true), 4200);
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function getPlanningDate(item) {
    const value = item.deliveryOption === "other" ? item.internalScheduleTime : item.deliveryTime;
    return new Date(value);
  }

  function getScheduleStatus(item) {
    const due = getPlanningDate(item);
    const now = new Date();
    if (Number.isNaN(due.getTime())) return "unscheduled";
    if (dateKey(due) === dateKey(now)) return "today";
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dueDate < today) return "overdue";
    const sevenDays = new Date(today);
    sevenDays.setDate(sevenDays.getDate() + 7);
    return dueDate <= sevenDays ? "upcoming" : "later";
  }

  function formatDue(item) {
    const date = getPlanningDate(item);
    if (Number.isNaN(date.getTime())) return { date: "其他／待確認", source: "尚未安排" };
    return {
      date: new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).format(date),
      source: item.deliveryOption === "other" ? "內部排程" : "交付日期",
    };
  }

  function toDateInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function statusLabel(status) {
    return { overdue: "已逾期", today: "今日到期", upcoming: "近期", later: "排程中", unscheduled: "待確認" }[status];
  }

  function workStatusClass(status) {
    if (status === "已完成") return "completed";
    if (status === "進行中") return "in-progress";
    return "pending";
  }

  function filteredItems() {
    const query = state.search.toLocaleLowerCase("zh-Hant");
    return state.items
      .filter((item) => state.category === "all" || item.category === state.category)
      .filter((item) => state.status === "all" || getScheduleStatus(item) === state.status)
      .filter((item) => state.workStatus === "all" || item.status === state.workStatus)
      .filter((item) => {
        if (!query) return true;
        return [item.requester, item.title, item.description, item.notes, item.id]
          .join(" ")
          .toLocaleLowerCase("zh-Hant")
          .includes(query);
      })
      .sort((a, b) => {
        const firstTime = getPlanningDate(a).getTime();
        const secondTime = getPlanningDate(b).getTime();
        const firstUnscheduled = Number.isNaN(firstTime);
        const secondUnscheduled = Number.isNaN(secondTime);
        if (firstUnscheduled !== secondUnscheduled) return firstUnscheduled ? 1 : -1;
        const first = firstUnscheduled ? 0 : firstTime;
        const second = secondUnscheduled ? 0 : secondTime;
        return state.direction === "asc" ? first - second : second - first;
      });
  }

  function dueHTML(item) {
    const due = formatDue(item);
    const status = getScheduleStatus(item);
    return `<div class="due-cell"><strong>${escapeHTML(due.date)}</strong><span>${escapeHTML(due.source)}</span><em class="due-status ${status}">${statusLabel(status)}</em></div>`;
  }

  function renderTable(items) {
    tbody.innerHTML = items
      .map((item) => `
        <tr>
          <td>${dueHTML(item)}</td>
          <td><span class="work-status-badge ${workStatusClass(item.status)}">${escapeHTML(item.status)}</span></td>
          <td><span class="category-badge ${categoryClass[item.category] || "other"}">${escapeHTML(item.category)}</span></td>
          <td><div class="description-cell"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></div></td>
          <td><span class="requester-cell">${escapeHTML(item.requester)}</span></td>
          <td><span class="notes-cell" title="${escapeHTML(item.notes)}">${escapeHTML(item.notes || "—")}</span></td>
          <td><div class="task-actions-cell"><code>${escapeHTML(item.id || "—")}</code><button type="button" data-manage-task="${escapeHTML(item.id)}">處理／回覆</button></div></td>
        </tr>`)
      .join("");
  }

  function renderMobile(items) {
    mobileList.innerHTML = items
      .map((item) => {
        const due = formatDue(item);
        const status = getScheduleStatus(item);
        return `<article class="mobile-request-card">
          <div class="mobile-card-top">
            <div class="mobile-card-statuses"><span class="category-badge ${categoryClass[item.category] || "other"}">${escapeHTML(item.category)}</span><span class="work-status-badge ${workStatusClass(item.status)}">${escapeHTML(item.status)}</span></div>
            <em class="due-status ${status}">${statusLabel(status)}</em>
          </div>
          <h3>${escapeHTML(item.title)}</h3>
          <div class="mobile-card-meta">
            <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 4v3M17.25 4v3M4.75 9h14.5M6.25 5.75h11.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H6.25a1.5 1.5 0 0 1-1.5-1.5v-11a1.5 1.5 0 0 1 1.5-1.5Z" /></svg>${escapeHTML(due.source)}：${escapeHTML(due.date)}</span>
            <span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.75 19c.55-3.15 2.64-5 6.25-5s5.7 1.85 6.25 5" /></svg>${escapeHTML(item.requester)}</span>
          </div>
          ${item.description ? `<p class="mobile-card-notes">${escapeHTML(item.description)}</p>` : ""}
          ${item.notes ? `<p class="mobile-card-notes"><strong>備註：</strong>${escapeHTML(item.notes)}</p>` : ""}
          <div class="mobile-task-actions"><code>${escapeHTML(item.id || "—")}</code><button type="button" data-manage-task="${escapeHTML(item.id)}">處理／回覆</button></div>
        </article>`;
      })
      .join("");
  }

  function updateSummary() {
    const counts = { overdue: 0, today: 0, upcoming: 0 };
    state.items.forEach((item) => {
      if (item.status === "已完成") return;
      const status = getScheduleStatus(item);
      if (Object.hasOwn(counts, status)) counts[status] += 1;
    });
    document.querySelector("#summary-total").textContent = state.items.length;
    document.querySelector("#summary-overdue").textContent = counts.overdue;
    document.querySelector("#summary-today").textContent = counts.today;
    document.querySelector("#summary-upcoming").textContent = counts.upcoming;
  }

  function render() {
    const items = filteredItems();
    renderTable(items);
    renderMobile(items);
    updateSummary();
    document.querySelector("#result-count").textContent = `共 ${items.length} 筆`;
    emptyState.hidden = items.length !== 0;
    document.querySelector("#empty-copy").textContent = state.items.length
      ? "請調整搜尋文字或篩選條件後再試一次。"
      : "發送第一個任務給 Jia 後，協作項目就會出現在這裡。";
  }

  function updateConnection() {
    const remote = RequestStore.getMode() === "remote";
    document.querySelector("#connection-dot").classList.toggle("demo", !remote);
    document.querySelector("#connection-title").textContent = remote ? "Google Sheets 已連線" : "本機預覽模式";
    document.querySelector("#connection-detail").textContent = remote ? "資料即時同步" : "資料僅存此瀏覽器";
  }

  async function loadData() {
    const button = document.querySelector("#refresh-button");
    button.disabled = true;
    button.classList.add("is-loading");
    try {
      state.items = await RequestStore.listRequests();
      render();
      const now = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      document.querySelector("#last-updated").textContent = `更新於 ${now}`;
    } catch (error) {
      showToast(error.message || "無法載入資料，請稍後再試。");
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }

  function findItem(id) {
    return state.items.find((item) => item.id === id);
  }

  function openTaskModal(id) {
    const item = findItem(id);
    if (!item) {
      showToast("找不到此任務，請重新整理後再試。");
      return;
    }
    document.querySelector("#modal-request-id").value = item.id;
    document.querySelector("#modal-task-id").textContent = item.id;
    document.querySelector("#modal-task-title").textContent = item.title;
    document.querySelector("#modal-task-description").textContent = item.description;
    document.querySelector("#modal-task-requester").textContent = `${item.requester}・${item.category}`;
    document.querySelector("#modal-task-status").value = item.status;
    const internalScheduleGroup = document.querySelector("#modal-internal-schedule-group");
    const internalScheduleInput = document.querySelector("#modal-internal-schedule-time");
    internalScheduleGroup.hidden = item.deliveryOption !== "other";
    internalScheduleInput.value = item.deliveryOption === "other" ? toDateInput(item.internalScheduleTime) : "";
    document.querySelector("#modal-delivery-reply").value = item.deliveryReply || "";
    document.querySelector("#reply-count").textContent = `${(item.deliveryReply || "").length} / 2000`;
    document.querySelector("#modal-tracking-link").href = `./status.html?id=${encodeURIComponent(item.id)}`;
    document.querySelector("#task-modal").hidden = false;
    document.body.classList.add("modal-open");
    document.querySelector("#modal-task-status").focus();
  }

  function closeTaskModal() {
    document.querySelector("#task-modal").hidden = true;
    document.body.classList.remove("modal-open");
  }

  async function saveTaskUpdate(event) {
    event.preventDefault();
    const id = document.querySelector("#modal-request-id").value;
    const status = document.querySelector("#modal-task-status").value;
    const internalScheduleValue = document.querySelector("#modal-internal-schedule-time").value;
    const internalScheduleTime = internalScheduleValue ? new Date(`${internalScheduleValue}T00:00:00`).toISOString() : "";
    const deliveryReply = document.querySelector("#modal-delivery-reply").value.trim();
    const button = document.querySelector("#save-task-button");
    button.disabled = true;
    button.textContent = "儲存中…";
    try {
      const updated = await RequestStore.updateRequest(id, { status, deliveryReply, internalScheduleTime });
      const index = state.items.findIndex((item) => item.id === id);
      if (index >= 0) state.items[index] = updated;
      render();
      closeTaskModal();
      showToast("任務排程、進度與回覆已更新。", "success");
    } catch (error) {
      showToast(error.message || "無法更新任務，請稍後再試。");
    } finally {
      button.disabled = false;
      button.textContent = "儲存排程、進度與回覆";
    }
  }

  document.querySelector("#search-input").addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });
  document.querySelector("#category-filter").addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });
  document.querySelector("#status-filter").addEventListener("change", (event) => {
    state.status = event.target.value;
    render();
  });
  document.querySelector("#work-status-filter").addEventListener("change", (event) => {
    state.workStatus = event.target.value;
    render();
  });
  document.querySelector("#sort-button").addEventListener("click", (event) => {
    state.direction = state.direction === "asc" ? "desc" : "asc";
    const button = event.currentTarget;
    button.dataset.direction = state.direction;
    document.querySelector("#sort-label").textContent = state.direction === "asc" ? "排程日期：近到遠" : "排程日期：遠到近";
    render();
  });
  document.querySelector("#refresh-button").addEventListener("click", loadData);
  document.querySelector("#task-update-form").addEventListener("submit", saveTaskUpdate);
  document.querySelector("#modal-delivery-reply").addEventListener("input", (event) => {
    document.querySelector("#reply-count").textContent = `${event.target.value.length} / 2000`;
  });
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeTaskModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector("#task-modal").hidden) closeTaskModal();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-manage-task]");
    if (button) openTaskModal(button.dataset.manageTask);
  });

  updateConnection();
  loadData();
})();
