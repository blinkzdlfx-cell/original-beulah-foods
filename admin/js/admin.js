import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin, signInAdmin, signOutAdmin } from "./services/adminAuthService.js";

const PRODUCT_IMAGE_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PRODUCT_PAGE_SIZE = 20;

const loginView = document.getElementById("admin-login");
const appView = document.getElementById("admin-app");
const loginForm = document.getElementById("admin-login-form");
const loginAlert = document.getElementById("admin-login-alert");
const appAlert = document.getElementById("admin-alert");
const categoryForm = document.getElementById("category-form");
const productForm = document.getElementById("product-form");
const categoryRows = document.getElementById("category-rows");
const productRows = document.getElementById("product-rows");
const categorySelect = document.getElementById("product-category");
const productId = document.getElementById("product-id");
const productImage = document.getElementById("product-image");
const productPreview = document.getElementById("product-image-preview");
const deliveryForm = document.getElementById("delivery-form");
const deliveryRows = document.getElementById("delivery-rows");
const promoForm = document.getElementById("promo-form");
const promoRows = document.getElementById("promo-rows");

let categories = [];
let products = [];
let productPage = 1;

init();

async function init() {
  try {
    const access = await requireAdmin();
    if (!access) {
      showLogin();
      return;
    }
    showApp(access.admin.display_name || access.session.user.email);
    await loadAll();
  } catch (error) {
    console.error(error);
    showLogin();
    showAlert(
      loginAlert,
      "Admin authorization is not available. Apply the admin migration and provision an admin account first.",
      true,
    );
  }
}

function showLogin() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
}
function showApp(name) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  document.getElementById("admin-name").textContent = name;
}
function showAlert(element, message, error = false) {
  element.textContent = message;
  element.className = `alert${error ? " error" : ""}`;
  element.hidden = false;
}
function clearAlert(element) {
  element.hidden = true;
}
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}
function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}
function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert(loginAlert);
  const submit = loginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const result = await signInAdmin({
      email: loginForm.email.value.trim(),
      password: loginForm.password.value,
    });
    showApp(result.admin.display_name || result.session.user.email);
    await loadAll();
  } catch (error) {
    showAlert(loginAlert, error?.message || "Unable to sign in.", true);
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("admin-logout").addEventListener("click", async () => {
  await signOutAdmin();
  window.location.reload();
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert(appAlert);
  const values = Object.fromEntries(new FormData(categoryForm));
  try {
    const { error } = await supabase.from("categories").insert({
      name: values.name.trim(),
      slug: slugify(values.name),
      description: values.description.trim(),
      sort_order: Number(values.sort_order) || 0,
      is_active: true,
    });
    if (error) throw error;
    categoryForm.reset();
    await loadCategories();
    showAlert(appAlert, "Category saved.");
  } catch (error) {
    showAlert(appAlert, error?.message || "Could not save category.", true);
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert(appAlert);
  const submit = document.getElementById("product-submit");
  submit.disabled = true;
  let uploadedPath = null;
  try {
    const values = Object.fromEntries(new FormData(productForm));
    const file = productImage.files?.[0];
    validateImage(file);

    let existing = productId.value ? products.find((item) => item.id === productId.value) : null;
    if (file) uploadedPath = await uploadProductImage(file);

    const payload = {
      category_id: values.category_id || null,
      name: values.name.trim(),
      slug: slugify(values.name),
      description: values.description.trim(),
      price: Number(values.price),
      image_path: uploadedPath || existing?.image_path || null,
      stock_quantity: Math.max(0, Number.parseInt(values.stock_quantity, 10) || 0),
      sort_order: Number(values.sort_order) || 0,
      is_active: values.is_active === "on",
      is_featured: values.is_featured === "on",
    };

    if (productId.value) {
      const { error } = await supabase.from("products").update(payload).eq("id", productId.value);
      if (error) throw error;
      if (uploadedPath && existing?.image_path) await removeProductImage(existing.image_path);
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
    }

    resetProductForm();
    await loadProducts();
    showAlert(appAlert, "Product saved.");
  } catch (error) {
    if (uploadedPath) await removeProductImage(uploadedPath).catch(() => {});
    showAlert(appAlert, error?.message || "Could not save product.", true);
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("cancel-product").addEventListener("click", resetProductForm);
productImage.addEventListener("change", () => {
  const file = productImage.files?.[0];
  if (!file) {
    productPreview.hidden = true;
    productPreview.innerHTML = "";
    return;
  }
  try {
    validateImage(file);
    renderPreview(URL.createObjectURL(file));
  } catch (error) {
    productImage.value = "";
    showAlert(appAlert, error.message, true);
  }
});

async function loadAll() {
  await Promise.all([loadCategories(), loadProducts(), loadDeliverySettings(), loadPromos()]);
}

async function loadCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,description,sort_order,is_active")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  categories = data || [];
  categoryRows.innerHTML =
    categories
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.slug)}</td><td>${item.is_active ? '<span class="badge">Active</span>' : "Inactive"}</td><td><button class="btn btn-secondary" data-category-id="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="4" class="muted">No categories yet.</td></tr>';
  categorySelect.innerHTML =
    '<option value="">Uncategorised</option>' +
    categories
      .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
      .join("");
  categoryRows
    .querySelectorAll("button[data-category-id]")
    .forEach((button) =>
      button.addEventListener("click", () => toggleCategory(button.dataset.categoryId)),
    );
}

async function loadProducts() {
  const from = (productPage - 1) * PRODUCT_PAGE_SIZE;
  const to = from + PRODUCT_PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from("products")
    .select(
      "id,category_id,name,slug,description,price,image_path,stock_quantity,sort_order,is_active,is_featured,categories(name)",
      { count: "exact" },
    )
    .order("sort_order")
    .order("name")
    .range(from, to);
  if (error) throw error;
  products = data || [];
  productRows.innerHTML =
    products
      .map(
        (item) =>
          `<tr><td><div class="admin-product-cell">${item.image_path ? `<img src="${escapeAttribute(getProductImageUrl(item.image_path))}" alt="" loading="lazy">` : ""}<span>${escapeHtml(item.name)}</span></div></td><td>${item.categories?.name ? escapeHtml(item.categories.name) : "—"}</td><td>${formatNaira(item.price)}</td><td>${item.stock_quantity}</td><td>${item.is_featured ? '<span class="badge badge--featured">Featured</span>' : "—"}</td><td>${item.is_active ? '<span class="badge">Active</span>' : "Inactive"}</td><td><button class="btn btn-secondary" data-edit-product="${item.id}">Edit</button> <button class="btn btn-secondary" data-toggle-product="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="7" class="muted">No products yet.</td></tr>';
  productRows
    .querySelectorAll("[data-edit-product]")
    .forEach((button) =>
      button.addEventListener("click", () => editProduct(button.dataset.editProduct)),
    );
  productRows
    .querySelectorAll("[data-toggle-product]")
    .forEach((button) =>
      button.addEventListener("click", () => toggleProduct(button.dataset.toggleProduct)),
    );
  const totalPages = Math.ceil((count || 0) / PRODUCT_PAGE_SIZE);
  renderProductPagination(totalPages);
  document.getElementById("product-count").textContent = count || 0;
  document.getElementById("active-count").textContent = products.filter(
    (item) => item.is_active,
  ).length;
  document.getElementById("low-stock-count").textContent = products.filter(
    (item) => item.stock_quantity <= 5 && item.is_active,
  ).length;
}

function renderProductPagination(totalPages) {
  const root = document.getElementById("product-pagination");
  root.innerHTML = "";
  if (totalPages <= 1) return;
  const previous = document.createElement("button");
  previous.className = "btn btn-secondary";
  previous.type = "button";
  previous.textContent = "Previous";
  previous.disabled = productPage <= 1;
  previous.onclick = () => {
    productPage -= 1;
    loadProducts();
  };
  const label = document.createElement("span");
  label.className = "admin-pagination__label";
  label.textContent = `Page ${productPage} of ${totalPages}`;
  const next = document.createElement("button");
  next.className = "btn btn-secondary";
  next.type = "button";
  next.textContent = "Next";
  next.disabled = productPage >= totalPages;
  next.onclick = () => {
    productPage += 1;
    loadProducts();
  };
  root.append(previous, label, next);
}

async function toggleCategory(id) {
  const item = categories.find((entry) => entry.id === id);
  if (!item) return;
  const { error } = await supabase
    .from("categories")
    .update({ is_active: !item.is_active })
    .eq("id", id);
  if (error) showAlert(appAlert, error.message, true);
  else await loadCategories();
}
async function toggleProduct(id) {
  const item = products.find((entry) => entry.id === id);
  if (!item) return;
  const { error } = await supabase
    .from("products")
    .update({ is_active: !item.is_active })
    .eq("id", id);
  if (error) showAlert(appAlert, error.message, true);
  else await loadProducts();
}

function editProduct(id) {
  const item = products.find((entry) => entry.id === id);
  if (!item) return;
  productId.value = item.id;
  productForm.name.value = item.name;
  productForm.category_id.value = item.category_id || "";
  productForm.description.value = item.description || "";
  productForm.price.value = item.price;
  productForm.stock_quantity.value = item.stock_quantity;
  productForm.sort_order.value = item.sort_order;
  productForm.is_active.checked = item.is_active;
  productForm.is_featured.checked = Boolean(item.is_featured);
  productImage.value = "";
  if (item.image_path) renderPreview(getProductImageUrl(item.image_path));
  else {
    productPreview.hidden = true;
    productPreview.innerHTML = "";
  }
  document.getElementById("product-submit").textContent = "Update product";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function resetProductForm() {
  productForm.reset();
  productId.value = "";
  productImage.value = "";
  productPreview.hidden = true;
  productPreview.innerHTML = "";
  document.getElementById("product-submit").textContent = "Save product";
}

function validateImage(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error("Product images must be JPG, PNG or WebP.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Product images must be 5 MB or smaller.");
}
async function uploadProductImage(file) {
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `products/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return path;
}
async function removeProductImage(path) {
  if (!path || /^https?:\/\//i.test(path)) return;
  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}
function getProductImageUrl(path) {
  return /^https?:\/\//i.test(path)
    ? path
    : supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
function renderPreview(src) {
  productPreview.hidden = false;
  productPreview.innerHTML = `<img src="${escapeAttribute(src)}" alt="Product image preview">`;
}

// Delivery settings
async function loadDeliverySettings() {
  const { data, error } = await supabase
    .from("delivery_settings")
    .select(
      "id,delivery_fee,is_delivery_enabled,is_active,updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  deliveryRows.innerHTML =
    (data || [])
      .map((item) => {
        const deliveryLabel = item.is_delivery_enabled
          ? `On · ${formatNaira(item.delivery_fee)}`
          : "Off";
        const freeDeliveryLabel = item.is_free_delivery_enabled
          ? `On · ${formatNaira(item.free_delivery_threshold)} threshold`
          : "Off";
        return `<tr><td>${deliveryLabel}</td><td>${freeDeliveryLabel}</td><td>${item.is_active ? '<span class="badge">Active</span>' : "Inactive"}</td><td><button class="btn btn-secondary" data-delivery-edit="${item.id}">Edit</button> <button class="btn btn-secondary" data-delivery-toggle="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button> <button class="btn btn-secondary" data-delivery-delete="${item.id}">Delete</button></td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="4" class="muted">No delivery settings. Checkout will work without delivery charges.</td></tr>';
  deliveryRows
    .querySelectorAll("[data-delivery-edit]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        editDelivery(data.find((item) => item.id === button.dataset.deliveryEdit)),
      ),
    );
  deliveryRows
    .querySelectorAll("[data-delivery-toggle]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        toggleDelivery(data.find((item) => item.id === button.dataset.deliveryToggle)),
      ),
    );
  deliveryRows
    .querySelectorAll("[data-delivery-delete]")
    .forEach((button) =>
      button.addEventListener("click", () => deleteDelivery(button.dataset.deliveryDelete)),
    );
}

deliveryForm.addEventListener("submit", async (event) => {
  return;
  event.preventDefault();
  clearAlert(appAlert);
  const id = document.getElementById("delivery-id").value;
  const deliveryEnabled = document.getElementById("delivery-enabled").checked;
  const freeDeliveryEnabled = document.getElementById("free-delivery-enabled").checked;
  const active = document.getElementById("delivery-active").checked;
  const feeValue = document.getElementById("delivery-fee").value.trim();
  const thresholdValue = document.getElementById("delivery-threshold").value.trim();

  try {
    if (freeDeliveryEnabled && !deliveryEnabled)
      throw new Error("Enable delivery charges before enabling free delivery.");
    if (deliveryEnabled && feeValue === "")
      throw new Error("Enter a delivery fee or turn off delivery charges.");
    if (freeDeliveryEnabled && thresholdValue === "")
      throw new Error("Enter a free-delivery threshold or turn off the free-delivery option.");

    if (active) await deactivateAllDeliverySettings();

    const payload = {
      delivery_fee: feeValue === "" ? null : Number(feeValue),
      free_delivery_threshold: thresholdValue === "" ? null : Number(thresholdValue),
      is_delivery_enabled: deliveryEnabled,
      is_free_delivery_enabled: freeDeliveryEnabled,
      is_active: active,
      updated_at: new Date().toISOString(),
    };
    const query = id
      ? supabase.from("delivery_settings").update(payload).eq("id", id)
      : supabase.from("delivery_settings").insert(payload);
    const { error } = await query;
    if (error) throw error;
    resetDeliveryForm();
    await loadDeliverySettings();
    showAlert(appAlert, "Delivery settings saved.");
  } catch (error) {
    showAlert(appAlert, error.message || "Could not save delivery settings.", true);
  }
});
document.getElementById("cancel-delivery").addEventListener("click", resetDeliveryForm);
async function deactivateAllDeliverySettings() {
  const { error } = await supabase
    .from("delivery_settings")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true);
  if (error) throw error;
}
function editDelivery(item) {
  if (!item) return;
  document.getElementById("delivery-id").value = item.id;
  document.getElementById("delivery-fee").value = item.delivery_fee ?? "";
  document.getElementById("delivery-threshold").value = item.free_delivery_threshold ?? "";
  document.getElementById("delivery-enabled").checked = Boolean(item.is_delivery_enabled);
  document.getElementById("free-delivery-enabled").checked = Boolean(item.is_free_delivery_enabled);
  document.getElementById("delivery-active").checked = Boolean(item.is_active);
}
function resetDeliveryForm() {
  deliveryForm.reset();
  document.getElementById("delivery-id").value = "";
}
async function toggleDelivery(item) {
  if (!item) return;
  try {
    if (!item.is_active) await deactivateAllDeliverySettings();
    const { error } = await supabase
      .from("delivery_settings")
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) throw error;
    await loadDeliverySettings();
  } catch (error) {
    showAlert(appAlert, error.message, true);
  }
}
async function deleteDelivery(id) {
  if (!confirm("Delete this delivery setting?")) return;
  const { error } = await supabase.from("delivery_settings").delete().eq("id", id);
  if (error) showAlert(appAlert, error.message, true);
  else await loadDeliverySettings();
}

// Promo codes
async function loadPromos() {
  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      "id,code,discount_type,discount_value,minimum_order_amount,maximum_discount_amount,starts_at,expires_at,usage_limit,usage_count,is_active",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  promoRows.innerHTML =
    (data || [])
      .map(
        (item) =>
          `<tr><td><strong>${escapeHtml(item.code)}</strong></td><td>${item.discount_type === "percentage" ? `${item.discount_value}%` : formatNaira(item.discount_value)}</td><td>${item.usage_count}${item.usage_limit ? ` / ${item.usage_limit}` : ""}</td><td>${item.is_active ? '<span class="badge">Active</span>' : "Inactive"}</td><td><button class="btn btn-secondary" data-promo-edit="${item.id}">Edit</button> <button class="btn btn-secondary" data-promo-toggle="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button> <button class="btn btn-secondary" data-promo-delete="${item.id}">Delete</button></td></tr>`,
      )
      .join("") || '<tr><td colspan="5" class="muted">No promo codes yet.</td></tr>';
  promoRows
    .querySelectorAll("[data-promo-edit]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        editPromo(data.find((item) => item.id === button.dataset.promoEdit)),
      ),
    );
  promoRows
    .querySelectorAll("[data-promo-toggle]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        togglePromo(data.find((item) => item.id === button.dataset.promoToggle)),
      ),
    );
  promoRows
    .querySelectorAll("[data-promo-delete]")
    .forEach((button) =>
      button.addEventListener("click", () => deletePromo(button.dataset.promoDelete)),
    );
}

promoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert(appAlert);
  try {
    const id = document.getElementById("promo-id").value;
    const starts = document.getElementById("promo-start").value;
    const expires = document.getElementById("promo-expires").value;
    const payload = {
      code: document.getElementById("promo-code").value.trim().toUpperCase(),
      discount_type: document.getElementById("promo-type").value,
      discount_value: Number(document.getElementById("promo-value").value),
      minimum_order_amount: Number(document.getElementById("promo-minimum").value) || 0,
      maximum_discount_amount: document.getElementById("promo-maximum").value
        ? Number(document.getElementById("promo-maximum").value)
        : null,
      usage_limit: document.getElementById("promo-limit").value
        ? Number.parseInt(document.getElementById("promo-limit").value, 10)
        : null,
      starts_at: starts ? new Date(starts).toISOString() : null,
      expires_at: expires ? new Date(expires).toISOString() : null,
      is_active: document.getElementById("promo-active").checked,
      updated_at: new Date().toISOString(),
    };
    const query = id
      ? supabase.from("promo_codes").update(payload).eq("id", id)
      : supabase.from("promo_codes").insert(payload);
    const { error } = await query;
    if (error) throw error;
    resetPromoForm();
    await loadPromos();
    showAlert(appAlert, "Promo code saved.");
  } catch (error) {
    showAlert(appAlert, error.message || "Could not save promo code.", true);
  }
});
document.getElementById("cancel-promo").addEventListener("click", resetPromoForm);
function editPromo(item) {
  if (!item) return;
  document.getElementById("promo-id").value = item.id;
  document.getElementById("promo-code").value = item.code;
  document.getElementById("promo-type").value = item.discount_type;
  document.getElementById("promo-value").value = item.discount_value;
  document.getElementById("promo-minimum").value = item.minimum_order_amount;
  document.getElementById("promo-maximum").value = item.maximum_discount_amount ?? "";
  document.getElementById("promo-limit").value = item.usage_limit ?? "";
  document.getElementById("promo-start").value = toLocalInput(item.starts_at);
  document.getElementById("promo-expires").value = toLocalInput(item.expires_at);
  document.getElementById("promo-active").checked = item.is_active;
}
function resetPromoForm() {
  promoForm.reset();
  document.getElementById("promo-id").value = "";
}
async function togglePromo(item) {
  if (!item) return;
  const { error } = await supabase
    .from("promo_codes")
    .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
    .eq("id", item.id);
  if (error) showAlert(appAlert, error.message, true);
  else await loadPromos();
}
async function deletePromo(id) {
  if (!confirm("Delete this promo code?")) return;
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) showAlert(appAlert, error.message, true);
  else await loadPromos();
}
function toLocalInput(value) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
