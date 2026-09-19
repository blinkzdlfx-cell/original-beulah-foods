import { supabase } from "../lib/supabaseClient.js";
import { initHeader } from "../components/navbar.js";

const nav = document.getElementById("site-header-nav");
const guidesRoot = document.getElementById("product-guides");
const orderRoot = document.getElementById("order-guide");
initHeader(nav);

authenticateSafeFooter();

const backButton = document.querySelector("[data-back]");
if (backButton) {
  backButton.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/";
  });
}

function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

async function loadGuides() {
  const [{ data: guides, error: guideError }, { data: orderGuide, error: orderError }] = await Promise.all([
    supabase.from("how_to_guides").select("id,title,description,products(name),how_to_steps(step_number,title,description)").eq("is_active", true).order("created_at", { ascending: true }),
    supabase.from("how_to_order").select("id,title,description,how_to_order_steps(step_number,title,description)").eq("is_active", true).limit(1).maybeSingle(),
  ]);
  if (guideError) throw guideError;
  if (orderError) throw orderError;
  renderGuides(guides || []);
  renderOrderGuide(orderGuide);
}

function renderGuides(guides) {
  if (!guides.length) { guidesRoot.innerHTML = '<p class="guide-empty">Preparation guides will appear here when they are published.</p>'; return; }
  guidesRoot.innerHTML = guides.map((guide) => {
    const steps = [...(guide.how_to_steps || [])].sort((a,b) => a.step_number - b.step_number);
    return `<article class="guide-card"><p class="eyebrow">${escapeHtml(guide.products?.name || "Beulah Foods product")}</p><h3>${escapeHtml(guide.title)}</h3>${guide.description ? `<p>${escapeHtml(guide.description)}</p>` : ""}<ol class="guide-steps">${steps.map((step) => `<li class="guide-step"><span class="guide-step__number">${step.step_number}</span><div>${step.title ? `<h4>${escapeHtml(step.title)}</h4>` : ""}<p>${escapeHtml(step.description)}</p></div></li>`).join("")}</ol></article>`;
  }).join("");
}

function renderOrderGuide(guide) {
  if (!guide) { orderRoot.innerHTML = ""; return; }
  const steps = [...(guide.how_to_order_steps || [])].sort((a,b) => a.step_number - b.step_number);
  orderRoot.innerHTML = `<div class="how-to-order-card"><p class="eyebrow">Ordering</p><h2>${escapeHtml(guide.title)}</h2>${guide.description ? `<p>${escapeHtml(guide.description)}</p>` : ""}<ol class="guide-steps">${steps.map((step) => `<li class="guide-step"><span class="guide-step__number">${step.step_number}</span><div>${step.title ? `<h4>${escapeHtml(step.title)}</h4>` : ""}<p>${escapeHtml(step.description)}</p></div></li>`).join("")}</ol></div>`;
}

function authenticateSafeFooter() { const year = document.getElementById("footer-year"); if (year) year.textContent = String(new Date().getFullYear()); }

loadGuides().catch((error) => { console.error(error); guidesRoot.innerHTML = '<p class="guide-empty">We could not load the guides right now. Please refresh and try again.</p>'; orderRoot.innerHTML = ''; });
