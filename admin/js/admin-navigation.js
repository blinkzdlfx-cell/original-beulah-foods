const toggle = document.getElementById("admin-menu-toggle");
const menu = document.getElementById("admin-menu");

if (toggle && menu) {
  let backdrop = document.getElementById("admin-sidebar-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "admin-sidebar-backdrop";
    backdrop.className = "admin-sidebar-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
  }

  let collapse = menu.querySelector(".admin-sidebar-collapse");
  if (!collapse) {
    collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "admin-sidebar-collapse";
    collapse.setAttribute("aria-label", "Collapse admin sidebar");
    collapse.textContent = "‹";
    menu.prepend(collapse);
  }

  const isDesktop = () => window.matchMedia("(min-width: 801px)").matches;

  const syncToggle = () => {
    const collapsed = document.body.classList.contains("admin-sidebar-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand admin sidebar" : "Collapse admin sidebar");
    toggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  };

  const closeMobile = () => {
    menu.hidden = true;
    backdrop.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open admin menu");
  };

  const openMobile = () => {
    menu.hidden = false;
    backdrop.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close admin menu");
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isDesktop()) {
      document.body.classList.toggle("admin-sidebar-collapsed");
      syncToggle();
      return;
    }
    if (menu.hidden) openMobile();
    else closeMobile();
  });

  collapse.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isDesktop()) {
      document.body.classList.toggle("admin-sidebar-collapsed");
      syncToggle();
    } else {
      closeMobile();
    }
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (!isDesktop()) closeMobile();
    });
  });

  backdrop.addEventListener("click", closeMobile);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (isDesktop()) {
        document.body.classList.remove("admin-sidebar-collapsed");
        syncToggle();
      } else {
        closeMobile();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (isDesktop()) {
      closeMobile();
      syncToggle();
    }
  });

  if (isDesktop()) syncToggle();
}
