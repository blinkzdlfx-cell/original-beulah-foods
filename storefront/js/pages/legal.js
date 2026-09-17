import { initHeader } from "../components/navbar.js";

initHeader(document.getElementById("site-header-nav"));

const year = document.getElementById("footer-year");
if (year) year.textContent = String(new Date().getFullYear());

const backButton = document.querySelector("[data-back]");
if (backButton) {
  backButton.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "index.html";
  });
}
