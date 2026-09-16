import { supabase } from "../lib/supabaseClient.js";

const CHECKOUT_RPC = "create_pending_checkout";

function normalizeItems(items = []) {
  return items
    .map((item) => ({
      product_id: String(item?.productId ?? "").trim(),
      quantity: Number.parseInt(item?.quantity, 10) || 0,
    }))
    .filter((item) => item.product_id && item.quantity > 0);
}

export async function createPendingCheckout({ items, promoCode = null } = {}) {
  const normalizedItems = normalizeItems(items);
  if (!normalizedItems.length) throw new Error("Your cart is empty.");

  const { data, error } = await supabase.rpc(CHECKOUT_RPC, {
    p_items: normalizedItems,
    p_promo_code: promoCode?.trim() || null,
  });
  if (error) throw error;

  // The RPC is the authoritative pricing/stock/reservation boundary.
  // It must return order + reservation data created atomically.
  if (!data?.order_id || !data?.reservation_id || !data?.expires_at) {
    throw new Error("Checkout service returned an incomplete reservation.");
  }
  return data;
}

export async function cancelCheckoutReservation(orderId) {
  if (!orderId) throw new Error("Missing order ID.");
  const { data, error } = await supabase.rpc("cancel_customer_reservation", {
    p_order_id: String(orderId),
  });
  if (error) throw error;
  return data;
}

export async function expireCheckoutReservation(orderId) {
  if (!orderId) throw new Error("Missing order ID.");
  const { data, error } = await supabase.rpc("expire_customer_reservation", {
    p_order_id: String(orderId),
  });
  if (error) throw error;
  return data;
}
