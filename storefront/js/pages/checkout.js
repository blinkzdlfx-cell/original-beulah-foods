import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { getCustomerProfile } from "../services/profileService.js";
import { getProductsByIds } from "../services/catalogService.js";
import { getCart, removeCartItems } from "../services/cartService.js";
import { getCheckoutSelection, clearCheckoutSelection } from "../services/checkoutStateBridge.js";
import { createPendingCheckout, cancelCheckoutReservation } from "../services/checkoutService.js";
import { initializePaystackPayment } from "../services/paystackService.js";
import { isReservationActive, getRemainingReservationMs, requestReservationExpiry } from "../services/reservationExpiryAuthority.js";

initHeader(document.getElementById("site-header-nav"));

const authNotice = document.getElementById("checkout-auth-notice");
const form = document.getElementById("checkout-form");
const summary = document.getElementById("checkout-items");
const subtotalEl = document.getElementById("checkout-subtotal");
const deliveryRow = document.getElementById("checkout-delivery-row");
const deliveryEl = document.getElementById("checkout-delivery");
const discountRow = document.getElementById("checkout-discount-row");
const discountEl = document.getElementById("checkout-discount");
const totalEl = document.getElementById("checkout-total");
const status = document.getElementById("checkout-status");
const submit = document.getElementById("checkout-submit");
const profileCard = document.getElementById("checkout-profile");
const profileMissing = document.getElementById("checkout-profile-missing");
const fullNameEl = document.getElementById("checkout-full-name");
const phoneEl = document.getElementById("checkout-phone");
const addressEl = document.getElementById("checkout-address");
const reservationBox = document.getElementById("checkout-reservation");
const reservationEyebrow = document.getElementById("checkout-reservation-eyebrow");
const reservationTitle = document.getElementById("checkout-reservation-title");
const reservationOrder = document.getElementById("checkout-reservation-order");
const reservationCountdown = document.getElementById("checkout-reservation-countdown");
const reservationMessage = document.getElementById("checkout-reservation-message");
const cancelButton = document.getElementById("checkout-cancel-reservation");
const retryButton = document.getElementById("checkout-retry-reservation");
const returnCart = document.getElementById("checkout-return-cart");
const promoInput = document.getElementById("promo-code");
const confirmNote = document.getElementById("checkout-confirm-note");

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });

let session = null;
let profile = null;
let items = [];
let delivery = { enabled: false, fee: 0 };
let reservation = null;
let orderId = null;
let timer = null;

function setStatus(message = "", type = "") {
  status.textContent = message;
  status.className = `checkout-status${type ? ` checkout-status--${type}` : ""}`;
  status.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function renderProfile() {
  const complete = Boolean(profile?.full_name?.trim() && profile?.phone?.trim() && profile?.address?.trim());
  profileCard.hidden = !complete;
  profileMissing.hidden = complete;
  fullNameEl.textContent = profile?.full_name?.trim() || "—";
  phoneEl.textContent = profile?.phone?.trim() || "—";
  addressEl.textContent = profile?.address?.trim() || "—";
  submit.disabled = !complete || !items.length;
}

function renderSummary({ serverTotals = null } = {}) {
  summary.innerHTML = "";
  let subtotal = 0;
  for (const item of items) {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const price = Number(item.product?.price) || 0;
    subtotal += price * quantity;
    const row = document.createElement("div");
    row.className = "checkout-item";
    row.innerHTML = `<span>${escapeHtml(item.product.name)} × ${quantity}</span><strong>${money.format(price * quantity)}</strong>`;
    summary.append(row);
  }

  const totals = serverTotals ?? {
    subtotal,
    delivery_fee: delivery.enabled ? delivery.fee : 0,
    discount: 0,
    total: subtotal + (delivery.enabled ? delivery.fee : 0),
    delivery_enabled: delivery.enabled,
  };
  subtotalEl.textContent = money.format(Number(totals.subtotal) || 0);
  deliveryRow.hidden = !totals.delivery_enabled;
  deliveryEl.textContent = Number(totals.delivery_fee) ? money.format(Number(totals.delivery_fee)) : "Free";
  discountRow.hidden = !(Number(totals.discount) > 0);
  discountEl.textContent = Number(totals.discount) > 0 ? `−${money.format(Number(totals.discount))}` : "—";
  totalEl.textContent = money.format(Number(totals.total) || 0);
}

function showReserved(data) {
  reservation = { id: data.reservation_id, expires_at: data.expires_at, status: "active" };
  orderId = String(data.order_id);
  reservationBox.hidden = false;
  form.hidden = false;
  reservationEyebrow.textContent = "Order reserved";
  reservationTitle.textContent = "Complete your payment.";
  reservationOrder.textContent = data.order_number || `Order ${orderId.slice(0, 8)}`;
  reservationMessage.textContent = "Your items are reserved while you complete payment.";
  cancelButton.hidden = false;
  retryButton.hidden = true;
  returnCart.hidden = true;
  confirmNote.textContent = "Your order is reserved. Continue to Paystack to complete payment.";
  submit.textContent = "Continue to payment";
  startTimer();
}

function showExpired() {
  reservationBox.hidden = false;
  reservationBox.classList.add("is-expired");
  reservationEyebrow.textContent = "Order expired";
  reservationTitle.textContent = "Your reservation has expired.";
  reservationMessage.textContent = "The 15-minute payment window has ended. Return to your cart and start checkout again.";
  reservationCountdown.textContent = "Expired";
  reservationCountdown.hidden = false;
  cancelButton.hidden = true;
  retryButton.hidden = true;
  returnCart.hidden = false;
  form.hidden = true;
}

function startTimer() {
  if (timer) clearInterval(timer);
  updateTimer();
  timer = setInterval(updateTimer, 1000);
}

async function updateTimer() {
  if (!reservation) return;
  const remaining = getRemainingReservationMs(reservation);
  if (remaining <= 0) {
    clearInterval(timer);
    timer = null;
    try {
      await requestReservationExpiry(orderId);
    } catch (error) {
      console.warn("Reservation expiry request failed; backend remains authoritative.", error);
    }
    showExpired();
    return;
  }
  const seconds = Math.ceil(remaining / 1000);
  reservationCountdown.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function loadProducts() {
  const cart = getCart();
  const selectedIds = getCheckoutSelection();
  const source = selectedIds.length ? cart.filter((item) => selectedIds.includes(item.productId)) : cart;
  if (!source.length) throw new Error("No products were selected for checkout.");

  const products = await getProductsByIds(source.map((item) => item.productId));
  const map = new Map(products.map((product) => [String(product.id), product]));
  items = source
    .map((item) => ({ ...item, product: map.get(String(item.productId)) }))
    .filter((item) => item.product);
  if (!items.length) throw new Error("The selected products are no longer available.");
}

async function loadDelivery() {
  // This is display context only. Checkout totals are recalculated by the RPC.
  const { supabase } = await import("../lib/supabaseClient.js");
  const { data, error } = await supabase
    .from("delivery_settings")
    .select("delivery_fee,is_delivery_enabled")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  delivery = { enabled: Boolean(data?.is_delivery_enabled), fee: Number(data?.delivery_fee) || 0 };
}

async function beginCheckout() {
  submit.disabled = true;
  setStatus("Creating your reservation…");
  try {
    const data = await createPendingCheckout({
      items,
      promoCode: promoInput.value,
    });
    showReserved(data);
    setStatus("Reservation created. Opening secure payment…", "success");

    const payment = await initializePaystackPayment(data.order_id);
    if (!payment?.authorization_url) throw new Error("Paystack did not return a payment URL.");
    window.location.assign(payment.authorization_url);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "We could not start checkout. Please try again.", "error");
    submit.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!orderId) beginCheckout();
  else initializePaystackPayment(orderId)
    .then((payment) => {
      if (!payment?.authorization_url) throw new Error("Paystack did not return a payment URL.");
      window.location.assign(payment.authorization_url);
    })
    .catch((error) => setStatus(error.message || "Could not reopen payment.", "error"));
});

cancelButton.addEventListener("click", async () => {
  if (!orderId) return;
  cancelButton.disabled = true;
  try {
    await cancelCheckoutReservation(orderId);
    if (timer) clearInterval(timer);
    showExpired();
    reservationEyebrow.textContent = "Order cancelled";
    reservationTitle.textContent = "Your order was cancelled.";
    reservationMessage.textContent = "The reservation has been cancelled and the items have been released.";
    reservationBox.classList.remove("is-expired");
    returnCart.hidden = false;
    retryButton.hidden = true;
    clearCheckoutSelection();
  } catch (error) {
    setStatus(error.message || "Could not cancel the reservation.", "error");
    cancelButton.disabled = false;
  }
});

retryButton.addEventListener("click", () => location.assign("cart.html"));

async function init() {
  try {
    session = await getCurrentSession();
    if (!session?.user) {
      authNotice.hidden = false;
      form.hidden = true;
      authNotice.innerHTML = `Please <a href="login.html?redirect=${encodeURIComponent(`checkout.html${location.search || ""}`)}">log in</a> to continue to checkout.`;
      return;
    }

    [profile] = await Promise.all([getCustomerProfile(), loadProducts(), loadDelivery()]);
    renderProfile();
    renderSummary();
    form.hidden = false;

    if (!isReservationActive(reservation)) {
      submit.disabled = !profile?.full_name?.trim() || !profile?.phone?.trim() || !profile?.address?.trim();
    }
  } catch (error) {
    console.error(error);
    form.hidden = true;
    setStatus(error.message || "We could not prepare checkout.", "error");
  }
}

init();
