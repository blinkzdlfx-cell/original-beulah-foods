import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));

const list = document.getElementById("reservations-list");
const alertBox = document.getElementById("reservations-alert");
const openCount = document.getElementById("open-count");

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[c],
  );
}

function setAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.hidden = !message;
}

function isOpen(reservation, order) {
  return (
    reservation?.status === "active" &&
    Date.parse(reservation.expires_at) > Date.now() &&
    order?.status === "pending_payment" &&
    order?.payment_status === "pending"
  );
}

function statusLabel(reservation, order) {
  if (isOpen(reservation, order)) return "Open";
  if (reservation?.status === "expired") return "Expired";
  if (reservation?.status === "confirmed" || order?.payment_status === "successful")
    return "Completed";
  return "Cancelled";
}

function statusClass(status) {
  if (status === "Expired") return "reservation-card__status reservation-card__status--expired";
  if (status === "Cancelled") return "reservation-card__status reservation-card__status--cancelled";
  return "reservation-card__status";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function renderReservation(entry) {
  const { order, reservation, items } = entry;
  const status = statusLabel(reservation, order);
  const actionHref = `checkout.html?order=${encodeURIComponent(order.id)}`;
  const itemText =
    items.length === 1
      ? items[0].product_name
      : `${items[0]?.product_name || "Reserved items"} + ${items.length - 1} more`;

  const card = document.createElement("article");
  card.className = "card reservation-card";
  card.dataset.reservationId = reservation.id;
  card.innerHTML = `
    <div class="reservation-card__top">
      <div class="reservation-card__identity">
        <p class="reservation-card__eyebrow">${escapeHtml(order.order_number || `Order ${String(order.id).slice(0, 8)}`)}</p>
        <h2>${escapeHtml(itemText)}</h2>
      </div>
      <span class="${statusClass(status)}">${escapeHtml(status)}</span>
    </div>
    <div class="reservation-card__items">
      ${items.map((item) => `<div class="reservation-card__item"><span>${escapeHtml(item.product_name)} × ${Number(item.quantity)}</span><strong>${naira.format(Number(item.line_total))}</strong></div>`).join("")}
    </div>
    <div class="reservation-card__meta">
      <span>Total: <strong>${naira.format(Number(order.total))}</strong></span>
      <span>Created: ${escapeHtml(formatDate(order.created_at))}</span>
      ${isOpen(reservation, order) ? `<span>Expires: ${escapeHtml(formatDate(reservation.expires_at))}</span>` : ""}
    </div>
    <div class="reservation-card__actions">
      ${status === "Open" ? `<a class="btn btn-primary" href="${actionHref}">Continue payment</a><button class="btn btn-secondary js-cancel-reservation" type="button" data-order-id="${escapeHtml(order.id)}">Cancel reservation</button>` : status === "Expired" ? `<a class="btn btn-secondary" href="${actionHref}">Retry checkout</a>` : status === "Cancelled" ? `<a class="btn btn-secondary" href="${actionHref}">View reservation</a>` : ""}
    </div>
  `;
  return card;
}

async function cancelReservation(orderId, button) {
  if (!orderId) return;
  if (!window.confirm("Cancel this reservation? Your reserved items will be released.")) return;

  button.disabled = true;
  button.textContent = "Cancelling…";
  setAlert("");

  try {
    const { error } = await supabase.rpc("cancel_pending_order", { target_order_id: orderId });
    if (error) throw error;
    await loadReservations();
    setAlert("Reservation cancelled. The reserved items have been released.", "success");
  } catch (error) {
    console.error("Unable to cancel reservation:", error);
    button.disabled = false;
    button.textContent = "Cancel reservation";
    setAlert(error?.message || "Unable to cancel this reservation. Please try again.");
  }
}

list.addEventListener("click", (event) => {
  const button = event.target.closest(".js-cancel-reservation");
  if (!button) return;
  cancelReservation(button.dataset.orderId, button);
});

async function loadReservations() {
  const session = await getCurrentSession();
  if (!session?.user) {
    window.location.href = "login.html?redirect=reservations.html";
    return;
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,total,created_at,updated_at")
    .eq("customer_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (ordersError) throw ordersError;

  if (!orders?.length) {
    openCount.textContent = "0 / 2";
    renderEmpty();
    return;
  }

  const orderIds = orders.map((order) => order.id);
  const [{ data: reservations, error: reservationError }, { data: items, error: itemError }] =
    await Promise.all([
      supabase
        .from("reservations")
        .select("id,order_id,status,expires_at,created_at,updated_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_items")
        .select("order_id,product_name,quantity,line_total,created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true }),
    ]);
  if (reservationError) throw reservationError;
  if (itemError) throw itemError;

  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const itemsByOrder = new Map();
  for (const item of items || []) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  const seenOrders = new Set();
  const entries = [];
  for (const reservation of reservations || []) {
    if (seenOrders.has(reservation.order_id)) continue;
    const order = orderMap.get(reservation.order_id);
    if (!order) continue;
    const orderItems = itemsByOrder.get(order.id) || [];
    if (!orderItems.length) continue;
    seenOrders.add(order.id);
    entries.push({ order, reservation, items: orderItems });
  }

  const open = entries.filter((entry) => isOpen(entry.reservation, entry.order)).length;
  openCount.textContent = `${open} / 2`;

  list.innerHTML = "";
  if (!entries.length) {
    renderEmpty();
    return;
  }

  for (const entry of entries) list.append(renderReservation(entry));
}

function renderEmpty() {
  list.innerHTML = `
    <section class="card reservations-empty">
      <h2>No reservations yet</h2>
      <p>When you start checkout and your items are reserved, each reservation will appear here separately.</p>
      <a class="btn btn-primary" href="shop.html">Shop products</a>
    </section>
  `;
}

loadReservations().catch((error) => {
  console.error("Unable to load reservations:", error);
  setAlert(error?.message || "Unable to load your reservations. Please refresh and try again.");
});
