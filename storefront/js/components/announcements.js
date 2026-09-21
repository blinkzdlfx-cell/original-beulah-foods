import { loadAnnouncements, announcementImage } from "../services/announcementsService.js";

const STORAGE_PREFIX = "beulah-announcement:";
const VALID_TYPES = new Set(["inline", "banner", "featured", "modal"]);

export async function renderAnnouncements(page) {
  const root = document.querySelector("[data-announcements]");
  if (!root) return;

  try {
    const items = await loadAnnouncements(page);
    const visible = items.filter(shouldDisplay);
    root.hidden = true;
    root.innerHTML = "";

    if (!visible.length) return;

    const modal = visible.find((item) => item.display_type === "modal");
    const nonModal = visible.filter((item) => item !== modal);

    if (nonModal.length) {
      const list = document.createElement("div");
      list.className = "announcement-list";

      nonModal.forEach((item) => {
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

function shouldDisplay(item) {
  const type = item.display_type || (item.display_mode === "banner" ? "banner" : "inline");
  if (!VALID_TYPES.has(type)) return false;
  if (item.show_once && localStorage.getItem(STORAGE_PREFIX + item.id)) return false;
  return true;
}

function markViewed(item) {
  if (item.show_once) localStorage.setItem(STORAGE_PREFIX + item.id, "1");
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

  if (item.dismissible) {
    const close = createCloseButton(() => {
      article.remove();
      if (!article.parentElement?.children.length) rootCleanup(article);
    });
    article.appendChild(close);
  }

  article.appendChild(content);
  return article;
}

function createModal(item) {
  const overlay = document.createElement("div");
  overlay.className = "announcement-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", item.title);

  const dialog = document.createElement("article");
  dialog.className = "announcement announcement--modal";

  if (item.image_path) {
    const image = document.createElement("img");
    image.className = "announcement__image";
    image.src = announcementImage(item.image_path);
    image.alt = "";
    dialog.appendChild(image);
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
  dialog.appendChild(content);

  const close = createCloseButton(() => overlay.remove());
  dialog.appendChild(close);
  overlay.appendChild(dialog);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && item.dismissible) overlay.remove();
  });

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

function rootCleanup(article) {
  const region = article.closest("[data-announcements]");
  if (region) region.hidden = true;
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
