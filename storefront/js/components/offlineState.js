const OFFLINE_BANNER_ID = "beulah-offline-banner";
const OFFLINE_CSS_HREF = "/storefront/css/offline-state.css?v=offline-1";
let onlineTimer = null;

function ensureStyles() {
  if (document.querySelector('link[data-beulah-offline-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = OFFLINE_CSS_HREF;
  link.dataset.beulahOfflineStyles = "true";
  document.head.append(link);
}

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
  ensureStyles();

  window.addEventListener("offline", () => setConnectionState(false));
  window.addEventListener("online", () => setConnectionState(true, true));

  if (!navigator.onLine) setConnectionState(false);
  registerServiceWorker();
}
