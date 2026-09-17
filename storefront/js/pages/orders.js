import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { supabase } from "../lib/supabaseClient.js";

initHeader(document.getElementById("site-header-nav"));

const status = document.getElementById("orders-status");
const list = document.getElementById("orders-list");
const reservationsStatus = document.getElementById("reservations-status");
const reservationsList = document.getElementById("reservations-list");
const openReservationCount = document.getElementById("open-reservation-count");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
let countdownTimer = null;

function show(message, error = false) {
  status.textContent = message;
  status.className = `alert${error ? " alert-error" : ""}`;
  status.hidden = !message;
}

function showReservationError(message) {
  reservationsStatus.textContent = message;
  reservationsStatus.className = "alert alert-error";
  reservationsStatus.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function isActiveReservation(order, reservation) {
  return (
    order?.status === "pending_payment" &&
    order?.payment_status === "pending" &&
    reservation?.status === "active" &&
    Date.parse(reservation.expires_at) > Date.now()
  );
}

function renderReservations(orders, reservations, items) {
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const itemsByOrder = new Map();
  for (const item of items || []) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  const latestReservationByOrder = new Map();
  for (const reservation of reservations || []) {
    if (!latestReservationByOrder.has(reservation.order_id)) {
      latestReservationByOrder.set(reservation.order_id, reservation);
    }
  }

  const entries = [];
  for (const [orderId, reservation] of latestReservationByOrder) {
    const order = orderMap.get(orderId);
    const orderItems = itemsByOrder.get(orderId) || [];
    if (!order || !orderItems.length) continue;
    if (order.payment_status !== "pending") continue;
    if (!["active", "expired", "cancelled"].includes(reservation.status)) continue;
    entries.push({ order, reservation, items: orderItems });
  }

  const open = entries.filter((entry) =>
    isActiveReservation(entry.order, entry.reservation),
  ).length;
  openReservationCount.textContent = `${open} / 2 open`;
  reservationsStatus.hidden = true;
  reservationsList.innerHTML = "";

  if (!entries.length) {
    reservationsList.innerHTML =
      '<div class="orders-empty">You have no active or pending reservations.</div>';
    return;
  }

  reservationsList.innerHTML = entries
    .map(({ order, reservation, items }) => {
      const active = isActiveReservation(order, reservation);
      const expired =
        reservation.status === "expired" ||
        (!active &&
          reservation.status === "active" &&
          Date.parse(reservation.expires_at) <= Date.now());
      const cancelled = reservation.status === "cancelled";
      const itemNames =
        items.length === 1
          ? items[0].product_name
          : `${items[0].product_name} + ${items.length - 1} more`;
      const orderNumber = order.order_number || `BF-${order.id.slice(0, 8)}`;
      const href = `checkout.html?order=${encodeURIComponent(order.id)}`;
      const stateLabel = active ? "Open" : expired ? "Expired" : "Cancelled";
      const action = active
        ? `<a class="btn btn-primary" href="${href}">Continue payment</a><button class="btn btn-secondary js-cancel-reservation" type="button" data-order-id="${escapeHtml(order.id)}">Cancel reservation</button>`
        : expired
          ? `<a class="btn btn-secondary" href="${href}">Retry checkout</a>`
          : `<a class="btn btn-secondary" href="${href}">View reservation</a>`;

      return `<article class="reservation-summary-card ${active ? "is-open" : ""}">
      <div class="reservation-summary-card__top">
        <div>
          <p class="orders-section-eyebrow">${escapeHtml(orderNumber)}</p>
          <h3>${escapeHtml(itemNames)}</h3>
        </div>
        <span class="order-card__status ${active ? "order-card__status--pending" : ""}">${stateLabel}</span>
      </div>
      <div class="reservation-summary-card__items">
        ${items.map((item) => `<span>${escapeHtml(item.product_name)} × ${Number(item.quantity)}</span>`).join("")}
      </div>
      <div class="reservation-summary-card__footer">
        <strong>${naira.format(Number(order.total))}</strong>
        ${active ? `<span class="reservation-summary-card__countdown" data-reservation-expires="${escapeHtml(reservation.expires_at)}">--:--</span>` : `<span>${expired ? "Payment window ended" : "Reservation released"}</span>`}
        ${action}
      </div>
    </article>`;
    })
    .join("");

  updateReservationCountdowns();
}

async function cancelReservation(orderId, button) {
  if (!orderId) return;
  if (!window.confirm("Cancel this reservation? Your reserved items will be released.")) return;

  button.disabled = true;
  button.textContent = "Cancelling…";
  reservationsStatus.hidden = true;

  try {
    const { error } = await supabase.rpc("cancel_pending_order", { target_order_id: orderId });
    if (error) throw error;
    await init();
    reservationsStatus.textContent =
      "Reservation cancelled. The reserved items have been released.";
    reservationsStatus.className = "alert";
    reservationsStatus.hidden = false;
  } catch (error) {
    console.error("Unable to cancel reservation:", error);
    button.disabled = false;
    button.textContent = "Cancel reservation";
    showReservationError(error?.message || "Unable to cancel this reservation. Please try again.");
  }
}

reservationsList.addEventListener("click", (event) => {
  const button = event.target.closest(".js-cancel-reservation");
  if (!button) return;
  cancelReservation(button.dataset.orderId, button);
});

async function init() {
  const session = await getCurrentSession();
  if (!session?.user) {
    location.href = "/login.html?redirect=orders.html";
    return;
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id,order_number,status,payment_status,subtotal,delivery_fee,discount_amount,total,created_at,promo_code",
    )
    .order("created_at", { ascending: false });
  if (ordersError) throw ordersError;

  if (!orders?.length) {
    renderReservations([], [], []);
    list.innerHTML = '<div class="orders-empty">You have no orders yet.</div>';
    return;
  }

  const orderIds = orders.map((order) => order.id);
  const [{ data: reservations, error: reservationError }, { data: items, error: itemError }] =
    await Promise.all([
      supabase
        .from("reservations")
        .select("id,order_id,status,expires_at,created_at")
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

  renderReservations(orders, reservations || [], items || []);

  const reservationMap = new Map();
  for (const reservation of reservations || []) {
    if (!reservationMap.has(reservation.order_id))
      reservationMap.set(reservation.order_id, reservation);
  }

  list.innerHTML = orders
    .map((order) => {
      const reservation = reservationMap.get(order.id);
      const activeReservation = isActiveReservation(order, reservation);
      const expiredPending =
        order.status === "cancelled" &&
        order.payment_status === "pending" &&
        reservation?.status === "expired";
      const orderNumber = order.order_number || `BF-${order.id.slice(0, 8)}`;
      return `<article class="order-card">
      <a href="/order.html?id=${encodeURIComponent(order.id)}" class="order-card__main-link">
        <div class="order-card__top"><strong class="order-card__id">${escapeHtml(orderNumber)}</strong><span class="order-card__date">${escapeHtml(new Date(order.created_at).toLocaleString("en-NG"))}</span></div>
        <div class="order-card__meta"><span class="order-card__status">Order: ${escapeHtml(formatStatus(order.status))}</span><span class="order-card__status">Payment: ${escapeHtml(formatStatus(order.payment_status))}</span></div>
        <div class="order-card__total"><span>Total</span><strong>${naira.format(Number(order.total))}</strong></div>
      </a>
      ${activeReservation ? `<div class="order-card__reservation" data-order-id="${escapeHtml(order.id)}"><div class="order-card__reservation-copy"><span class="order-card__reservation-label">Payment reserved</span><small>Complete payment before the reservation expires.</small></div><strong class="order-card__countdown" data-expires-at="${escapeHtml(reservation.expires_at)}">--:--</strong></div>` : ""}
      ${expiredPending ? `<div class="order-card__reservation is-expired"><div class="order-card__reservation-copy"><span class="order-card__reservation-label">Payment pending</span><small>Your reservation expired before payment was completed.</small></div><strong class="order-card__countdown">Expired</strong></div><a class="order-card__retry" href="/order.html?id=${encodeURIComponent(order.id)}">Retry checkout</a>` : ""}
    </article>`;
    })
    .join("");

  updateCountdowns();
  if (
    list.querySelector("[data-expires-at]") ||
    reservationsList.querySelector("[data-reservation-expires]")
  ) {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      updateCountdowns();
      updateReservationCountdowns();
    }, 1000);
  } else if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function formatStatus(value) {
  return String(value || "").replaceAll("_", " ");
}

function updateCountdowns() {
  list.querySelectorAll("[data-expires-at]").forEach((element) => {
    const remaining = Math.max(0, Date.parse(element.dataset.expiresAt) - Date.now());
    const reservation = element.closest(".order-card__reservation");
    if (remaining <= 0) {
      element.textContent = "Expired";
      reservation?.classList.add("is-expired");
      const copy = reservation?.querySelector(".order-card__reservation-copy");
      if (copy) {
        const label = copy.querySelector(".order-card__reservation-label");
        const message = copy.querySelector("small");
        if (label) label.textContent = "Payment pending";
        if (message) message.textContent = "Your reservation expired before payment was completed.";
      }
      if (reservation && !reservation.nextElementSibling?.classList.contains("order-card__retry")) {
        const orderId = reservation.dataset.orderId;
        const link = document.createElement("a");
        link.className = "order-card__retry";
        link.href = `/order.html?id=${encodeURIComponent(orderId)}`;
        link.textContent = "Retry checkout";
        reservation.insertAdjacentElement("afterend", link);
      }
      return;
    }
    const totalSeconds = Math.ceil(remaining / 1000);
    element.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  });
}

function updateReservationCountdowns() {
  reservationsList.querySelectorAll("[data-reservation-expires]").forEach((element) => {
    const remaining = Math.max(0, Date.parse(element.dataset.reservationExpires) - Date.now());
    if (remaining <= 0) {
      element.textContent = "Expired";
      return;
    }
    const totalSeconds = Math.ceil(remaining / 1000);
    element.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
  });
}

init().catch((error) => {
  console.error(error);
  show("We could not load your orders. Please try again.", true);
  if (reservationsList)
    showReservationError("We could not load your reservations. Please refresh and try again.");
});
