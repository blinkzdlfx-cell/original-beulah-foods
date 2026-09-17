import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../js/config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: "beulah-storefront-auth" },
});

const shell = document.getElementById("admin-shell");
const login = document.getElementById("admin-login");
const app = document.getElementById("admin-app");
const loginForm = document.getElementById("admin-login-form");
const loginAlert = document.getElementById("admin-login-alert");
const alertBox = document.getElementById("admin-alert");
const menuToggle = document.getElementById("admin-menu-toggle");
const menu = document.getElementById("admin-menu");
const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });

let categories = [];
let products = [];

function setAlert(message = "", error = false) {
  alertBox.textContent = message;
  alertBox.className = `alert${error ? " error" : ""}`;
  alertBox.hidden = !message;
}

function setLoginAlert(message = "") {
  loginAlert.textContent = message;
  loginAlert.hidden = !message;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `item-${Date.now()}`;
}

function showApp(user) {
  shell.classList.remove("admin-shell--loading");
  login.classList.add("hidden");
  app.classList.remove("hidden");
  document.getElementById("admin-name").textContent = user.email || "Admin";
}

function showLogin() {
  shell.classList.remove("admin-shell--loading");
  app.classList.add("hidden");
  login.classList.remove("hidden");
}

async function assertAdmin() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  if (!data) {
    await supabase.auth.signOut();
    throw new Error("ADMIN_ACCESS_REQUIRED");
  }
  return user;
}

async function loadCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,sort_order,is_active")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  categories = data ?? [];

  const select = document.getElementById("product-category");
  select.innerHTML = `<option value="">No category</option>`;
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  }

  const rows = document.getElementById("category-rows");
  rows.innerHTML = categories.length
    ? categories.map((category) => `<tr><td>${escapeHtml(category.name)}</td><td>${category.is_active ? '<span class="badge">Active</span>' : '<span class="badge badge--neutral">Hidden</span>'}</td></tr>`).join("")
    : `<tr><td colspan="2" class="table-empty">No categories yet.</td></tr>`;
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,category_id,name,slug,description,price,stock_quantity,sort_order,is_active,is_featured,categories(name)")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  products = data ?? [];

  const active = products.filter((product) => product.is_active);
  const availableUnits = active.reduce((sum, product) => sum + Math.max(0, Number(product.stock_quantity) || 0), 0);
  const lowStock = active.filter((product) => Number(product.stock_quantity) <= 5).length;
  document.getElementById("product-count").textContent = String(products.length);
  document.getElementById("active-count").textContent = String(active.length);
  document.getElementById("available-product-count").textContent = String(availableUnits);
  document.getElementById("low-stock-count").textContent = String(lowStock);

  const rows = document.getElementById("product-rows");
  rows.innerHTML = products.length
    ? products.map((product) => `<tr><td><strong>${escapeHtml(product.name)}</strong><br><small>${escapeHtml(product.slug)}</small></td><td>${escapeHtml(product.categories?.name || "—")}</td><td>${money.format(Number(product.price) || 0)}</td><td>${Number(product.stock_quantity) || 0}</td><td>${product.is_featured ? '<span class="badge">Yes</span>' : '<span class="badge badge--neutral">No</span>'}</td><td>${product.is_active ? '<span class="badge">Active</span>' : '<span class="badge badge--danger">Hidden</span>'}</td><td><button class="btn btn-secondary" type="button" data-edit-product="${product.id}">Edit</button></td></tr>`).join("")
    : `<tr><td colspan="7" class="table-empty">No products yet.</td></tr>`;

  rows.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => editProduct(button.dataset.editProduct));
  });
}

async function loadDelivery() {
  const { data, error } = await supabase
    .from("delivery_settings")
    .select("id,is_delivery_enabled,delivery_fee,is_active,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  document.getElementById("delivery-id").value = data?.id || "";
  document.getElementById("delivery-enabled").checked = Boolean(data?.is_delivery_enabled);
  document.getElementById("delivery-fee").value = data?.delivery_fee ?? 0;
  document.getElementById("delivery-active").checked = Boolean(data?.is_active);
}

async function loadPromos() {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("id,code,discount_type,discount_value,usage_count,usage_limit,is_active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = document.getElementById("promo-rows");
  rows.innerHTML = (data ?? []).length
    ? data.map((promo) => `<tr><td><strong>${escapeHtml(promo.code)}</strong></td><td>${promo.discount_type === "percentage" ? `${promo.discount_value}%` : money.format(Number(promo.discount_value))}</td><td>${promo.usage_count}/${promo.usage_limit ?? "∞"}</td><td>${promo.is_active ? '<span class="badge">Active</span>' : '<span class="badge badge--neutral">Inactive</span>'}</td></tr>`).join("")
    : `<tr><td colspan="4" class="table-empty">No promo codes yet.</td></tr>`;
}

async function refreshDashboard() {
  await Promise.all([loadCategories(), loadProducts(), loadDelivery(), loadPromos()]);
}

function editProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  document.getElementById("product-id").value = product.id;
  document.getElementById("product-name").value = product.name || "";
  document.getElementById("product-category").value = product.category_id || "";
  document.getElementById("product-description").value = product.description || "";
  document.getElementById("product-price").value = product.price ?? 0;
  document.getElementById("product-stock").value = product.stock_quantity ?? 0;
  document.getElementById("product-sort").value = product.sort_order ?? 0;
  document.getElementById("product-active").checked = Boolean(product.is_active);
  document.getElementById("product-featured").checked = Boolean(product.is_featured);
  window.scrollTo({ top: document.getElementById("product-form").getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
}

function clearProductForm() {
  document.getElementById("product-form").reset();
  document.getElementById("product-id").value = "";
  document.getElementById("product-active").checked = true;
}

function clearCategoryForm() {
  document.getElementById("category-form").reset();
  document.getElementById("category-id").value = "";
}

function clearPromoForm() {
  document.getElementById("promo-form").reset();
  document.getElementById("promo-id").value = "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginAlert("");
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = await assertAdmin();
    if (!user) throw new Error("ADMIN_ACCESS_REQUIRED");
    showApp(user);
    await refreshDashboard();
  } catch (error) {
    setLoginAlert(error?.message === "ADMIN_ACCESS_REQUIRED" ? "This account is not provisioned for admin access." : error?.message || "Could not sign in.");
  }
});

document.getElementById("admin-logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
});

document.getElementById("product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const id = document.getElementById("product-id").value.trim();
    const payload = {
      name: document.getElementById("product-name").value.trim(),
      slug: slugify(document.getElementById("product-name").value),
      category_id: document.getElementById("product-category").value || null,
      description: document.getElementById("product-description").value.trim() || null,
      price: Number(document.getElementById("product-price").value),
      stock_quantity: Math.max(0, Number.parseInt(document.getElementById("product-stock").value, 10) || 0),
      sort_order: Math.max(0, Number.parseInt(document.getElementById("product-sort").value, 10) || 0),
      is_active: document.getElementById("product-active").checked,
      is_featured: document.getElementById("product-featured").checked,
    };
    const result = id ? await supabase.from("products").update(payload).eq("id", id) : await supabase.from("products").insert(payload);
    if (result.error) throw result.error;
    clearProductForm();
    await refreshDashboard();
    setAlert("Product saved.");
  } catch (error) { setAlert(error?.message || "Could not save product.", true); }
});

document.getElementById("cancel-product").addEventListener("click", clearProductForm);

document.getElementById("category-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const id = document.getElementById("category-id").value.trim();
    const name = document.getElementById("category-name").value.trim();
    const payload = { name, slug: slugify(name), description: document.getElementById("category-description").value.trim() || null, sort_order: Math.max(0, Number.parseInt(document.getElementById("category-sort").value, 10) || 0), is_active: true };
    const result = id ? await supabase.from("categories").update(payload).eq("id", id) : await supabase.from("categories").insert(payload);
    if (result.error) throw result.error;
    clearCategoryForm();
    await refreshDashboard();
    setAlert("Category saved.");
  } catch (error) { setAlert(error?.message || "Could not save category.", true); }
});

document.getElementById("cancel-category").addEventListener("click", clearCategoryForm);

document.getElementById("delivery-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const id = document.getElementById("delivery-id").value.trim();
    const active = document.getElementById("delivery-active").checked;
    const payload = { is_delivery_enabled: document.getElementById("delivery-enabled").checked, delivery_fee: Math.max(0, Number(document.getElementById("delivery-fee").value) || 0), is_active: active };
    if (active) {
      const { error } = await supabase.from("delivery_settings").update({ is_active: false }).neq("id", id || "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    }
    const result = id ? await supabase.from("delivery_settings").update(payload).eq("id", id) : await supabase.from("delivery_settings").insert(payload);
    if (result.error) throw result.error;
    await refreshDashboard();
    setAlert("Delivery settings saved.");
  } catch (error) { setAlert(error?.message || "Could not save delivery settings.", true); }
});

document.getElementById("promo-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const id = document.getElementById("promo-id").value.trim();
    const payload = {
      code: document.getElementById("promo-code").value.trim().toUpperCase(),
      discount_type: document.getElementById("promo-type").value,
      discount_value: Number(document.getElementById("promo-value").value),
      usage_limit: document.getElementById("promo-limit").value ? Number.parseInt(document.getElementById("promo-limit").value, 10) : null,
      is_active: document.getElementById("promo-active").checked,
    };
    const result = id ? await supabase.from("promo_codes").update(payload).eq("id", id) : await supabase.from("promo_codes").insert(payload);
    if (result.error) throw result.error;
    clearPromoForm();
    await refreshDashboard();
    setAlert("Promo code saved.");
  } catch (error) { setAlert(error?.message || "Could not save promo code.", true); }
});

document.getElementById("cancel-promo").addEventListener("click", clearPromoForm);

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = menu.hidden;
  menu.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  if (menu && !menu.hidden && !menu.contains(event.target) && !menuToggle.contains(event.target)) {
    menu.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu) {
    menu.hidden = true;
    menuToggle?.setAttribute("aria-expanded", "false");
  }
});

(async function boot() {
  try {
    const user = await assertAdmin();
    if (!user) {
      showLogin();
      return;
    }
    showApp(user);
    await refreshDashboard();
  } catch (error) {
    showLogin();
    if (error?.message && error.message !== "ADMIN_ACCESS_REQUIRED") setLoginAlert(error.message);
  }
})();
