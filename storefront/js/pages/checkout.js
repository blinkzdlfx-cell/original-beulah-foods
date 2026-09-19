import { initHeader } from "../components/navbar.js";
import { getCurrentSession } from "../services/authService.js";
import { getCustomerProfile } from "../services/profileService.js";
import { getProductsByIds } from "../services/catalogService.js";
import { getCart } from "../services/cartService.js";
import { supabase } from "../lib/supabaseClient.js";

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
const cancelReservation = document.getElementById("checkout-cancel-reservation");
const retryReservation = document.getElementById("checkout-retry-reservation");
const returnToCart = document.getElementById("checkout-return-cart");
const promoInput = document.getElementById("promo-code");
const confirmNote = document.getElementById("checkout-confirm-note");

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});
const SELECTION_KEY = "beulah_checkout_selection";
const CHECKOUT_ORDER_KEY = "beulah_checkout_order";

let checkoutItems = [];
let deliverySettings = null;
let pendingOrderId = null;
let pendingReservation = null;
let currentSession = null;
let customerProfile = null;
let reservationTimer = null;

retryReservation.hidden = true;
returnToCart.hidden = true;

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = `checkout-status${type ? ` checkout-status--${type}` : ""}`;
  status.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function hasCompleteDeliveryProfile(profile) {
  return Boolean(profile?.full_name?.trim() && profile?.phone?.trim() && profile?.address?.trim());
}

function renderProfile(profile) {
  customerProfile = profile ?? null;
  const complete = hasCompleteDeliveryProfile(customerProfile);
  profileCard.hidden = !complete;
  profileMissing.hidden = complete;
  submit.disabled = !complete || reservationExpired();
  fullNameEl.textContent = customerProfile?.full_name?.trim() || "—";
  phoneEl.textContent = customerProfile?.phone?.trim() || "—";
  addressEl.textContent = customerProfile?.address?.trim() || "—";
  if (!complete) setStatus("Add your delivery details in My Account to continue.", "error");
  else if (!pendingReservation) setStatus("");
}

function getStoredSelection() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SELECTION_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

function getSelectedProductIds() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("items");
  if (raw)
    return new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );
  return getStoredSelection();
}

function rememberCheckoutSelection(items) {
  sessionStorage.setItem(
    SELECTION_KEY,
    JSON.stringify(items.map((item) => String(item.productId))),
  );
}

function rememberCheckoutOrder(orderId) {
  if (!currentSession?.user?.id || !orderId) return;
  localStorage.setItem(
    CHECKOUT_ORDER_KEY,
    JSON.stringify({ userId: currentSession.user.id, orderId: String(orderId) }),
  );
}

function getRememberedCheckoutOrderId() {
  try {
    const value = JSON.parse(localStorage.getItem(CHECKOUT_ORDER_KEY) || "null");
    if (!value?.orderId || value.userId !== currentSession?.user?.id) return null;
    return String(value.orderId);
  } catch {
    return null;
  }
}

function clearRememberedCheckoutOrder() {
  localStorage.removeItem(CHECKOUT_ORDER_KEY);
}

function resetReservationTimer() {
  if (reservationTimer) clearInterval(reservationTimer);
  reservationTimer = null;
}

function setReservationState(state, order) {
  reservationBox.hidden = false;
  reservationBox.classList.remove("is-expired", "is-cancelled");
  reservationOrder.textContent =
    order?.order_number || (order?.id ? `Order ${String(order.id).slice(0, 8)}` : "");
  cancelReservation.hidden = true;
  retryReservation.hidden = true;
  returnToCart.hidden = true;
  reservationCountdown.hidden = false;

  if (state === "reserved") {
    reservationEyebrow.textContent = "Order reserved";
    reservationTitle.textContent = "Complete your payment.";
    reservationMessage.textContent =
      "Your items are reserved while you complete payment. The reservation will expire when the countdown reaches 00:00.";
    reservationCountdown.textContent = "15:00";
    cancelReservation.hidden = false;
    return;
  }

  if (state === "expired") {
    reservationBox.classList.add("is-expired");
    reservationEyebrow.textContent = "Order expired";
    reservationTitle.textContent = "Your reservation has expired.";
    reservationMessage.textContent =
      "The 15-minute payment window has ended, so these items are no longer reserved. Retry checkout to reserve them again if they are still available.";
    reservationCountdown.textContent = "Expired";
    retryReservation.hidden = false;
    return;
  }

  reservationBox.classList.add("is-cancelled");
  reservationEyebrow.textContent = "Order cancelled";
  reservationTitle.textContent = "Your order was cancelled.";
  reservationMessage.textContent =
    "The reservation has been cancelled and the items have been released. Add them to your cart again if you still want them.";
  reservationCountdown.hidden = true;
  returnToCart.hidden = false;
}

async function findRememberedCheckoutOrder() {
  const orderId = getRememberedCheckoutOrderId();
  if (!orderId) return null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id,customer_id,order_number,status,payment_status,subtotal,delivery_fee,discount_amount,total,promo_code,created_at",
    )
    .eq("id", orderId)
    .eq("customer_id", currentSession.user.id)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) {
    clearRememberedCheckoutOrder();
    return null;
  }
  if (order.payment_status !== "pending") {
    clearRememberedCheckoutOrder();
    return null;
  }

  const { data: reservations, error: reservationError } = await supabase
    .from("reservations")
    .select("id,order_id,status,expires_at,created_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (reservationError) throw reservationError;
  const reservation = reservations?.[0] || null;

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select("product_id,product_name,unit_price,quantity,line_total")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });
  if (itemError) throw itemError;
  if (!items?.length) {
    clearRememberedCheckoutOrder();
    return null;
  }

  const mappedItems = items.map((item) => ({
    productId: item.product_id,
    quantity: item.quantity,
    product: { id: item.product_id, name: item.product_name, price: item.unit_price },
  }));

  if (order.status === "cancelled") {
    const wasAutoExpired =
      reservation?.status === "expired" && Date.parse(reservation.expires_at) <= Date.now();
    return {
      state: wasAutoExpired ? "expired" : "cancelled",
      order,
      reservation,
      items: mappedItems,
    };
  }

  if (order.status !== "pending_payment") {
    clearRememberedCheckoutOrder();
    return null;
  }

  const active =
    reservation?.status === "active" && Date.parse(reservation.expires_at) > Date.now();
  return { state: active ? "reserved" : "expired", order, reservation, items: mappedItems };
}

async function init() {
  currentSession = await getCurrentSession();
  if (!currentSession?.user) {
    const destination = `/checkout${location.search || ""}`;
    authNotice.hidden = false;
    form.hidden = true;
    authNotice.innerHTML = `Please <a href="/login?redirect=${encodeURIComponent(destination)}">log in</a> to continue to checkout.`;
    return;
  }

  const [profile, remembered] = await Promise.all([
    getCustomerProfile(),
    findRememberedCheckoutOrder(),
  ]);

  if (remembered) {
    pendingOrderId = remembered.order.id;
    pendingReservation = remembered.reservation;
    checkoutItems = remembered.items;
    rememberCheckoutSelection(checkoutItems);
    renderSummary({
      subtotal: remembered.order.subtotal,
      delivery_fee: remembered.order.delivery_fee,
      delivery_enabled: Number(remembered.order.delivery_fee) > 0,
      discount: remembered.order.discount_amount,
      total: remembered.order.total,
    });

    if (remembered.state === "cancelled") {
      resetReservationTimer();
      setReservationState("cancelled", remembered.order);
      form.hidden = true;
      return;
    }

    if (remembered.state === "expired") {
      resetReservationTimer();
      setReservationState("expired", remembered.order);
      form.hidden = true;
      return;
    }

    setReservationState("reserved", remembered.order);
    renderProfile(profile);
    promoInput.value = remembered.order.promo_code || "";
    promoInput.disabled = true;
    confirmNote.textContent = "Your order is reserved. Continue to Paystack to complete payment.";
    submit.textContent = "Continue to payment";
    form.hidden = false;
    startReservationCountdown();
    return;
  }

  const cart = getCart();
  if (!cart.length) {
    setStatus("Your cart is empty. Add products before checking out.", "error");
    form.hidden = true;
    return;
  }

  const selectedIds = getSelectedProductIds();
  const sourceItems = selectedIds.size
    ? cart.filter((item) => selectedIds.has(String(item.productId)))
    : cart;
  if (!sourceItems.length) {
    setStatus(
      "No valid cart items were selected. Return to your cart and choose what to buy.",
      "error",
    );
    form.hidden = true;
    return;
  }

  rememberCheckoutSelection(sourceItems);
  const [products, deliveryResult] = await Promise.all([
    getProductsByIds(sourceItems.map((item) => item.productId)),
    supabase
      .from("delivery_settings")
      .select("delivery_fee,is_delivery_enabled")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (deliveryResult.error) throw deliveryResult.error;
  deliverySettings = deliveryResult.data;

  const productMap = new Map(products.map((product) => [String(product.id), product]));
  checkoutItems = sourceItems
    .map((item) => ({ ...item, product: productMap.get(String(item.productId)) }))
    .filter((item) => item.product);
  if (!checkoutItems.length) {
    setStatus(
      "The selected products are no longer available. Please return to your cart.",
      "error",
    );
    form.hidden = true;
    return;
  }

  renderSummary();
  renderProfile(profile);
  form.hidden = false;
}

function reservationExpired() {
  return Boolean(pendingReservation && Date.parse(pendingReservation.expires_at) <= Date.now());
}

function startReservationCountdown() {
  resetReservationTimer();
  updateReservationCountdown();
  if (!reservationExpired()) reservationTimer = setInterval(updateReservationCountdown, 1000);
}

function updateReservationCountdown() {
  if (!pendingReservation) return;
  const remaining = Math.max(0, Date.parse(pendingReservation.expires_at) - Date.now());
  if (remaining <= 0) {
    resetReservationTimer();
    setReservationState("expired", {
      id: pendingOrderId,
      order_number: reservationOrder.textContent,
    });
    form.hidden = true;
    return;
  }
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  reservationCountdown.hidden = false;
  reservationCountdown.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isDeliveryEnabled() {
  return Boolean(deliverySettings?.is_delivery_enabled);
}
function calculateLocalDelivery() {
  return isDeliveryEnabled() ? Math.max(0, Number(deliverySettings?.delivery_fee ?? 0)) : 0;
}
function getLocalSubtotal() {
  return checkoutItems.reduce(
    (total, item) =>
      total + Number(item.product.price) * Math.max(1, Number.parseInt(item.quantity, 10) || 1),
    0,
  );
}

function renderSummary(totals = null) {
  summary.innerHTML = "";
  for (const item of checkoutItems) {
    const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
    const lineTotal = Number(item.product.price) * quantity;
    const row = document.createElement("div");
    row.className = "checkout-item";
    row.innerHTML = `<span>${escapeHtml(item.product.name)} × ${quantity}</span><strong>${naira.format(lineTotal)}</strong>`;
    summary.append(row);
  }
  const subtotal = totals ? Number(totals.subtotal) : getLocalSubtotal();
  const deliveryEnabled = totals ? Boolean(totals.delivery_enabled) : isDeliveryEnabled();
  const delivery = totals ? Number(totals.delivery_fee) : calculateLocalDelivery();
  const discount = totals ? Number(totals.discount) : 0;
  const total = totals ? Number(totals.total) : subtotal + delivery - discount;
  subtotalEl.textContent = naira.format(subtotal);
  deliveryRow.hidden = !deliveryEnabled;
  deliveryEl.textContent = delivery === 0 ? "Free" : naira.format(delivery);
  discountRow.hidden = !discount;
  discountEl.textContent = discount ? `−${naira.format(discount)}` : "—";
  totalEl.textContent = naira.format(total);
}

async function initializePayment(orderId) {
  const response = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentSession.access_token}`,
    },
    body: JSON.stringify({ order_id: orderId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "PAYMENT_INITIALIZATION_FAILED");
    error.code = data?.error;
    throw error;
  }
  if (!data.authorization_url) throw new Error("PAYMENT_INITIALIZATION_FAILED");
  location.href = data.authorization_url;
}

async function cancelCurrentReservation() {
  if (!pendingOrderId) return;
  cancelReservation.disabled = true;
  cancelReservation.textContent = "Cancelling…";
  try {
    const { error } = await supabase.rpc("cancel_pending_order", {
      target_order_id: pendingOrderId,
    });
    if (error) throw error;
    resetReservationTimer();
    pendingReservation = null;
    setReservationState("cancelled", {
      id: pendingOrderId,
      order_number: reservationOrder.textContent,
    });
    form.hidden = true;
    setStatus("");
  } catch (error) {
    cancelReservation.disabled = false;
    cancelReservation.textContent = "Cancel reservation";
    setStatus(error?.message || "Could not cancel the reservation. Please try again.", "error");
  }
}

async function retryExpiredReservation() {
  if (!pendingOrderId || !reservationExpired()) return;
  retryReservation.disabled = true;
  retryReservation.textContent = "Preparing…";
  try {
    const { error } = await supabase.rpc("retry_expired_pending_order", {
      target_order_id: pendingOrderId,
    });
    if (error) throw error;
    clearRememberedCheckoutOrder();
    pendingOrderId = null;
    pendingReservation = null;
    location.href = "/checkout";
  } catch (error) {
    retryReservation.disabled = false;
    retryReservation.textContent = "Retry checkout";
    if (error?.message?.includes("RESERVATION_STILL_ACTIVE")) {
      setReservationState("reserved", {
        id: pendingOrderId,
        order_number: reservationOrder.textContent,
      });
      form.hidden = false;
      setStatus(
        "This reservation is still active. Please wait for the countdown to finish.",
        "error",
      );
      startReservationCountdown();
      return;
    }
    if (
      error?.message?.includes("ORDER_NOT_RETRYABLE") ||
      error?.message?.includes("ORDER_NOT_FOUND")
    ) {
      clearRememberedCheckoutOrder();
      pendingOrderId = null;
      pendingReservation = null;
      setStatus(
        "This reservation is no longer available. Return to your cart and start checkout again.",
        "error",
      );
      return;
    }
    setStatus(error?.message || "Could not prepare checkout. Please try again.", "error");
  }
}

cancelReservation?.addEventListener("click", cancelCurrentReservation);
retryReservation?.addEventListener("click", retryExpiredReservation);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");
  if (reservationExpired()) {
    setReservationState("expired", {
      id: pendingOrderId,
      order_number: reservationOrder.textContent,
    });
    form.hidden = true;
    return;
  }
  if (!hasCompleteDeliveryProfile(customerProfile)) {
    setStatus("Add your delivery details in My Account to continue.", "error");
    return;
  }
  submit.disabled = true;
  submit.textContent = pendingOrderId ? "Opening payment…" : "Creating order…";
  try {
    if (!pendingOrderId) {
      const cartItems = checkoutItems.map(({ productId, quantity }) => ({ productId, quantity }));
      const reservedProductIds = checkoutItems.map((item) => String(item.productId));
      const { data, error } = await supabase.rpc("create_pending_order", {
        cart_items: cartItems,
        delivery_name: customerProfile.full_name.trim(),
        delivery_phone: customerProfile.phone.trim(),
        delivery_address: customerProfile.address.trim(),
        requested_promo_code: promoInput.value.trim() || null,
      });
      if (error) throw error;
      pendingOrderId = data.order_id;
      pendingReservation = {
        id: data.reservation_id,
        order_id: data.order_id,
        expires_at: data.expires_at,
      };
      rememberCheckoutSelection(checkoutItems);
      rememberCheckoutOrder(pendingOrderId);
      renderSummary(data);
      setReservationState("reserved", { id: data.order_id, order_number: data.order_number });
      confirmNote.textContent = "Your order is reserved. Continue to Paystack to complete payment.";
      submit.textContent = "Continue to payment";
      startReservationCountdown();
      promoInput.disabled = true;
      submit.disabled = false;
      setStatus(
        `Order ${data.order_number || "created"} is reserved. Continue to payment when ready.`,
        "success",
      );
      return;
    }
    await initializePayment(pendingOrderId);
  } catch (error) {
    console.error(error);
    if (error?.code === "ORDER_NOT_PAYABLE" || error?.code === "ORDER_RESERVATION_EXPIRED") {
      pendingOrderId = null;
      clearRememberedCheckoutOrder();
    }
    submit.disabled = false;
    submit.textContent = pendingOrderId ? "Continue to payment" : "Confirm order & reserve items";
    const message = error?.message ?? "";
    if (message.includes("INSUFFICIENT_STOCK"))
      setStatus(
        "One or more products do not have enough stock. Return to your cart and adjust the quantity.",
        "error",
      );
    else if (message.includes("PRODUCT_UNAVAILABLE"))
      setStatus(
        "One or more products are no longer available. Please return to your cart.",
        "error",
      );
    else if (message.includes("DELIVERY_DETAILS_REQUIRED"))
      setStatus("Add your delivery details in My Account to continue.", "error");
    else if (message.includes("DELIVERY_CONFIGURATION_INVALID"))
      setStatus("Delivery is temporarily unavailable. Please try again later.", "error");
    else if (message.includes("PROMO_INVALID"))
      setStatus("That promo code is invalid or inactive.", "error");
    else if (message.includes("PROMO_MINIMUM_NOT_MET"))
      setStatus("This promo code does not meet the minimum order amount.", "error");
    else if (message.includes("ORDER_RESERVATION_EXPIRED")) {
      setReservationState("expired", {
        id: pendingOrderId,
        order_number: reservationOrder.textContent,
      });
      form.hidden = true;
      setStatus(
        "Your payment reservation has expired. Retry checkout to reserve the items again.",
        "error",
      );
    } else if (message.includes("PAYMENT_INITIALIZATION_FAILED"))
      setStatus(
        "Your order is reserved, but payment could not be opened. Please try again.",
        "error",
      );
    else setStatus("We could not prepare your order or payment. Please try again.", "error");
  }
});

init().catch((error) => {
  console.error(error);
  setStatus("We could not prepare checkout. Please try again.", "error");
});
