import { loadAnnouncements, announcementImage } from "../services/announcementsService.js";

const STORAGE_PREFIX = "beulah-announcement:";
const VALID_TYPES = new Set(["inline", "banner", "featured", "modal"]);

export async function renderAnnouncements(page) {
  const root = document.querySelector("[data-announcements]");
  if (!root) return;

  try {
    const items = (await loadAnnouncements(page)).filter(shouldDisplay);
    root.hidden = true;
    root.innerHTML = "";

    if (!items.length) return;

    const modal = items.find((item) => item.display_type === "modal");
    const banners = items.filter((item) => item.display_type === "banner");
    const contentItems = items.filter((item) => item !== modal && item.display_type !== "banner");

    if (banners.length) {
      const host = document.createElement("div");
      host.className = "announcement-banner-region";
      banners.forEach((item) => {
        host.appendChild(createAnnouncement(item));
        markViewed(item);
      });
      const main = document.querySelector("main");
      if (main) main.before(host);
      else document.body.prepend(host);
    }

    if (contentItems.length) {
      const list = document.createElement("div");
      list.className = "announcement-list";
      contentItems.forEach((item) => {
        list.appendChild(createAnnouncement(item));
        markViewed(item);
      });
      root.appendChild(list);
      root.hidden = false;
    }

    if (modal) {
      document.body.appendChild(createModal(modal));
      markViewed(modal);
    }
  } catch (error) {
    console.error("Announcements unavailable", error);
    root.hidden = true;
  }
}

function announcementKey(item, kind) {
  return STORAGE_PREFIX + item.id + ":" + (item.updated_at || "current") + ":" + kind;
}

function shouldDisplay(item) {
  const type = item.display_type || (item.display_mode === "banner" ? "banner" : "inline");
  if (!VALID_TYPES.has(type)) return false;
  try {
    if (localStorage.getItem(announcementKey(item, "dismissed")) === "1") return false;
    if (item.show_once && localStorage.getItem(announcementKey(item, "viewed")) === "1") return false;
  } catch {}
  return true;
}

function markViewed(item) {
  if (!item.show_once) return;
  try { localStorage.setItem(announcementKey(item, "viewed"), "1"); } catch {}
}

function markDismissed(item) {
  if (!item.dismissible) return;
  try { localStorage.setItem(announcementKey(item, "dismissed"), "1"); } catch {}
}

function createAnnouncement(item) {
  const type = item.display_type || (item.display_mode === "banner" ? "banner" : "inline");
  const article = document.createElement("article");
  article.className = "announcement announcement--" + type;

  if (item.image_path) {
    const image = document.createElement("img");
    image.className = "announcement__image";
    image.src = announcementImage(item.image_path);
    image.alt = "";
    image.loading = "lazy";
    article.appendChild(image);
  }

  const content = document.createElement("div");
  content.className = "announcement__content";

  const heading = document.createElement("h2");
  heading.className = "announcement__title";
  heading.textContent = item.title;

  const description = document.createElement("p");
  description.className = "announcement__description";
  description.textContent = item.short_description;

  content.append(heading, description);
  const actions = createActions(item);
  if (actions) content.appendChild(actions);
  article.appendChild(content);

  if (item.dismissible) {
    const close = createCloseButton(() => {
      markDismissed(item);
      const region = article.closest(".announcement-region,.announcement-banner-region");
      article.remove();
      if (region && !region.children.length) region.remove();
    });
    article.appendChild(close);
  }

  return article;
}

function createModal(item) {
  const overlay = document.createElement("div");
  overlay.className = "announcement-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "announcement-modal-title-" + item.id);
  overlay.setAttribute("aria-describedby", "announcement-modal-description-" + item.id);

  const dialog = document.createElement("article");
  dialog.className = "announcement announcement--modal";

  if (item.image_path) {
    const image = document.createElement("img");
    image.className = "announcement__image";
    image.src = announcementImage(item.image_path);
    image.alt = "";
    image.loading = "lazy";
    dialog.appendChild(image);
  }

  const content = document.createElement("div");
  content.className = "announcement__content";

  const heading = document.createElement("h2");
  heading.className = "announcement__title";
  heading.id = "announcement-modal-title-" + item.id;
  heading.textContent = item.title;

  const description = document.createElement("p");
  description.className = "announcement__description";
  description.id = "announcement-modal-description-" + item.id;
  description.textContent = item.short_description;

  content.append(heading, description);
  const actions = createActions(item);
  if (actions) content.appendChild(actions);
  dialog.appendChild(content);

  const close = createCloseButton(() => {
    markDismissed(item);
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
  });

  if (item.dismissible) {
    dialog.appendChild(close);
  }

  overlay.appendChild(dialog);

  function onKeyDown(event) {
    if (event.key === "Escape" && item.dismissible) close.click();
  }

  document.addEventListener("keydown", onKeyDown);

  if (item.dismissible) {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close.click();
    });
  }

  return overlay;
}

function createActions(item) {
  const url = safeUrl(item.cta_url);
  if (!url || !item.cta_text) return null;

  const wrap = document.createElement("div");
  wrap.className = "announcement__actions";
  const link = document.createElement("a");
  link.className = "announcement__cta";
  link.href = url;
  link.textContent = item.cta_text;
  if (/^https?:\/\//i.test(url)) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  wrap.appendChild(link);
  return wrap;
}

function createCloseButton(onClose) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "announcement__close";
  button.setAttribute("aria-label", "Dismiss announcement");
  button.textContent = "×";
  button.addEventListener("click", onClose);
  return button;
}

function safeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
