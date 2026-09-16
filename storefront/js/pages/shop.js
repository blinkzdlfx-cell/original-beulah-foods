import { initHeader } from "../components/navbar.js";
import { getCategories, getProducts } from "../services/catalogService.js";
import { addToCart, getCart } from "../services/cartService.js";
import { showToast } from "../components/toast.js";

initHeader(document.getElementById("site-header-nav"));
const grid = document.getElementById("product-grid");
const categoryList = document.getElementById("category-list");
const status = document.getElementById("shop-status");
const emptyState = document.getElementById("shop-empty");
const count = document.getElementById("product-count");
const pagination = document.getElementById("shop-pagination");
const filterToggle = document.getElementById("mobile-filter-toggle");
const filters = document.getElementById("shop-filters");
let categories = [];
let currentPage = 1;
const pageSize = 12;
const initialCategory = new URLSearchParams(window.location.search).get("category") || "";
const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `shop-status${type ? ` shop-status--${type}` : ""}`;
  status.hidden = !message;
}
function getSelectedCategory() {
  return document.querySelector('input[name="category"]:checked')?.value ?? "";
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>\"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}
function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}

function renderCategories() {
  categoryList.innerHTML = "";
  const allLabel = document.createElement("label");
  allLabel.className = "filter-option";
  allLabel.innerHTML = `<input type="radio" name="category" value=""><span>All products</span>`;
  categoryList.append(allLabel);
  for (const category of categories) {
    const label = document.createElement("label");
    label.className = "filter-option";
    const checked = category.slug === initialCategory ? " checked" : "";
    label.innerHTML = `<input type="radio" name="category" value="${escapeAttribute(category.slug)}"${checked}><span>${escapeHtml(category.name)}</span>`;
    categoryList.append(label);
  }
  if (!categories.some((category) => category.slug === initialCategory))
    allLabel.querySelector("input").checked = true;
  categoryList.onchange = () => {
    currentPage = 1;
    loadProducts();
  };
}

function renderProducts(products) {
  grid.innerHTML = "";
  emptyState.hidden = products.length > 0;
  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";
    const detailUrl = `product.html?slug=${encodeURIComponent(product.slug)}`;
    const stock = Math.max(0, Number(product.stock_quantity) || 0);
    const inStock = stock > 0;
    const media = product.image_src
      ? `<a class="product-card__media" href="${detailUrl}" aria-label="View ${escapeAttribute(product.name)}"><img class="product-card__image" src="${escapeAttribute(product.image_src)}" alt="${escapeAttribute(product.name)}" loading="lazy"></a>`
      : "";
    card.innerHTML = `${media}<div class="product-card__body"><p class="product-card__availability ${inStock ? "" : "is-unavailable"}">${inStock ? `${stock} available` : "Currently unavailable"}</p><h2><a href="${detailUrl}">${escapeHtml(product.name)}</a></h2><p class="product-card__description">${escapeHtml(product.description ?? "")}</p><div class="product-card__footer"><strong>${naira.format(Number(product.price))}</strong><button class="btn btn-primary product-card__add" type="button" data-product-id="${escapeAttribute(product.id)}" ${inStock ? "" : "disabled"}>${inStock ? "Add to cart" : "Unavailable"}</button></div></div>`;
    card.querySelector(".product-card__add")?.addEventListener("click", () => {
      try {
        const existing = getCart().find((item) => String(item.productId) === String(product.id));
        const currentQuantity = Number(existing?.quantity) || 0;
        if (currentQuantity >= stock) {
          showToast(
            `Only ${stock} ${product.name} ${stock === 1 ? "is" : "are"} available.`,
            "error",
          );
          return;
        }
        addToCart(product.id, 1);
        showToast(`${product.name} added to your cart.`, "success");
      } catch (error) {
        console.error(error);
        showToast("We could not add this product to your cart.", "error");
      }
    });
    grid.append(card);
  }
}

function renderPagination(result) {
  pagination.innerHTML = "";
  if (result.totalPages <= 1) return;
  const fragment = document.createDocumentFragment();
  const previous = document.createElement("button");
  previous.className = "btn btn-secondary";
  previous.type = "button";
  previous.textContent = "Previous";
  previous.disabled = result.page <= 1;
  previous.addEventListener("click", () => {
    currentPage -= 1;
    loadProducts();
  });
  fragment.append(previous);
  const label = document.createElement("span");
  label.className = "shop-pagination__label";
  label.textContent = `Page ${result.page} of ${result.totalPages}`;
  fragment.append(label);
  const next = document.createElement("button");
  next.className = "btn btn-secondary";
  next.type = "button";
  next.textContent = "Next";
  next.disabled = result.page >= result.totalPages;
  next.addEventListener("click", () => {
    currentPage += 1;
    loadProducts();
  });
  fragment.append(next);
  pagination.append(fragment);
}

async function loadProducts() {
  setStatus("Loading products...");
  try {
    const result = await getProducts({
      categorySlug: getSelectedCategory(),
      page: currentPage,
      pageSize,
    });
    renderProducts(result.products);
    count.textContent = `${result.count} product${result.count === 1 ? "" : "s"}`;
    renderPagination(result);
    setStatus("");
  } catch (error) {
    console.error(error);
    renderProducts([]);
    pagination.innerHTML = "";
    setStatus("We could not load the product catalogue. Please try again.", "error");
  }
}

filterToggle?.addEventListener("click", () => {
  const open = filters?.hidden;
  if (filters) filters.hidden = !open;
  filterToggle.setAttribute("aria-expanded", String(open));
});

(async function init() {
  try {
    categories = await getCategories();
    renderCategories();
  } catch (error) {
    console.error(error);
    categoryList.innerHTML = '<p class="filter-error">Categories are unavailable right now.</p>';
  }
  await loadProducts();
})();
