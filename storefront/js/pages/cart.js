import { initHeader } from "../components/navbar.js";
import { getProductsByIds } from "../services/catalogService.js";
import {
  getCart,
  updateCartQuantity,
  removeFromCart,
  onCartChange,
} from "../services/cartService.js";

initHeader(document.getElementById("site-header-nav"));

const list = document.getElementById("cart-list");
const status = document.getElementById("cart-status");
const empty = document.getElementById("cart-empty");
const summary = document.getElementById("cart-summary");
const selectBar = document.getElementById("cart-select-bar");
const selectAll = document.getElementById("cart-select-all");
const selectedCount = document.getElementById("cart-selected-count");
const selectedItems = document.getElementById("cart-selected-items");
const subtotalEl = document.getElementById("cart-subtotal");
const checkoutLink = document.getElementById("checkout-link");

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

let products = new Map();
let selectedIds = new Set();
let rendering = false;

function setStatus(message = "", type = "") {
  status.textContent = message;
  status.className = `cart-status${type ? ` cart-status--${type}` : ""}`;
  status.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[char]);
}

function syncSelection(cart) {
  const ids = new Set(cart.map((item) => item.productId));
  selectedIds = new Set([...selectedIds].filter((id) => ids.has(id)));
  if (!selectedIds.size) selectedIds = new Set(ids);
}

function getSelectedCartItems(cart) {
  return cart.filter((item) => selectedIds.has(item.productId) && products.has(item.productId));
}

function render(cart) {
  if (rendering) return;
  rendering = true;
  try {
    syncSelection(cart);
    list.innerHTML = "";

    if (!cart.length) {
      empty.hidden = false;
      summary.hidden = true;
      selectBar.hidden = true;
      return;
    }

    empty.hidden = true;
    summary.hidden = false;
    selectBar.hidden = false;

    for (const item of cart) {
      const product = products.get(item.productId);
      const row = document.createElement("article");
      row.className = "cart-item";
      row.dataset.productId = item.productId;

      if (!product) {
        row.innerHTML = `<div class="cart-item__details"><strong>Product unavailable</strong><p>This product is no longer available.</p></div><button class="btn btn-secondary" type="button" data-remove>Remove</button>`;
      } else {
        const available = Math.max(0, Number(product.stock_quantity) || 0);
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const checked = selectedIds.has(item.productId) ? "checked" : "";
        const image = product.image_src
          ? `<img src="${escapeHtml(product.image_src)}" alt="${escapeHtml(product.name)}">`
          : "";
        row.innerHTML = `
          <label class="cart-item__select"><input type="checkbox" data-select ${checked} aria-label="Select ${escapeHtml(product.name)}"></label>
          <div class="cart-item__image">${image}</div>
          <div class="cart-item__details">
            <a href="product.html?slug=${encodeURIComponent(product.slug || "")}">${escapeHtml(product.name)}</a>
            <span>${money.format(Number(product.price) || 0)}</span>
            <small>${available > 0 ? `${available} available` : "Currently unavailable"}</small>
          </div>
          <div class="cart-item__actions">
            <div class="cart-quantity">
              <button type="button" data-decrease aria-label="Decrease quantity">−</button>
              <span>${quantity}</span>
              <button type="button" data-increase aria-label="Increase quantity" ${quantity >= available && available > 0 ? "disabled" : ""}>+</button>
            </div>
            <button class="cart-remove" type="button" data-remove>Remove</button>
          </div>`;
      }
      list.append(row);
    }

    const selected = getSelectedCartItems(cart);
    const subtotal = selected.reduce((total, item) => {
      const product = products.get(item.productId);
      return total + (Number(product?.price) || 0) * item.quantity;
    }, 0);

    selectedCount.textContent = `${selected.length} selected`;
    selectedItems.textContent = String(selected.reduce((total, item) => total + item.quantity, 0));
    subtotalEl.textContent = money.format(subtotal);
    selectAll.checked = selected.length === cart.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < cart.length;

    const ids = selected.map((item) => item.productId);
    checkoutLink.href = ids.length ? `checkout.html?items=${encodeURIComponent(ids.join(","))}` : "checkout.html";
    checkoutLink.setAttribute("aria-disabled", ids.length ? "false" : "true");
    checkoutLink.classList.toggle("is-disabled", !ids.length);
  } finally {
    rendering = false;
  }
}

async function load() {
  const cart = getCart();
  render(cart);
  if (!cart.length) return;

  try {
    const fetched = await getProductsByIds(cart.map((item) => item.productId));
    products = new Map(fetched.map((product) => [String(product.id), product]));
    render(getCart());

    const missing = cart.filter((item) => !products.has(item.productId));
    if (missing.length) setStatus("Some cart items are no longer available. Remove them before checkout.", "error");
  } catch (error) {
    console.error(error);
    setStatus("We could not refresh product information. Please try again.", "error");
  }
}

list.addEventListener("click", (event) => {
  const row = event.target.closest("[data-product-id]");
  if (!row) return;
  const id = row.dataset.productId;
  const item = getCart().find((entry) => entry.productId === id);
  if (!item) return;

  if (event.target.closest("[data-increase]")) updateCartQuantity(id, item.quantity + 1);
  if (event.target.closest("[data-decrease]")) updateCartQuantity(id, item.quantity - 1);
  if (event.target.closest("[data-remove]")) {
    selectedIds.delete(id);
    removeFromCart(id);
  }
});

list.addEventListener("change", (event) => {
  const row = event.target.closest("[data-product-id]");
  if (!row || !event.target.matches("[data-select]")) return;
  const id = row.dataset.productId;
  if (event.target.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  render(getCart());
});

selectAll.addEventListener("change", () => {
  const cart = getCart();
  selectedIds = selectAll.checked ? new Set(cart.map((item) => item.productId)) : new Set();
  render(cart);
});

checkoutLink.addEventListener("click", (event) => {
  if (!selectedIds.size) event.preventDefault();
});

onCartChange(() => {
  render(getCart());
});

load();
