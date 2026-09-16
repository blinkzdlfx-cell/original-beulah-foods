const SELECTION_KEY = "beulah_checkout_selection";

function readSelection() {
  try {
    const raw = sessionStorage.getItem(SELECTION_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))] : [];
  } catch {
    return [];
  }
}

function writeSelection(ids) {
  const normalized = [...new Set((ids ?? []).map(String).filter(Boolean))];
  if (normalized.length) sessionStorage.setItem(SELECTION_KEY, JSON.stringify(normalized));
  else sessionStorage.removeItem(SELECTION_KEY);
  return normalized;
}

export function getCheckoutSelection() {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("items");
  if (fromUrl) return writeSelection(fromUrl.split(","));
  return readSelection();
}

export function setCheckoutSelection(productIds) {
  return writeSelection(productIds);
}

export function clearCheckoutSelection() {
  sessionStorage.removeItem(SELECTION_KEY);
}

// This module deliberately does not query orders, reservations, or a database cart.
// A checkout page starts from the current cart selection unless an explicit order
// URL is being handled by a dedicated order/retry flow.
export const checkoutStateContract = Object.freeze({
  selectionStorageKey: SELECTION_KEY,
  restoresPendingOrdersAutomatically: false,
  restoresDatabaseCart: false,
});
