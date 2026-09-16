import { supabase } from "../lib/supabaseClient.js";
import { getCurrentSession } from "./authService.js";

const CHECKOUT_ORDER_KEY = "beulah_checkout_order";

async function syncCheckoutOrderHint() {
  // Hydrate the durable authenticated cart before checkout.js reads it. This
  // lets checkout survive a cleared browser cart cache as well.
  try {
    const { hydrateCartFromDatabase } = await import("./cartService.js");
    await hydrateCartFromDatabase();
  } catch (error) {
    console.error("Could not hydrate cart before checkout:", error);
  }

  const params = new URLSearchParams(location.search);
  const hasExplicitCartSelection = params.get("items")?.trim();
  const explicitOrderId = params.get("order")?.trim();

  const session = await getCurrentSession();
  if (!session?.user?.id) return;

  // A checkout opened from Cart is explicitly starting from that selection.
  // Never let an older reservation hijack a new checkout.
  if (hasExplicitCartSelection) {
    localStorage.removeItem(CHECKOUT_ORDER_KEY);
    return;
  }

  // A reservation opened from My Reservations must restore that exact order.
  // checkout.js still verifies ownership and payment state against Supabase;
  // this URL value is only a locator, never an authorization boundary.
  if (explicitOrderId) {
    localStorage.setItem(
      CHECKOUT_ORDER_KEY,
      JSON.stringify({
        userId: session.user.id,
        orderId: explicitOrderId,
      }),
    );
    return;
  }

  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("id,customer_id,status,payment_status,updated_at")
    .eq("customer_id", session.user.id)
    .eq("payment_status", "pending")
    .in("status", ["pending_payment", "cancelled"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (orderError) {
    console.error("Could not restore checkout state:", orderError);
    return;
  }

  if (!orders?.length) {
    localStorage.removeItem(CHECKOUT_ORDER_KEY);
    return;
  }

  const orderIds = orders.map((order) => order.id);
  const { data: reservations, error: reservationError } = await supabase
    .from("reservations")
    .select("id,order_id,status,expires_at,created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (reservationError) {
    console.error("Could not restore reservation state:", reservationError);
    return;
  }

  const reservationsByOrder = new Map();
  for (const reservation of reservations || []) {
    if (!reservationsByOrder.has(reservation.order_id)) {
      reservationsByOrder.set(reservation.order_id, reservation);
    }
  }

  const candidate = orders.find((order) => {
    const reservation = reservationsByOrder.get(order.id);
    if (!reservation) return false;
    if (reservation.status === "active") return Date.parse(reservation.expires_at) > Date.now();
    return reservation.status === "expired" || reservation.status === "cancelled";
  });

  if (!candidate) {
    localStorage.removeItem(CHECKOUT_ORDER_KEY);
    return;
  }

  localStorage.setItem(
    CHECKOUT_ORDER_KEY,
    JSON.stringify({
      userId: session.user.id,
      orderId: String(candidate.id),
    }),
  );
}

// Top-level await makes checkout.js start only after the database-backed
// cart and checkout locator have been refreshed. Browser storage is only a
// cache/locator, not the authority for order or cart state.
await syncCheckoutOrderHint();
