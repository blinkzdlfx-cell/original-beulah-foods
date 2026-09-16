import { initHeader } from "../components/navbar.js";
import { getProductsByIds } from "../services/catalogService.js";
import {
  getCart,
  hydrateCartFromDatabase,
  updateCartQuantity,
  removeFromCart,
} from "../services/cartService.js";
import { showToast } from "../components/toast.js";

initHeader(document.getElementById("site-header-nav"));
const list = document.getElementById("cart-list"),
  empty = document.getElementById("cart-empty"),
  summary = document.getElementById("cart-summary"),
  subtotalEl = document.getElementById("cart-subtotal"),
  selectedItemsEl = document.getElementById("cart-selected-items"),
  selectedCountEl = document.getElementById("cart-selected-count"),
  selectBar = document.getElementById("cart-select-bar"),
  selectAll = document.getElementById("cart-select-all"),
  status = document.getElementById("cart-status"),
  checkoutLink = document.getElementById("checkout-link");
const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});
const SELECTION_KEY = "beulah_checkout_selection";

function getSelection() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SELECTION_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}
function saveSelection(selection) {
  sessionStorage.setItem(SELECTION_KEY, JSON.stringify([...selection]));
}
function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `cart-status${type ? ` cart-status--${type}` : ""}`;
  status.hidden = !message;
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>\"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}
function setQuantity(productId, quantity, max) {
  const nextQuantity = Math.max(1, Math.min(max, Number(quantity) || 1));
  updateCartQuantity(productId, nextQuantity);
  render();
  showToast(`Quantity updated to ${nextQuantity}.`);
}

function updateSelectionUI(validItems) {
  const selection = getSelection();
  const validIds = new Set(validItems.map((item) => String(item.product.id)));
  for (const id of [...selection]) if (!validIds.has(id)) selection.delete(id);
  saveSelection(selection);
  const selectedItems = validItems.filter((item) => selection.has(String(item.product.id)));
  const selectedQuantity = selectedItems.reduce(
    (total, item) =>
      total + Math.min(item.quantity, Math.max(1, Number(item.product.stock_quantity) || 1)),
    0,
  );
  const selectedSubtotal = selectedItems.reduce(
    (total, item) =>
      total +
      Number(item.product.price) *
        Math.min(item.quantity, Math.max(1, Number(item.product.stock_quantity) || 1)),
    0,
  );
  selectedCountEl.textContent = `${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} selected`;
  selectedItemsEl.textContent = String(selectedQuantity);
  subtotalEl.textContent = naira.format(selectedSubtotal);
  selectAll.checked = validItems.length > 0 && selectedItems.length === validItems.length;
  selectAll.indeterminate = selectedItems.length > 0 && selectedItems.length < validItems.length;
  checkoutLink.classList.toggle("is-disabled", selectedItems.length === 0);
  checkoutLink.setAttribute("aria-disabled", String(selectedItems.length === 0));
  checkoutLink.href = selectedItems.length
    ? `checkout.html?items=${encodeURIComponent(selectedItems.map((item) => item.product.id).join(","))}`
    : "#";
}

async function render() {
  setStatus("Loading cart...");
  try {
    const cart = getCart();
    if (!cart.length) {
      list.innerHTML = "";
      empty.hidden = false;
      summary.hidden = true;
      selectBar.hidden = true;
      subtotalEl.textContent = naira.format(0);
      setStatus("");
      return;
    }

    const products = await getProductsByIds(cart.map((item) => item.productId));
    const productMap = new Map(products.map((product) => [String(product.id), product]));
    const validItems = cart
      .map((item) => ({ ...item, product: productMap.get(item.productId) }))
      .filter((item) => item.product);
    const selection = getSelection();
    if (!selection.size) validItems.forEach((item) => selection.add(String(item.product.id)));
    saveSelection(selection);
    list.innerHTML = "";

    for (const item of validItems) {
      const product = item.product,
        max = Math.max(1, Number(product.stock_quantity) || 1),
        quantity = Math.min(item.quantity, max);
      if (item.quantity !== quantity) updateCartQuantity(product.id, quantity);
      const row = document.createElement("article");
      row.className = `cart-item${selection.has(String(product.id)) ? " is-selected" : ""}`;
      const media = product.image_src
        ? `<a class="cart-item__media" href="product.html?slug=${encodeURIComponent(product.slug)}"><img src="${escapeHtml(product.image_src)}" alt="${escapeHtml(product.name)}"></a>`
        : "";
      row.innerHTML = `<label class="cart-item__select"><input type="checkbox" ${selection.has(String(product.id)) ? "checked" : ""} data-select-product="${escapeHtml(product.id)}" aria-label="Select ${escapeHtml(product.name)} for checkout"></label><div class="cart-item__media-wrap">${media}</div><div class="cart-item__content"><div><p class="eyebrow">Beulah Foods</p><h2><a href="product.html?slug=${encodeURIComponent(product.slug)}">${escapeHtml(product.name)}</a></h2><strong>${naira.format(Number(product.price))}</strong></div><div class="cart-item__controls"><div class="cart-quantity-control" role="group" aria-label="Quantity for ${escapeHtml(product.name)}"><button class="cart-quantity-button cart-quantity-button--minus" type="button" data-product-id="${escapeHtml(product.id)}" aria-label="Decrease quantity"${quantity <= 1 ? " disabled" : ""}>−</button><input class="cart-quantity" type="number" min="1" max="${max}" value="${quantity}" data-product-id="${escapeHtml(product.id)}" aria-label="Quantity"><button class="cart-quantity-button cart-quantity-button--plus" type="button" data-product-id="${escapeHtml(product.id)}" aria-label="Increase quantity"${quantity >= max ? " disabled" : ""}>+</button></div><button class="text-button cart-remove" type="button" data-product-id="${escapeHtml(product.id)}">Remove</button></div></div>`;
      const checkbox = row.querySelector("[data-select-product]");
      checkbox.addEventListener("change", () => {
        const next = getSelection();
        if (checkbox.checked) next.add(String(product.id));
        else next.delete(String(product.id));
        saveSelection(next);
        render();
      });
      const input = row.querySelector(".cart-quantity");
      row
        .querySelector(".cart-quantity-button--minus")
        .addEventListener("click", () => setQuantity(product.id, Number(input.value) - 1, max));
      row
        .querySelector(".cart-quantity-button--plus")
        .addEventListener("click", () => setQuantity(product.id, Number(input.value) + 1, max));
      input.addEventListener("change", (event) => setQuantity(product.id, event.target.value, max));
      row.querySelector(".cart-remove").addEventListener("click", () => {
        const next = getSelection();
        next.delete(String(product.id));
        saveSelection(next);
        removeFromCart(product.id);
        render();
        showToast(`${product.name} removed from cart.`);
      });
      list.append(row);
    }

    const hasItems = validItems.length > 0;
    empty.hidden = hasItems;
    summary.hidden = !hasItems;
    selectBar.hidden = !hasItems;
    updateSelectionUI(validItems);
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("We could not load your cart. Please try again.", "error");
    showToast("We could not load your cart. Please try again.", "error", 3600);
  }
}

selectAll.addEventListener("change", () => {
  const cart = getCart();
  const next = getSelection();
  if (selectAll.checked) cart.forEach((item) => next.add(String(item.productId)));
  else next.clear();
  saveSelection(next);
  render();
});

(async function init() {
  await hydrateCartFromDatabase();
  await render();
})();
