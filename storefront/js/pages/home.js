import { initHeader } from "../components/navbar.js";
import { getCurrentSession, onAuthStateChange } from "../services/authService.js";
import {
  getFeaturedProducts,
  getHomepageCategories,
  getProducts,
} from "../services/catalogService.js";
import { addToCart, getCart } from "../services/cartService.js";
import { showToast } from "../components/toast.js";

initHeader(document.getElementById("site-header-nav"));

const featuredSection = document.getElementById("featured-products");
const featuredGrid = document.getElementById("featured-product-grid");
const categorySection = document.getElementById("shop-by-category");
const categoryGrid = document.getElementById("homepage-category-grid");
const homepageProductCount = document.getElementById("homepage-product-count");
const ctaTitle = document.getElementById("cta-title");
const ctaCopy = document.getElementById("cta-copy");
const ctaPrimaryAction = document.getElementById("cta-primary-action");
const ctaSecondaryAction = document.getElementById("cta-secondary-action");
let welcomeShown = false;

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}
function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}
function icon(name, className = "icon") {
  return `<svg class="${className}" aria-hidden="true"><use href="assets/icons.svg#${name}"></use></svg>`;
}

function renderFeaturedProducts(products) {
  if (!featuredSection || !featuredGrid) return;
  featuredGrid.innerHTML = "";
  if (!products.length) {
    featuredSection.hidden = true;
    return;
  }
  featuredSection.hidden = false;

  for (const product of products) {
    const detailUrl = `product.html?slug=${encodeURIComponent(product.slug)}`;
    const stock = Math.max(0, Number(product.stock_quantity) || 0);
    const inStock = stock > 0;
    const categoryName = product.categories?.name || "Beulah Foods";
    const card = document.createElement("article");
    card.className = "product-card home-product-card";
    card.innerHTML = `<a class="product-card__media" href="${detailUrl}" aria-label="View ${escapeAttribute(product.name)}">${product.image_src ? `<img class="product-card__image" src="${escapeAttribute(product.image_src)}" alt="${escapeAttribute(product.name)}" loading="lazy">` : `<span class="product-card__image-placeholder">${icon("leaf")}</span>`}<span class="product-card__badge">${inStock ? "In stock" : "Unavailable"}</span></a><div class="product-card__body"><p class="product-card__category">${escapeHtml(categoryName)}</p><h3><a href="${detailUrl}">${escapeHtml(product.name)}</a></h3><p class="product-card__meta">${escapeHtml(product.description || "Wholesome Nigerian food product.")}</p><div class="product-card__footer"><strong>${naira.format(Number(product.price))}</strong><button class="btn btn-primary product-card__add" type="button" ${inStock ? "" : "disabled"}>${inStock ? "Add to cart" : "Unavailable"}</button></div></div>`;
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
    featuredGrid.append(card);
  }
  renderFeaturedStructuredData(products);
}

function renderFeaturedStructuredData(products) {
  document.getElementById("homepage-featured-schema")?.remove();
  if (!products.length) return;
  const schema = document.createElement("script");
  schema.id = "homepage-featured-schema";
  schema.type = "application/ld+json";
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Featured Beulah Foods products",
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://beulah-foods.blinkzdlfx.workers.dev/storefront/product.html?slug=${encodeURIComponent(product.slug)}`,
      item: {
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        image: product.image_src || undefined,
        offers: {
          "@type": "Offer",
          priceCurrency: "NGN",
          price: Number(product.price),
          availability:
            Number(product.stock_quantity) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
        },
      },
    })),
  });
  document.head.append(schema);
}

function renderHomepageCategories(categories) {
  if (!categorySection || !categoryGrid) return;
  categoryGrid.innerHTML = "";
  if (!categories.length) {
    categorySection.hidden = true;
    return;
  }
  categorySection.hidden = false;
  const iconNames = ["leaf", "heart", "box", "shield", "leaf", "heart"];
  categories.forEach((category, index) => {
    const link = document.createElement("a");
    link.className = "category-card";
    link.href = `shop.html?category=${encodeURIComponent(category.slug)}`;
    link.innerHTML = `${icon(iconNames[index % iconNames.length], "icon category-card__icon")}<span><strong>${escapeHtml(category.name)}</strong><small>${category.product_count} ${category.product_count === 1 ? "product" : "products"}</small></span>${icon("arrow-right", "icon category-card__arrow")}`;
    categoryGrid.append(link);
  });
}

async function loadHomepageCatalogue() {
  try {
    const [featured, categories, allProducts] = await Promise.all([
      getFeaturedProducts({ limit: 4 }),
      getHomepageCategories({ limit: 6 }),
      getProducts({ page: 1, pageSize: 1 }),
    ]);
    renderFeaturedProducts(featured);
    renderHomepageCategories(categories);
    if (homepageProductCount) homepageProductCount.textContent = String(allProducts.count ?? 0);
  } catch (error) {
    console.error("Homepage catalogue load failed", error);
    featuredSection && (featuredSection.hidden = true);
    categorySection && (categorySection.hidden = true);
  }
}

function updateAuthenticatedContent(session) {
  const signedIn = Boolean(session?.user);
  const isNewAccount =
    signedIn && !welcomeShown && window.localStorage.getItem("beulah:new-account-welcome") === "1";
  if (isNewAccount) {
    welcomeShown = true;
    window.localStorage.removeItem("beulah:new-account-welcome");
  }
  if (ctaTitle)
    ctaTitle.textContent = isNewAccount
      ? "Welcome to Beulah Foods."
      : signedIn
        ? "Good food starts with good choices."
        : "Bring better food choices home.";
  if (ctaCopy)
    ctaCopy.textContent = isNewAccount
      ? "Your account is ready. Add your delivery details whenever you’re ready, then explore the Beulah Foods catalogue."
      : signedIn
        ? "Discover wholesome food products, keep your details ready for checkout and shop from the live Beulah Foods catalogue."
        : "Create an account, discover our products and make everyday food shopping simpler.";
  if (ctaPrimaryAction) {
    ctaPrimaryAction.href = signedIn ? "shop.html" : "signup.html";
    ctaPrimaryAction.textContent = isNewAccount
      ? "Start shopping"
      : signedIn
        ? "Shop now"
        : "Create an account";
  }
  if (ctaSecondaryAction) {
    ctaSecondaryAction.href = signedIn ? "account.html" : "login.html";
    ctaSecondaryAction.textContent = isNewAccount
      ? "View my details"
      : signedIn
        ? "My account"
        : "Log in";
  }
}

loadHomepageCatalogue();
getCurrentSession()
  .then(updateAuthenticatedContent)
  .catch(() => updateAuthenticatedContent(null));
onAuthStateChange((_event, session) => updateAuthenticatedContent(session));
const footerYear = document.getElementById("footer-year");
if (footerYear) footerYear.textContent = String(new Date().getFullYear());
