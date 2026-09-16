const CART_KEY = "beulah_foods_cart";
const CART_EVENT = "beulah:cart-changed";

let databaseHydrationPromise = null;
let databasePersistenceQueue = Promise.resolve();
let cartMutationVersion = 0;

function normalizeItem(item) {
  const quantity = Number.parseInt(item.quantity, 10);
  return {
    productId: String(item.productId),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
}

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  const normalized = items.map(normalizeItem);
  cartMutationVersion += 1;
  localStorage.setItem(CART_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: normalized }));
  return normalized;
}

async function getSupabaseCartApi() {
  const [{ supabase }, { getCurrentSession }] = await Promise.all([
    import("../lib/supabaseClient.js"),
    import("./authService.js"),
  ]);
  const session = await getCurrentSession();
  if (!session?.user) return null;
  return { supabase };
}

function queueDatabasePersistence(items, mode, mutationVersion) {
  const snapshot = items.map(normalizeItem);
  const task = async () => {
    try {
      const api = await getSupabaseCartApi();
      if (!api) return null;
      const { data, error } = await api.supabase.rpc(
        mode === "merge" ? "merge_customer_cart" : "set_customer_cart",
        { cart_items: snapshot },
      );
      if (error) throw error;
      const databaseItems = Array.isArray(data) ? data.map(normalizeItem) : [];

      // Never let a stale database response overwrite a newer local mutation.
      if (mutationVersion === cartMutationVersion) return saveCart(databaseItems);
      return databaseItems;
    } catch (error) {
      console.error("Cart database sync failed:", error);
      return null;
    }
  };

  databasePersistenceQueue = databasePersistenceQueue.then(task, task);
  return databasePersistenceQueue;
}

async function persistCartToDatabase(items, mode = "set") {
  return queueDatabasePersistence(items, mode, cartMutationVersion);
}

export async function hydrateCartFromDatabase() {
  if (databaseHydrationPromise) return databaseHydrationPromise;

  databaseHydrationPromise = (async () => {
    try {
      const localItems = getCart();
      const api = await getSupabaseCartApi();
      if (!api) return localItems;

      const { data, error } = await api.supabase.rpc("get_customer_cart");
      if (error) throw error;
      const databaseItems = Array.isArray(data) ? data.map(normalizeItem) : [];

      // Merge a cart created before login into the durable customer cart.
      if (localItems.length) {
        return (await persistCartToDatabase(localItems, "merge")) ?? databaseItems;
      }

      if (cartMutationVersion === 0) return saveCart(databaseItems);
      return getCart();
    } catch (error) {
      console.error("Cart hydration failed:", error);
      return getCart();
    } finally {
      databaseHydrationPromise = null;
    }
  })();

  return databaseHydrationPromise;
}

export function addToCart(productId, quantity = 1) {
  const items = getCart();
  const id = String(productId);
  const amount = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const existing = items.find((item) => item.productId === id);
  if (existing) existing.quantity += amount;
  else items.push({ productId: id, quantity: amount });
  const next = saveCart(items);
  void persistCartToDatabase(next, "set");
  return next;
}

export function updateCartQuantity(productId, quantity) {
  const nextQuantity = Number.parseInt(quantity, 10) || 0;
  const items = getCart()
    .map((item) =>
      item.productId === String(productId) ? { ...item, quantity: nextQuantity } : item,
    )
    .filter((item) => item.quantity > 0);
  const next = saveCart(items);
  void persistCartToDatabase(next, "set");
  return next;
}

export function removeFromCart(productId) {
  const items = getCart().filter((item) => item.productId !== String(productId));
  const next = saveCart(items);
  void persistCartToDatabase(next, "set");
  return next;
}

export function removeCartItems(productIds) {
  const ids = new Set((productIds || []).map(String));
  const items = getCart().filter((item) => !ids.has(String(item.productId)));
  const next = saveCart(items);
  void persistCartToDatabase(next, "set");
  return next;
}

export function clearCart() {
  const next = saveCart([]);
  void persistCartToDatabase(next, "set");
  return next;
}

export function getCartItemCount() {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}

export function onCartChange(callback) {
  const handler = (event) => callback(event.detail ?? getCart());
  window.addEventListener(CART_EVENT, handler);
  return () => window.removeEventListener(CART_EVENT, handler);
}
