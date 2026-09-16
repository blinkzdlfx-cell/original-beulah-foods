const PAYMENT_API_PREFIX = "/api/paystack";

async function request(path, body) {
  const response = await fetch(`${PAYMENT_API_PREFIX}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Preserve the HTTP failure below when the Worker returns non-JSON.
  }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Payment request failed (${response.status}).`);
    error.code = payload?.error || "PAYMENT_REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function initializePaystackPayment(orderId) {
  return request("/initialize", { orderId: String(orderId) });
}

export async function verifyPaystackPayment(reference) {
  if (!reference) throw new Error("Missing payment reference.");
  return request("/verify", { reference: String(reference) });
}

export const paystackClientContract = Object.freeze({
  initialize: `${PAYMENT_API_PREFIX}/initialize`,
  verify: `${PAYMENT_API_PREFIX}/verify`,
  webhook: `${PAYMENT_API_PREFIX}/webhook`,
  secretKeysInBrowser: false,
});
