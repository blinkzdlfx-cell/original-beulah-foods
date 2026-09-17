const PAYSTACK_API = "https://api.paystack.co";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function getBearerToken(request) {
  const value = request.headers.get("Authorization") || "";
  if (!value.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

function requireSecret(env, name) {
  const value = env[name];
  if (!value) throw new Error(`SERVER_SECRET_NOT_CONFIGURED:${name}`);
  return value;
}

async function supabaseRequest(env, path, { method = "GET", body, accessToken } = {}) {
  const headers = {
    apikey: requireSecret(env, "SUPABASE_SERVICE_ROLE_KEY"),
    Authorization: `Bearer ${accessToken || requireSecret(env, "SUPABASE_SERVICE_ROLE_KEY")}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function authenticateCustomer(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: requireSecret(env, "SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user?.id || !user?.email) return null;
  return { token, user };
}

async function callCustomerRpc(env, functionName, args, accessToken) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: requireSecret(env, "SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function callServiceRpc(env, functionName, args) {
  return supabaseRequest(env, `/rest/v1/rpc/${functionName}`, {
    method: "POST",
    body: args,
  });
}

async function paystackRequest(env, path, options = {}) {
  const secret = requireSecret(env, "PAYSTACK_SECRET_KEY");
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function initializePaystack(request, env) {
  const auth = await authenticateCustomer(request, env);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const orderId = String(body?.order_id || "").trim();
  if (!orderId) return json({ error: "ORDER_ID_REQUIRED" }, 400);

  const { response: rpcResponse, data: payment } = await callCustomerRpc(
    env,
    "create_paystack_payment_attempt",
    { target_order_id: orderId },
    auth.token,
  );

  if (!rpcResponse.ok) {
    const message = typeof payment === "object" && payment?.message ? payment.message : "PAYMENT_ATTEMPT_CREATION_FAILED";
    const code = message.includes("ORDER_RESERVATION_EXPIRED")
      ? "ORDER_RESERVATION_EXPIRED"
      : message.includes("ORDER_NOT_PAYABLE")
        ? "ORDER_NOT_PAYABLE"
        : message.includes("ORDER_NOT_FOUND")
          ? "ORDER_NOT_FOUND"
          : message.includes("UNAUTHENTICATED")
            ? "UNAUTHENTICATED"
            : "PAYMENT_ATTEMPT_CREATION_FAILED";
    return json({ error: code }, code === "UNAUTHENTICATED" ? 401 : 409);
  }

  const amountNgn = Number(payment?.amount);
  const reference = String(payment?.reference || "");
  if (!Number.isFinite(amountNgn) || amountNgn <= 0 || !reference) {
    return json({ error: "PAYMENT_ATTEMPT_INVALID" }, 500);
  }

  const callbackUrl = `${new URL(request.url).origin}/payment-callback.html`;
  const paystack = await paystackRequest(env, "/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: auth.user.email,
      amount: String(Math.round(amountNgn * 100)),
      currency: "NGN",
      reference,
      callback_url: callbackUrl,
      metadata: JSON.stringify({
        order_id: payment.order_id,
        payment_id: payment.payment_id,
        source: "beulah-foods-web",
      }),
    }),
  });

  if (!paystack.response.ok || !paystack.data?.status || !paystack.data?.data?.authorization_url) {
    return json({ error: "PAYMENT_INITIALIZATION_FAILED" }, 502);
  }

  return json({
    authorization_url: paystack.data.data.authorization_url,
    access_code: paystack.data.data.access_code,
    reference: paystack.data.data.reference || reference,
    payment_id: payment.payment_id,
    order_id: payment.order_id,
  });
}

async function getPaymentForCustomer(env, reference, userId) {
  const query = new URLSearchParams({
    select: "id,order_id,reference,amount,currency,status,orders!inner(id,order_number,customer_id,total,payment_status)",
    reference: `eq.${reference}`,
    "orders.customer_id": `eq.${userId}`,
    limit: "1",
  });
  const { response, data } = await supabaseRequest(env, `/rest/v1/payments?${query.toString()}`);
  if (!response.ok || !Array.isArray(data) || !data[0]) return null;
  return data[0];
}

async function finalizePayment(env, paymentData) {
  const { response, data } = await callServiceRpc(env, "finalize_paystack_payment", {
    p_reference: paymentData.reference,
    p_provider_transaction_id: paymentData.provider_transaction_id == null ? null : String(paymentData.provider_transaction_id),
    p_amount_ngn: Number(paymentData.amount_kobo) / 100,
    p_currency: paymentData.currency || "NGN",
    p_provider_status: String(paymentData.provider_status || ""),
    p_metadata: paymentData.metadata && typeof paymentData.metadata === "object" ? paymentData.metadata : {},
  });
  if (!response.ok) {
    const message = typeof data === "object" && data?.message ? data.message : "PAYMENT_FINALIZATION_FAILED";
    throw new Error(message);
  }
  return data;
}

async function loadOrderSummary(env, orderId) {
  const query = new URLSearchParams({
    select: "id,order_number,status,payment_status,total",
    id: `eq.${orderId}`,
    limit: "1",
  });
  const { response, data } = await supabaseRequest(env, `/rest/v1/orders?${query.toString()}`);
  if (!response.ok || !Array.isArray(data)) return null;
  return data[0] || null;
}

async function verifyPaystack(request, env) {
  const auth = await authenticateCustomer(request, env);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let reference = new URL(request.url).searchParams.get("reference");
  if (request.method === "POST") {
    try {
      const body = await request.json();
      reference = body?.reference || reference;
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }
  }
  reference = String(reference || "").trim();
  if (!reference) return json({ error: "REFERENCE_REQUIRED" }, 400);

  const payment = await getPaymentForCustomer(env, reference, auth.user.id);
  if (!payment) return json({ error: "PAYMENT_NOT_FOUND" }, 404);

  const paystack = await paystackRequest(env, `/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  });
  if (!paystack.response.ok || !paystack.data?.status || !paystack.data?.data) {
    return json({ error: "PAYMENT_VERIFICATION_FAILED" }, 502);
  }

  const transaction = paystack.data.data;
  const result = await finalizePayment(env, {
    reference,
    provider_transaction_id: transaction.id,
    amount_kobo: transaction.amount,
    currency: transaction.currency,
    provider_status: transaction.status,
    metadata: transaction,
  });
  const orderId = result?.order_id || payment.order_id;
  const order = await loadOrderSummary(env, orderId);

  return json({
    payment_status: result?.status || transaction.status,
    order_id: orderId,
    order_number: order?.order_number || null,
    provider_status: transaction.status,
    idempotent: Boolean(result?.idempotent),
  });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyPaystackSignature(rawBody, signature, secret) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = bytesToHex(digest);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const secret = requireSecret(env, "PAYSTACK_SECRET_KEY");
  if (!(await verifyPaystackSignature(rawBody, signature, secret))) {
    return json({ error: "INVALID_WEBHOOK_SIGNATURE" }, 401);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  if (event?.event !== "charge.success") {
    return json({ received: true, ignored: true });
  }

  const data = event?.data;
  const reference = String(data?.reference || "").trim();
  if (!reference || data?.amount == null) return json({ error: "INVALID_PAYMENT_EVENT" }, 400);

  try {
    const result = await finalizePayment(env, {
      reference,
      provider_transaction_id: data.id,
      amount_kobo: data.amount,
      currency: data.currency,
      provider_status: data.status,
      metadata: event,
    });
    return json({ received: true, processed: true, status: result?.status || "processed" });
  } catch (error) {
    console.error("Paystack webhook finalization failed", error);
    return json({ error: "PAYMENT_FINALIZATION_FAILED" }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/paystack/initialize") {
        if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
        return await initializePaystack(request, env);
      }

      if (url.pathname === "/api/paystack/verify") {
        if (request.method !== "GET" && request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET, POST" });
        return await verifyPaystack(request, env);
      }

      if (url.pathname === "/api/paystack/webhook") {
        if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
        return await handleWebhook(request, env);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      const message = error?.message || "INTERNAL_SERVER_ERROR";
      if (message.startsWith("SERVER_SECRET_NOT_CONFIGURED:")) {
        return json({ error: "PAYMENT_SERVER_NOT_CONFIGURED" }, 503);
      }
      return json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  },
};
