const toggle = document.getElementById("admin-menu-toggle");
const menu = document.getElementById("admin-menu");

if (toggle && menu) {
  const isDesktop = () => window.matchMedia("(min-width: 801px)").matches;

  const closeMobile = () => {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open admin menu");
  };

  const openMobile = () => {
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close admin menu");
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isDesktop()) return;
    if (menu.hidden) openMobile();
    else closeMobile();
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (!isDesktop()) closeMobile();
    });
  });

  document.addEventListener("click", (event) => {
    if (!isDesktop() && !menu.hidden && !menu.contains(event.target) && event.target !== toggle) closeMobile();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !isDesktop()) closeMobile();
  });

  window.addEventListener("resize", () => {
    if (isDesktop()) {
      menu.hidden = false;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open admin menu");
    } else {
      closeMobile();
    }
  });

  if (isDesktop()) menu.hidden = false;
}
