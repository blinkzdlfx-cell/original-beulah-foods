const CART_KEY = "beulah_foods_cart";
const CART_EVENT = "beulah:cart-changed";

let lastSignature = null;

function normalizeItem(item) {
  const productId = String(item?.productId ?? "").trim();
  const quantity = Number.parseInt(item?.quantity, 10);
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { productId, quantity };
}

export function normalizeCart(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  for (const item of items) {
    const normalized = normalizeItem(item);
    if (!normalized) continue;
    merged.set(normalized.productId, (merged.get(normalized.productId) ?? 0) + normalized.quantity);
  }
  return [...merged.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

export function cartSignature(items) {
  return normalizeCart(items).map(({ productId, quantity }) => `${productId}:${quantity}`).join("|");
}

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? normalizeCart(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(items) {
  const normalized = normalizeCart(items);
  const nextSignature = cartSignature(normalized);
  if (nextSignature === lastSignature) return normalized;

  localStorage.setItem(CART_KEY, JSON.stringify(normalized));
  lastSignature = nextSignature;
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: normalized }));
  return normalized;
}

export function refreshCart() {
  return persist(getCart());
}

// Compatibility export. The rebuilt cart never synchronizes with a database cart.
export async function hydrateCartFromDatabase() {
  return refreshCart();
}

export function addToCart(productId, quantity = 1) {
  const id = String(productId ?? "").trim();
  const amount = Math.max(1, Number.parseInt(quantity, 10) || 1);
  if (!id) return getCart();

  const items = getCart();
  const existing = items.find((item) => item.productId === id);
  if (existing) existing.quantity += amount;
  else items.push({ productId: id, quantity: amount });
  return persist(items);
}

export function updateCartQuantity(productId, quantity) {
  const id = String(productId ?? "").trim();
  const nextQuantity = Number.parseInt(quantity, 10) || 0;
  return persist(
    getCart()
      .map((item) => (item.productId === id ? { ...item, quantity: nextQuantity } : item))
      .filter((item) => item.quantity > 0),
  );
}

export function removeFromCart(productId) {
  const id = String(productId ?? "").trim();
  return persist(getCart().filter((item) => item.productId !== id));
}

export function removeCartItems(productIds = []) {
  const ids = new Set(productIds.map(String));
  return persist(getCart().filter((item) => !ids.has(item.productId)));
}

export function clearCart() {
  return persist([]);
}

export function getCartItemCount() {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}

export function onCartChange(callback) {
  const handler = (event) => callback(event.detail ?? getCart());
  window.addEventListener(CART_EVENT, handler);
  return () => window.removeEventListener(CART_EVENT, handler);
}

// Keep the signature stable across module imports without causing an event.
lastSignature = cartSignature(getCart());
