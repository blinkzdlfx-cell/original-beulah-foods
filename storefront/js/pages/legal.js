import { initHeader } from "../components/navbar.js";

initHeader(document.getElementById("site-header-nav"));
const year = document.getElementById("footer-year");
if (year) year.textContent = String(new Date().getFullYear());
