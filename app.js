(function () {
  "use strict";

  const form = document.querySelector("#request-form");
  const submitButton = document.querySelector("#submit-button");
  const successPanel = document.querySelector("#success-panel");
  const modeBadge = document.querySelector("#mode-badge");
  const toast = document.querySelector("#toast");
  const description = document.querySelector("#description");
  const notes = document.querySelector("#notes");
  const deliveryTime = document.querySelector("#delivery-time");
  const deliveryTimeShell = document.querySelector("#delivery-time-shell");
  const otherTimeMessage = document.querySelector("#other-time-message");
  const deliveryTimeHint = document.querySelector("#delivery-time-hint");
  const deliveryOptions = Array.from(document.querySelectorAll("input[name='deliveryOption']"));

  function setMinimumDeliveryTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 30);
    deliveryTime.min = now.toISOString().slice(0, 16);
  }

  function updateCount(input, targetId, max) {
    document.querySelector(targetId).textContent = `${input.value.length} / ${max}`;
  }

  function updateDeliveryOption() {
    const option = deliveryOptions.find((input) => input.checked)?.value || "specified";
    const isOther = option === "other";
    deliveryTime.disabled = isOther;
    deliveryTime.required = !isOther;
    deliveryTimeShell.hidden = isOther;
    otherTimeMessage.hidden = !isOther;
    deliveryTimeHint.hidden = isOther;
    if (isOther) {
      deliveryTime.value = "";
      deliveryTime.removeAttribute("aria-invalid");
      document.querySelector("#deliveryTime-error").textContent = "";
    }
  }

  function showToast(message, type = "error") {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }

  function clearErrors() {
    form.querySelectorAll(".field-error").forEach((node) => (node.textContent = ""));
    form.querySelectorAll("[aria-invalid='true']").forEach((node) => node.removeAttribute("aria-invalid"));
  }

  function setError(name, message) {
    const input = form.elements[name];
    const error = document.querySelector(`#${name}-error`);
    if (input) input.setAttribute("aria-invalid", "true");
    if (error) error.textContent = message;
  }

  function validate(data) {
    clearErrors();
    let valid = true;
    if (!data.requester) {
      setError("requester", "請輸入填寫人姓名。");
      valid = false;
    }
    if (!data.category) {
      setError("category", "請選擇項目類別。");
      valid = false;
    }
    if (!data.title) {
      setError("title", "請填寫工作標題。");
      valid = false;
    } else if (data.title.length < 2) {
      setError("title", "工作標題請至少輸入 2 個字。");
      valid = false;
    }
    if (!data.description) {
      setError("description", "請填寫工作說明。");
      valid = false;
    } else if (data.description.length < 8) {
      setError("description", "請至少輸入 8 個字，讓需求更清楚。");
      valid = false;
    }
    if (data.deliveryOption !== "other" && !data.deliveryTime) {
      setError("deliveryTime", "請選擇交付時間。");
      valid = false;
    } else if (data.deliveryOption !== "other" && new Date(data.deliveryTime).getTime() <= Date.now()) {
      setError("deliveryTime", "交付時間需晚於目前時間。");
      valid = false;
    }
    return valid;
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.classList.toggle("is-loading", isLoading);
    submitButton.querySelector("span").textContent = isLoading ? "正在交給 Jia…" : "把任務交給 Jia";
  }

  function readForm() {
    const values = new FormData(form);
    const deliveryOption = String(values.get("deliveryOption") || "specified");
    const deliveryValue = String(deliveryTime.value || "");
    return {
      requester: String(values.get("requester") || "").trim(),
      category: String(values.get("category") || "").trim(),
      title: String(values.get("title") || "").trim(),
      description: String(values.get("description") || "").trim(),
      deliveryOption,
      deliveryTime: deliveryOption === "other" ? "" : new Date(deliveryValue).toISOString(),
      notes: String(values.get("notes") || "").trim(),
    };
  }

  function readFormForValidation() {
    const values = new FormData(form);
    return {
      requester: String(values.get("requester") || "").trim(),
      category: String(values.get("category") || "").trim(),
      title: String(values.get("title") || "").trim(),
      description: String(values.get("description") || "").trim(),
      deliveryOption: String(values.get("deliveryOption") || "specified"),
      deliveryTime: String(deliveryTime.value || ""),
      notes: String(values.get("notes") || "").trim(),
    };
  }

  function showSuccess(item) {
    form.hidden = true;
    successPanel.hidden = false;
    document.querySelector("#success-id").textContent = item.id || "已建立";
    document.querySelector("#track-request-link").href = `./status.html?id=${encodeURIComponent(item.id || "")}`;
    successPanel.focus();
  }

  function resetForm() {
    form.reset();
    clearErrors();
    updateCount(description, "#description-count", 800);
    updateCount(notes, "#notes-count", 500);
    successPanel.hidden = true;
    form.hidden = false;
    setMinimumDeliveryTime();
    updateDeliveryOption();
    document.querySelector("#requester").focus();
  }

  modeBadge.textContent = RequestStore.getMode() === "remote" ? "Google Sheets 已連線" : "預覽模式";
  modeBadge.classList.toggle("is-demo", RequestStore.getMode() !== "remote");
  setMinimumDeliveryTime();
  updateDeliveryOption();

  description.addEventListener("input", () => updateCount(description, "#description-count", 800));
  notes.addEventListener("input", () => updateCount(notes, "#notes-count", 500));
  deliveryOptions.forEach((input) => input.addEventListener("change", updateDeliveryOption));

  form.addEventListener("input", (event) => {
    if (event.target.getAttribute("aria-invalid") === "true") {
      event.target.removeAttribute("aria-invalid");
      const error = document.querySelector(`#${event.target.name}-error`);
      if (error) error.textContent = "";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const validationData = readFormForValidation();
    if (!validate(validationData)) {
      form.querySelector("[aria-invalid='true']")?.focus();
      return;
    }

    try {
      setLoading(true);
      const item = await RequestStore.createRequest(readForm());
      showSuccess(item);
    } catch (error) {
      showToast(error.message || "送出失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  });

  document.querySelector("#new-request-button").addEventListener("click", resetForm);
})();
