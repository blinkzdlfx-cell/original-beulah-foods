import { getCurrentSession, onAuthStateChange, signOutCustomer } from "../services/authService.js";
import { getCartItemCount, onCartChange } from "../services/cartService.js";

const page = (name) => `/${name}`;

function ensureStyles() {
  if (document.getElementById("beulah-header-responsive-styles")) return;

  const favicon = document.querySelector('link[rel="icon"]') || document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/webp";
  favicon.href = "/assets/favicon.webp";
  if (!favicon.parentNode) document.head.append(favicon);

  const style = document.createElement("style");
  style.id = "beulah-header-responsive-styles";
  style.textContent = `
    .site-header__nav { position:relative; margin-left:auto; display:flex; align-items:center; gap:12px; }
    .site-header__links { display:flex; align-items:center; gap:3px; }
    .site-header__links a, .site-header__links button { padding:8px 11px; border-radius:7px; color:var(--color-text-muted); font-size:.9rem; font-weight:600; text-decoration:none; }
    .site-header__links a:hover, .site-header__links button:hover { background:var(--color-surface-subtle); color:var(--color-text); }
    .site-header__links .site-header__logout { border:0; background:transparent; font:inherit; cursor:pointer; text-align:left; }
    .site-header__cart-link { position:relative; display:inline-flex; align-items:center; gap:7px; }
    .site-header__cart-link svg,.site-header__account-button svg { width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
    .site-header__cart-count { min-width:18px; height:18px; padding:0 4px; display:grid; place-items:center; border-radius:999px; background:var(--color-accent); color:var(--color-accent-ink); font-size:.68rem; font-weight:800; }
    .site-header__account { position:relative; }
    .site-header__account-button { display:inline-flex !important; align-items:center; gap:7px; border:1px solid transparent; background:transparent; cursor:pointer; }
    .site-header__account-button[aria-expanded="true"] { border-color:var(--color-border); background:var(--color-surface-subtle); color:var(--color-text); }
    .site-header__account-menu { position:absolute; top:calc(100% + 10px); right:0; width:220px; display:grid; gap:3px; padding:8px; border:1px solid var(--color-border); border-radius:12px; background:var(--color-surface); box-shadow:var(--shadow-md); z-index:110; }
    .site-header__account-menu[hidden] { display:none !important; }
    .site-header__account-menu > a, .site-header__account-menu > button { display:flex; width:100%; min-height:44px; align-items:center; padding:10px 12px; border-radius:8px; color:var(--color-text) !important; text-decoration:none; }
    .site-header__account-menu > a:hover, .site-header__account-menu > a:focus-visible, .site-header__account-menu > button:hover, .site-header__account-menu > button:focus-visible { background:var(--color-accent-soft) !important; color:var(--color-accent-dark) !important; }
    .site-header__account-divider { height:1px; margin:5px 4px; background:var(--color-border); }
    .site-header__menu-toggle { display:none; width:42px; height:42px; padding:9px; flex-direction:column; justify-content:center; gap:5px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-surface); color:var(--color-text); cursor:pointer; }
    .site-header__menu-toggle:hover { border-color:var(--color-accent); background:var(--color-bg); }
    .site-header__menu-toggle span { display:block; width:100%; height:2px; border-radius:99px; background:currentColor; }
    .site-header__menu { position:absolute; top:calc(100% + 10px); right:0; width:min(320px,calc(100vw - 32px)); display:grid; grid-template-columns:1fr; gap:3px; padding:10px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); box-shadow:var(--shadow-md); z-index:100; }
    .site-header__menu[hidden] { display:none !important; }
    .site-header__menu > a, .site-header__menu > button { display:flex; visibility:visible; opacity:1; }
    .site-header__menu-link { align-items:center; width:100%; min-height:46px; padding:11px 12px; border-radius:9px; color:var(--color-text) !important; text-decoration:none; }
    .site-header__menu-link:hover, .site-header__menu-link:focus-visible { background:var(--color-accent-soft) !important; color:var(--color-accent-dark) !important; }
    .site-header__menu .site-header__cart-link { justify-content:flex-start; margin:0; border:0; background:transparent; border-radius:9px; gap:10px; box-shadow:none; }
    .site-header__cart-label { display:inline; }
    .site-header__menu .site-header__logout { border:0; background:transparent; font:inherit; text-align:left; cursor:pointer; }
    .site-header__menu-divider { height:1px; margin:6px 4px; background:var(--color-border); }
    .logout-modal { position:fixed; inset:0; z-index:200; display:grid; place-items:center; padding:20px; }
    .logout-modal[hidden] { display:none; }
    .logout-modal__backdrop { position:absolute; inset:0; background:rgba(15,23,19,.42); backdrop-filter:blur(3px); }
    .logout-modal__dialog { position:relative; width:min(420px,100%); padding:24px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); box-shadow:0 24px 70px rgba(16,24,20,.20); }
    .logout-modal__icon { width:38px; height:38px; display:grid; place-items:center; border-radius:10px; background:var(--color-accent-soft); color:var(--color-accent-dark); font-weight:800; }
    .logout-modal__dialog h2 { margin:16px 0 6px; font-size:1.2rem; letter-spacing:-.02em; }
    .logout-modal__dialog p { margin:0; color:var(--color-text-muted); line-height:1.55; }
    .logout-modal__actions { display:flex; justify-content:flex-end; gap:8px; margin-top:22px; }
    .logout-modal__actions .btn { min-width:90px; }
    @media(max-width:760px) {
      .site-header__links, .site-header__account { display:none; }
      .site-header__menu-toggle { display:inline-flex; }
      .site-header__inner { position:relative; }
      .logout-modal { padding:16px; }
      .logout-modal__dialog { padding:20px; }
      .logout-modal__actions { justify-content:stretch; }
      .logout-modal__actions .btn { flex:1; }
    }
  `;
  document.head.append(style);
}

export function initHeader(navEl) {
  if (!navEl) return;
  ensureStyles();

  let lastSession = null;
  let resolved = false;
  navEl.hidden = true;
  navEl.setAttribute("aria-busy", "true");

  const render = (session) => {
    lastSession = session;
    resolved = true;
    renderNav(navEl, session);
    navEl.hidden = false;
    navEl.setAttribute("aria-busy", "false");
  };

  getCurrentSession()
    .then(render)
    .catch(() => render(null));

  onAuthStateChange((event, session) => {
    if (!resolved) {
      if (event === "INITIAL_SESSION") return;
      return;
    }
    render(session);
  });

  onCartChange(() => {
    if (resolved) renderNav(navEl, lastSession);
  });
}

function renderNav(navEl, session) {
  navEl.textContent = "";
  const signedIn = Boolean(session?.user);

  const desktopLinks = document.createElement("div");
  desktopLinks.className = "site-header__links";

  desktopLinks.append(
    createLink(page("index.html"), "Home"),
    createLink(page("shop.html"), "Shop"),
    createCartLink(),
  );

  if (signedIn) {
    desktopLinks.append(createAccountMenu());
  } else {
    desktopLinks.append(
      createLink(page("login.html"), "Log in"),
      createLink(page("signup.html"), "Create account", "btn btn-primary"),
    );
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "site-header__menu-toggle";
  toggle.setAttribute("aria-label", "Open menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "site-header-mobile-menu");
  toggle.innerHTML = "<span></span><span></span><span></span>";

  const menu = document.createElement("div");
  menu.id = "site-header-mobile-menu";
  menu.className = "site-header__menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");

  menu.append(
    createLink(page("index.html"), "Home", "site-header__menu-link"),
    createLink(page("shop.html"), "Shop", "site-header__menu-link"),
    createCartLink("site-header__menu-link"),
  );

  if (signedIn) {
    menu.append(
      createLink(page("account.html"), "My Account", "site-header__menu-link"),
      createLink(page("orders.html"), "My Orders", "site-header__menu-link"),
    );
    const divider = document.createElement("div");
    divider.className = "site-header__menu-divider";
    divider.setAttribute("aria-hidden", "true");
    menu.append(divider, createLogoutButton("site-header__menu-link"));
  } else {
    menu.append(
      createLink(page("login.html"), "Log in", "site-header__menu-link"),
      createLink(page("signup.html"), "Create account", "btn btn-primary site-header__menu-link"),
    );
  }

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu(toggle, menu));
  });

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  if (!navEl.dataset.outsideClickBound) {
    document.addEventListener("click", (event) => {
      const activeToggle = navEl.querySelector(".site-header__menu-toggle");
      const activeMenu = navEl.querySelector(".site-header__menu");
      const accountMenu = navEl.querySelector(".site-header__account-menu");
      const accountButton = navEl.querySelector(".site-header__account-button");
      if (activeToggle && activeMenu && !navEl.contains(event.target))
        closeMenu(activeToggle, activeMenu);
      if (accountMenu && accountButton && !navEl.contains(event.target))
        closeAccountMenu(accountButton, accountMenu);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const activeToggle = navEl.querySelector(".site-header__menu-toggle");
      const activeMenu = navEl.querySelector(".site-header__menu");
      const accountMenu = navEl.querySelector(".site-header__account-menu");
      const accountButton = navEl.querySelector(".site-header__account-button");
      if (activeToggle && activeMenu) closeMenu(activeToggle, activeMenu);
      if (accountMenu && accountButton) closeAccountMenu(accountButton, accountMenu);
    });

    navEl.dataset.outsideClickBound = "true";
  }

  navEl.append(desktopLinks, toggle, menu);
}

function createAccountMenu() {
  const wrapper = document.createElement("div");
  wrapper.className = "site-header__account";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-header__account-button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Open account menu");
  button.innerHTML = `${accountIcon()}<span>Account</span>`;

  const menu = document.createElement("div");
  menu.className = "site-header__account-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.append(
    createLink(page("account.html"), "My Account"),
    createLink(page("orders.html"), "My Orders"),
  );

  const divider = document.createElement("div");
  divider.className = "site-header__account-divider";
  divider.setAttribute("aria-hidden", "true");
  menu.append(divider, createLogoutButton());

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close account menu" : "Open account menu");
  });

  wrapper.append(button, menu);
  return wrapper;
}

function closeAccountMenu(button, menu) {
  menu.hidden = true;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Open account menu");
}

function closeMenu(toggle, menu) {
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
}

function createLink(href, text, className = "") {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  if (className) link.className = className;
  return link;
}

function createCartLink(className = "") {
  const link = createLink(
    page("cart.html"),
    "Cart",
    className ? `${className} site-header__cart-link` : "site-header__cart-link",
  );
  link.setAttribute("aria-label", "Cart");
  link.innerHTML = `${cartIcon()}<span class="site-header__cart-label">Cart</span><span class="site-header__cart-count">${getCartItemCount()}</span>`;
  return link;
}

function createLogoutButton(className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "site-header__logout";
  if (!className) button.classList.add("site-header__logout");
  button.textContent = "Log out";
  button.addEventListener("click", () => openLogoutModal());
  return button;
}

function openLogoutModal() {
  let modal = document.getElementById("beulah-logout-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "beulah-logout-modal";
    modal.className = "logout-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="logout-modal__backdrop" data-close></div>
      <section class="logout-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" aria-describedby="logout-modal-copy">
        <div class="logout-modal__icon" aria-hidden="true">↗</div>
        <h2 id="logout-modal-title">Log out?</h2>
        <p id="logout-modal-copy">Are you sure you want to log out of your Beulah Foods account?</p>
        <div class="logout-modal__actions">
          <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
          <button type="button" class="btn btn-primary" data-confirm>Log out</button>
        </div>
      </section>
    `;
    document.body.append(modal);

    modal.addEventListener("click", async (event) => {
      if (event.target.closest("[data-close], [data-cancel]")) {
        modal.hidden = true;
        return;
      }

      const confirmButton = event.target.closest("[data-confirm]");
      if (!confirmButton) return;

      confirmButton.disabled = true;
      confirmButton.textContent = "Logging out...";

      try {
        await signOutCustomer();
        window.location.href = page("index.html");
      } catch {
        confirmButton.disabled = false;
        confirmButton.textContent = "Log out";
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) modal.hidden = true;
    });
  }

  modal.hidden = false;
  modal.querySelector("[data-cancel]").focus();
}

function cartIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20.5 8H6"/><circle cx="10" cy="19" r="1.3"/><circle cx="18" cy="19" r="1.3"/></svg>';
}

function accountIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.1 3.1-4.8 6.5-4.8s5.7 1.7 6.5 4.8"/></svg>';
}
