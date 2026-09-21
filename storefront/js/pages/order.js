import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));
const status = document.getElementById("order-status"),
  itemsEl = document.getElementById("order-items"),
  totalEl = document.getElementById("order-total"),
  title = document.getElementById("order-title"),
  meta = document.getElementById("order-meta"),
  reservationBox = document.getElementById("order-reservation"),
  reservationMessage = document.getElementById("order-reservation-message"),
  reservationCountdown = document.getElementById("order-reservation-countdown"),
  retryButton = document.getElementById("order-retry"),
  cancelButton = document.getElementById("order-cancel-reservation");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
let reservationTimer = null,
  currentOrder = null;
function show(message, error = false) {
  status.textContent = message;
  status.className = `alert${error ? " alert-error" : ""}`;
  status.hidden = false;
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}
function formatStatus(value) {
  return String(value || "").replaceAll("_", " ");
}
async function init() {
  const session = await getCurrentSession();
  if (!session?.user) {
    location.href = "/login?redirect=order";
    return;
  }
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    show("No order was specified.", true);
    return;
  }
  const [
    { data: order, error: orderError },
    { data: items, error: itemError },
    { data: reservation, error: reservationError },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,order_number,status,payment_status,subtotal,delivery_fee,discount_amount,total,promo_code,created_at,delivery_name,delivery_phone,delivery_address",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("product_name,unit_price,quantity,line_total")
      .eq("order_id", id)
      .order("created_at"),
    supabase.from("reservations").select("id,status,expires_at").eq("order_id", id).maybeSingle(),
  ]);
  if (orderError || itemError || reservationError)
    throw orderError || itemError || reservationError;
  if (!order) {
    show("Order not found.", true);
    return;
  }
  currentOrder = order;
  const orderNumber = order.order_number || `Order ${order.id.slice(0, 8)}`;
  title.textContent = orderNumber;
  meta.textContent = `${new Date(order.created_at).toLocaleString("en-NG")} · ${formatStatus(order.status)} · payment ${formatStatus(order.payment_status)}`;
  itemsEl.innerHTML = (items || [])
    .map(
      (item) =>
        `<div style="display:flex;justify-content:space-between;gap:16px"><span>${escapeHtml(item.product_name)} × ${item.quantity}</span><strong>${naira.format(Number(item.line_total))}</strong></div>`,
    )
    .join("");
  totalEl.innerHTML = `Subtotal: ${naira.format(Number(order.subtotal))}<br>Delivery: ${Number(order.delivery_fee) === 0 ? "Free" : naira.format(Number(order.delivery_fee))}<br>Discount${order.promo_code ? ` (${escapeHtml(order.promo_code)})` : ""}: ${naira.format(Number(order.discount_amount))}<br><strong>Total: ${naira.format(Number(order.total))}</strong>`;
  if (
    order.status === "pending_payment" &&
    order.payment_status === "pending" &&
    reservation?.status === "active"
  )
    renderReservation(reservation.expires_at);
  else if (
    order.status === "cancelled" &&
    order.payment_status === "pending" &&
    reservation?.status === "expired"
  )
    renderExpiredState();
}
function renderReservation(expiresAt) {
  reservationBox.hidden = false;
  reservationBox.classList.remove("is-expired");
  reservationMessage.textContent = "Your items are reserved while you complete payment.";
  retryButton.hidden = true;
  cancelButton.hidden = false;
  updateCountdown(expiresAt);
  reservationTimer = setInterval(() => updateCountdown(expiresAt), 1000);
}
function updateCountdown(expiresAt) {
  const remaining = Math.max(0, Date.parse(expiresAt) - Date.now());
  if (remaining <= 0) {
    if (reservationTimer) clearInterval(reservationTimer);
    reservationTimer = null;
    renderExpiredState();
    return;
  }
  const seconds = Math.ceil(remaining / 1000),
    minutes = Math.floor(seconds / 60),
    remainder = seconds % 60;
  reservationCountdown.textContent = `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
function renderExpiredState() {
  reservationBox.hidden = false;
  reservationBox.classList.add("is-expired");
  reservationCountdown.textContent = "Expired";
  reservationMessage.textContent =
    "Payment is still pending, but this reservation has expired. Retry checkout to reserve the items again if stock is available.";
  retryButton.hidden = false;
  cancelButton.hidden = true;
}
async function cancelReservation() {
  cancelButton.disabled = true;
  cancelButton.textContent = "Cancelling…";
  try {
    const { error } = await supabase.rpc("cancel_pending_order", {
      target_order_id: currentOrder.id,
    });
    if (error) throw error;
    location.href = "/checkout";
  } catch (error) {
    cancelButton.disabled = false;
    cancelButton.textContent = "Cancel reservation";
    show(error?.message || "Could not cancel the reservation. Please try again.", true);
  }
}
async function retryCheckout() {
  retryButton.disabled = true;
  retryButton.textContent = "Preparing…";
  try {
    const { error } = await supabase.rpc("cancel_pending_order", {
      target_order_id: currentOrder.id,
    });
    if (error && error.message !== "ORDER_NOT_CANCELLABLE") throw error;
    location.href = "/checkout.html";
  } catch (error) {
    retryButton.disabled = false;
    retryButton.textContent = "Retry payment";
    show(error?.message || "Could not prepare checkout. Please try again.", true);
  }
}
cancelButton?.addEventListener("click", cancelReservation);
retryButton?.addEventListener("click", retryCheckout);
init().catch((error) => {
  console.error(error);
  show("We could not load this order.", true);
});
