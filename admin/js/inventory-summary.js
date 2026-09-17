import { supabase } from "./lib/supabaseClient.js";

const CACHE_KEY = "beulah-admin-available-products-v2";
const CACHE_TTL_MS = 15 * 1000;
let refreshPromise = null;

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed.value) || !Number.isFinite(parsed.timestamp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ value, timestamp: Date.now() }));
  } catch {
    // Cache is an optimization only; the live database remains authoritative.
  }
}

function invalidateCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

function render(card, value) {
  card.textContent = String(value);
}

async function fetchAvailableProducts(card) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const [{ data: products, error: productError }, { data: reservations, error: reservationError }] =
      await Promise.all([
        supabase.from("products").select("id,stock_quantity").eq("is_active", true),
        supabase
          .from("reservation_items")
          .select("product_id,quantity,reservations!inner(status,expires_at)")
          .eq("reservations.status", "active")
          .gt("reservations.expires_at", new Date().toISOString()),
      ]);

    if (productError) throw productError;
    if (reservationError) throw reservationError;

    const reservedByProduct = new Map();
    for (const row of reservations || []) {
      reservedByProduct.set(
        row.product_id,
        (reservedByProduct.get(row.product_id) || 0) + (Number(row.quantity) || 0),
      );
    }

    const available = (products || []).reduce(
      (total, product) =>
        total +
        Math.max(
          0,
          (Number(product.stock_quantity) || 0) - (reservedByProduct.get(product.id) || 0),
        ),
      0,
    );

    writeCache(available);
    render(card, available);
    return available;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshAvailableProducts({ force = false } = {}) {
  const card = document.getElementById("available-product-count");
  if (!card) return;

  const cached = readCache();
  const cacheIsFresh = cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

  if (!force && cached) render(card, cached.value);
  if (!force && cacheIsFresh) return;

  try {
    await fetchAvailableProducts(card);
  } catch (error) {
    console.warn("Could not refresh available product count", error);
    if (!cached) card.textContent = "0";
  }
}

function init() {
  const app = document.getElementById("admin-app");
  if (!app) return;

  const refresh = () => {
    if (!app.classList.contains("hidden")) refreshAvailableProducts();
  };

  const forceRefresh = () => {
    if (!app.classList.contains("hidden")) {
      invalidateCache();
      refreshAvailableProducts({ force: true });
    }
  };

  refresh();
  window.addEventListener("beulah:admin-inventory-refresh", forceRefresh);
  window.addEventListener("beulah:delivery-saved", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  setInterval(refresh, 30000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
