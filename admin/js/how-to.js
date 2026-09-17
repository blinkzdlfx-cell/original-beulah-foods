import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";

const productSelect = document.getElementById("guide-product");
const guideTitle = document.getElementById("guide-title");
const guideDescription = document.getElementById("guide-description");
const guideActive = document.getElementById("guide-active");
const guideSteps = document.getElementById("guide-steps");
const orderTitle = document.getElementById("order-title");
const orderDescription = document.getElementById("order-description");
const orderActive = document.getElementById("order-active");
const orderSteps = document.getElementById("order-steps");
const status = document.getElementById("how-to-status");
let products = [];

function showStatus(message, error = false) {
  status.textContent = message;
  status.className = `alert ${error ? "error" : "success"}`;
  status.hidden = false;
}

function stepMarkup(step = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "how-to-step";
  wrapper.innerHTML = `<div class="how-to-step__number" aria-hidden="true"></div><div class="field"><label>Step title <span class="muted">(optional)</span></label><input class="step-title" maxlength="160" value="${escapeAttribute(step.title || "")}" /><label>Description</label><textarea class="step-description" maxlength="1000" required>${escapeHtml(step.description || "")}</textarea></div><button class="btn btn-secondary how-to-step__remove" type="button">Remove</button>`;
  wrapper.querySelector(".how-to-step__remove").addEventListener("click", () => { wrapper.remove(); renumber(wrapper.parentElement); });
  return wrapper;
}

function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
function renumber(container) { [...container.children].forEach((el, i) => { const number = el.querySelector(".how-to-step__number"); if (number) number.textContent = String(i + 1); }); }
function addStep(container, step) { container.append(stepMarkup(step)); renumber(container); }
function readSteps(container) { return [...container.children].map((el) => ({ title: el.querySelector(".step-title")?.value.trim() || "", description: el.querySelector(".step-description")?.value.trim() || "" })).filter((step) => step.description); }

async function loadProducts() {
  const { data, error } = await supabase.from("products").select("id,name,is_active").order("name", { ascending: true });
  if (error) throw error;
  products = data || [];
  productSelect.innerHTML = `<option value="">Select a product</option>` + products.map((p) => `<option value="${escapeAttribute(p.id)}">${escapeHtml(p.name)}${p.is_active ? "" : " (inactive)"}</option>`).join("");
}

async function loadProductGuide(productId) {
  guideSteps.innerHTML = "";
  guideTitle.value = ""; guideDescription.value = ""; guideActive.checked = true;
  if (!productId) return;
  const { data, error } = await supabase.from("how_to_guides").select("id,title,description,is_active,how_to_steps(id,step_number,title,description)").eq("product_id", productId).maybeSingle();
  if (error) throw error;
  if (!data) { addStep(guideSteps); return; }
  guideTitle.value = data.title || ""; guideDescription.value = data.description || ""; guideActive.checked = data.is_active !== false;
  (data.how_to_steps || []).sort((a,b) => a.step_number - b.step_number).forEach((step) => addStep(guideSteps, step));
  if (!guideSteps.children.length) addStep(guideSteps);
}

async function loadOrderGuide() {
  const { data, error } = await supabase.from("how_to_order").select("id,title,description,is_active,how_to_order_steps(id,step_number,title,description)").limit(1).maybeSingle();
  if (error) throw error;
  orderSteps.innerHTML = "";
  if (!data) { addStep(orderSteps); return; }
  orderTitle.value = data.title || "How to Order"; orderDescription.value = data.description || ""; orderActive.checked = data.is_active !== false;
  (data.how_to_order_steps || []).sort((a,b) => a.step_number - b.step_number).forEach((step) => addStep(orderSteps, step));
  if (!orderSteps.children.length) addStep(orderSteps);
}

productSelect.addEventListener("change", () => loadProductGuide(productSelect.value).catch((error) => showStatus(error?.message || "Could not load the product guide.", true)));
document.getElementById("add-guide-step").addEventListener("click", () => addStep(guideSteps));
document.getElementById("add-order-step").addEventListener("click", () => addStep(orderSteps));
document.getElementById("clear-guide").addEventListener("click", () => { productSelect.value = ""; guideTitle.value = ""; guideDescription.value = ""; guideActive.checked = true; guideSteps.innerHTML = ""; addStep(guideSteps); });

document.getElementById("product-guide-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!productSelect.value) return showStatus("Select a product first.", true);
  const title = guideTitle.value.trim();
  if (!title) return showStatus("Enter a guide title.", true);
  const steps = readSteps(guideSteps);
  if (!steps.length) return showStatus("Add at least one step with a description.", true);
  const button = document.getElementById("save-guide"); button.disabled = true; button.textContent = "Saving...";
  try {
    const { error } = await supabase.rpc("admin_save_how_to_guide", { p_product_id: productSelect.value, p_title: title, p_description: guideDescription.value.trim(), p_is_active: guideActive.checked, p_steps: steps });
    if (error) throw error;
    showStatus("Product guide saved.");
    await loadProductGuide(productSelect.value);
  } catch (error) { console.error(error); showStatus(error?.message || "Could not save the product guide.", true); }
  finally { button.disabled = false; button.textContent = "Save guide"; }
});

document.getElementById("order-guide-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = orderTitle.value.trim();
  const steps = readSteps(orderSteps);
  if (!title) return showStatus("Enter the ordering guide title.", true);
  if (!steps.length) return showStatus("Add at least one ordering step with a description.", true);
  const button = document.getElementById("save-order-guide"); button.disabled = true; button.textContent = "Saving...";
  try {
    const { error } = await supabase.rpc("admin_save_how_to_order", { p_title: title, p_description: orderDescription.value.trim(), p_is_active: orderActive.checked, p_steps: steps });
    if (error) throw error;
    showStatus("Ordering guide saved.");
    await loadOrderGuide();
  } catch (error) { console.error(error); showStatus(error?.message || "Could not save the ordering guide.", true); }
  finally { button.disabled = false; button.textContent = "Save ordering guide"; }
});

async function init() {
  const access = await requireAdmin();
  if (!access) { location.href = "/admin/"; return; }
  await loadProducts();
  await loadOrderGuide();
  if (products.length) { productSelect.value = products[0].id; await loadProductGuide(products[0].id); }
  else addStep(guideSteps);
}

init().catch((error) => { console.error(error); showStatus(error?.message || "Could not load How To administration.", true); });
