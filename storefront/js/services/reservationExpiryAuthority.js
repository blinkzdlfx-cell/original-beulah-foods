import { expireCheckoutReservation } from "./checkoutService.js";

export function isReservationActive(reservation) {
  return Boolean(
    reservation?.status === "active" &&
      reservation?.expires_at &&
      Date.parse(reservation.expires_at) > Date.now(),
  );
}

export function getRemainingReservationMs(reservation) {
  if (!reservation?.expires_at) return 0;
  return Math.max(0, Date.parse(reservation.expires_at) - Date.now());
}

/**
 * The browser timer is display-only. At zero, ask the backend to transition
 * the reservation; never mutate order/payment state in the browser.
 */
export async function requestReservationExpiry(orderId) {
  if (!orderId) throw new Error("Missing order ID.");
  return expireCheckoutReservation(orderId);
}
