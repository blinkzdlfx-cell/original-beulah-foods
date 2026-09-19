const OFFLINE_BANNER_ID = "beulah-offline-banner";
let onlineTimer = null;

function getBanner() {
  let banner = document.getElementById(OFFLINE_BANNER_ID);
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = OFFLINE_BANNER_ID;
  banner.className = "beulah-offline-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = '<span class="beulah-offline-banner__dot" aria-hidden="true"></span><span class="beulah-offline-banner__text"></span>';
  document.body.append(banner);
  return banner;
}

function setConnectionState(online, restored = false) {
  const banner = getBanner();
  const text = banner.querySelector(".beulah-offline-banner__text");

  if (!online) {
    window.clearTimeout(onlineTimer);
    text.textContent = "You're offline. Some Beulah Foods features may be unavailable.";
    banner.classList.add("is-visible", "is-offline");
    banner.classList.remove("is-restored");
    return;
  }

  if (!restored) {
    banner.classList.remove("is-visible", "is-offline", "is-restored");
    return;
  }

  text.textContent = "Connection restored.";
  banner.classList.add("is-visible", "is-restored");
  banner.classList.remove("is-offline");
  window.clearTimeout(onlineTimer);
  onlineTimer = window.setTimeout(() => {
    banner.classList.remove("is-visible", "is-restored");
  }, 2400);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

export function initOfflineState() {
  if (window.__beulahOfflineInitialized) return;
  window.__beulahOfflineInitialized = true;

  window.addEventListener("offline", () => setConnectionState(false));
  window.addEventListener("online", () => setConnectionState(true, true));

  if (!navigator.onLine) setConnectionState(false);
  registerServiceWorker();
}
