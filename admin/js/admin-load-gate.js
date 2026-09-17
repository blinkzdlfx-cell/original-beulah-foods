const shell = document.querySelector(".admin-shell");
const login = document.getElementById("admin-login");
const app = document.getElementById("admin-app");

if (shell && login && app) {
  const finishLoading = () => {
    if (!login.classList.contains("hidden") || !app.classList.contains("hidden")) {
      shell.classList.remove("admin-shell--loading");
      observer.disconnect();
    }
  };
  const observer = new MutationObserver(finishLoading);
  observer.observe(login, { attributes: true, attributeFilter: ["class"] });
  observer.observe(app, { attributes: true, attributeFilter: ["class"] });
  finishLoading();
}
