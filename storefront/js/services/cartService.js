const CART_KEY = "beulah_foods_cart";
const CART_EVENT = "beulah:cart-changed";

let lastSignature = null;

function normalizeItem(item) {
  const productId = String(item?.productId ?? "").trim();
  const quantity = Number.parseInt(item?.quantity, 10);
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { productId, quantity };
}

function normalizeCart(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  for (const item of items) {
    const normalized = normalizeItem(item);
    if (!normalized) continue;
    merged.set(
      normalized.productId,
      (merged.get(normalized.productId) || 0) + normalized.quantity,
    );
  }
  return [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function signature(items) {
  return normalizeCart(items)
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((item) => `${item.productId}:${item.quantity}`)
    .join("|");
}

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return normalizeCart(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeCart(items, { forceEvent = false } = {}) {
  const normalized = normalizeCart(items);
  const nextSignature = signature(normalized);
  const changed = nextSignature !== lastSignature;

  if (changed || forceEvent) {
    localStorage.setItem(CART_KEY, JSON.stringify(normalized));
    lastSignature = nextSignature;
    window.dispatchEvent(
      new CustomEvent(CART_EVENT, { detail: normalized }),
    );
  }

  return normalized;
}

/**
 * Re-reads the persistent browser cart once for the current page.
 * It does not contact Supabase and does not start a polling loop.
 * A cart-change event is emitted only when the normalized state changes.
 */
export function refreshCart() {
  return writeCart(getCart());
}

/**
 * Kept as a compatibility name for existing page modules.
 * The new cart is intentionally localStorage-first, so hydration is local
 * normalization rather than a database cart merge.
 */
export async function hydrateCartFromDatabase() {
  return refreshCart();
}

export function addToCart(productId, quantity = 1) {
  const items = getCart();
  const id = String(productId);
  const amount = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const existing = items.find((item) => item.productId === id);

  if (existing) existing.quantity += amount;
  else items.push({ productId: id, quantity: amount });

  return writeCart(items);
}

export function updateCartQuantity(productId, quantity) {
  const nextQuantity = Number.parseInt(quantity, 10) || 0;
  const items = getCart()
    .map((item) =>
      item.productId === String(productId)
        ? { ...item, quantity: nextQuantity }
        : item,
    )
    .filter((item) => item.quantity > 0);

  return writeCart(items);
}

export function removeFromCart(productId) {
  return writeCart(
    getCart().filter((item) => item.productId !== String(productId)),
  );
}

export function removeCartItems(productIds) {
  const ids = new Set((productIds || []).map(String));
  return writeCart(getCart().filter((item) => !ids.has(item.productId)));
}

export function clearCart() {
  return writeCart([]);
}

export function getCartItemCount() {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}

export function onCartChange(callback) {
  const handler = (event) => callback(event.detail ?? getCart());
  window.addEventListener(CART_EVENT, handler);
  return () => window.removeEventListener(CART_EVENT, handler);
}

// Establish the in-memory signature without forcing a render on every module import.
lastSignature = signature(getCart());
