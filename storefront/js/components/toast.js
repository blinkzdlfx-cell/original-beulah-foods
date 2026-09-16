let container;

function ensureContainer() {
  if (container?.isConnected) return container;
  container = document.createElement("div");
  container.className = "beulah-toast-container";
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-atomic", "true");
  document.body.append(container);
  return container;
}

export function showToast(message, type = "success", duration = 2800) {
  const text = String(message || "").trim();
  if (!text) return;
  const root = ensureContainer();
  const toast = document.createElement("div");
  toast.className = `beulah-toast beulah-toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const icon = document.createElement("span");
  icon.className = "beulah-toast__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "error" ? "!" : type === "warning" ? "!" : "✓";

  const copy = document.createElement("span");
  copy.className = "beulah-toast__message";
  copy.textContent = text;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "beulah-toast__close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";

  toast.append(icon, copy, close);
  root.append(toast);

  let timer = window.setTimeout(dismiss, duration);
  close.addEventListener("click", dismiss);

  function dismiss() {
    window.clearTimeout(timer);
    toast.classList.add("beulah-toast--leaving");
    window.setTimeout(() => toast.remove(), 180);
  }
}
