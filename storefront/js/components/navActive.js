const ACTIVE_PATHS = new Map([
  ["home", new Set(["/", "/index"])],
  ["shop", new Set(["/shop", "/product"])],
  ["cart", new Set(["/cart", "/checkout", "/payment-callback"])],
]);

function ensureStyles() {
  if (document.getElementById("beulah-active-nav-styles")) return;
  const style = document.createElement("style");
  style.id = "beulah-active-nav-styles";
  style.textContent = `
    .site-header__links > a.is-active { position:relative; color:var(--color-text); }
    .site-header__links > a.is-active::after { content:""; position:absolute; left:11px; right:11px; bottom:2px; height:2px; border-radius:999px; background:var(--color-accent); }
    .site-header__menu-link.is-active { background:var(--color-accent-soft) !important; color:var(--color-accent-dark) !important; }
  `;
  document.head.append(style);
}

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.replace(/\.html$/, "");
}

function updateActiveNavigation() {
  const nav = document.getElementById("site-header-nav");
  if (!nav) return;
  const current = normalizePath(window.location.pathname);
  let activeKey = null;
  for (const [key, paths] of ACTIVE_PATHS) {
    if (paths.has(current)) {
      activeKey = key;
      break;
    }
  }

  nav.querySelectorAll("a").forEach((link) => {
    const path = normalizePath(new URL(link.href, window.location.origin).pathname);
    let key = null;
    if (path === "/" || path === "/index") key = "home";
    else if (path === "/shop" || path === "/product") key = "shop";
    else if (path === "/cart") key = "cart";
    const active = Boolean(activeKey && key === activeKey);
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function init() {
  ensureStyles();
  updateActiveNavigation();
  const nav = document.getElementById("site-header-nav");
  if (!nav) return;
  new MutationObserver(updateActiveNavigation).observe(nav, { childList: true, subtree: true });
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
