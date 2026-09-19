const RESEND_API = "https://api.resend.com";

const ORDER_CONFIRMATION_TEMPLATE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order received — Beulah Foods</title></head><body style="margin:0;background:#f5f7f2;color:#172019;font-family:Arial,Helvetica,sans-serif"><div style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #e1e7df;border-radius:16px;overflow:hidden"><tr><td style="padding:28px 32px;background:#18300f;color:#fff"><div style="font-size:22px;font-weight:800">Beulah Foods</div><div style="margin-top:6px;font-size:12px;color:#dfe8da">Eat Healthy, Live Healthy.</div></td></tr><tr><td style="padding:36px 32px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#00a85a">Order confirmation</div><h1 style="margin:8px 0 16px;font-size:28px;line-height:1.2;color:#172019">Order received</h1><div style="font-size:15px;line-height:1.7;color:#526057">Hi {{customer_name}},<br><br>We have received your order <strong>{{order_number}}</strong>. Your order is now being processed.<br><br><strong>Total:</strong> {{order_total}}<br><strong>Payment:</strong> {{payment_status}}<br><strong>Delivery:</strong> {{delivery_address}}<br><br>{{order_items_html}}</div><p style="margin:28px 0 0"><a href="{{order_url}}" style="display:inline-block;background:#00a85a;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">View order</a></p></td></tr><tr><td style="padding:22px 32px;border-top:1px solid #e8ece7;color:#758078;font-size:12px;line-height:1.6">Beulah Foods · Lagos, Nigeria<br>Produced and distributed by Beulah Gain Nigeria Limited.<br><a href="mailto:beulahfoodshelp@gmail.com" style="color:#526057">beulahfoodshelp@gmail.com</a></td></tr></table></div></body></html>';

const PAYMENT_SUCCESS_TEMPLATE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment confirmed — Beulah Foods</title></head><body style="margin:0;background:#f5f7f2;color:#172019;font-family:Arial,Helvetica,sans-serif"><div style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #e1e7df;border-radius:16px;overflow:hidden"><tr><td style="padding:28px 32px;background:#18300f;color:#fff"><div style="font-size:22px;font-weight:800">Beulah Foods</div><div style="margin-top:6px;font-size:12px;color:#dfe8da">Eat Healthy, Live Healthy.</div></td></tr><tr><td style="padding:36px 32px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#00a85a">Payment receipt</div><h1 style="margin:8px 0 16px;font-size:28px;line-height:1.2;color:#172019">Payment confirmed</h1><div style="font-size:15px;line-height:1.7;color:#526057">Hi {{customer_name}},<br><br>Your payment for order <strong>{{order_number}}</strong> has been confirmed.<br><br><strong>Amount paid:</strong> {{amount_paid}}<br><strong>Reference:</strong> {{payment_reference}}<br><strong>Order status:</strong> {{order_status}}<br><br>Keep this email for your records.</div><p style="margin:28px 0 0"><a href="{{order_url}}" style="display:inline-block;background:#00a85a;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">View order</a></p></td></tr><tr><td style="padding:22px 32px;border-top:1px solid #e8ece7;color:#758078;font-size:12px;line-height:1.6">Beulah Foods · Lagos, Nigeria<br>Produced and distributed by Beulah Gain Nigeria Limited.<br><a href="mailto:beulahfoodshelp@gmail.com" style="color:#526057">beulahfoodshelp@gmail.com</a></td></tr></table></div></body></html>';

const ORDER_STATUS_TEMPLATE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your order has been updated — Beulah Foods</title></head><body style="margin:0;background:#f5f7f2;color:#172019;font-family:Arial,Helvetica,sans-serif"><div style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #e1e7df;border-radius:16px;overflow:hidden"><tr><td style="padding:28px 32px;background:#18300f;color:#fff"><div style="font-size:22px;font-weight:800">Beulah Foods</div><div style="margin-top:6px;font-size:12px;color:#dfe8da">Eat Healthy, Live Healthy.</div></td></tr><tr><td style="padding:36px 32px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#00a85a">Order update</div><h1 style="margin:8px 0 16px;font-size:28px;line-height:1.2;color:#172019">Your order has been updated</h1><div style="font-size:15px;line-height:1.7;color:#526057">Hi {{customer_name}},<br><br>There is an update on order <strong>{{order_number}}</strong>.<br><br><strong>New status:</strong> {{order_status}}<br><strong>Payment status:</strong> {{payment_status}}<br><br>{{status_message}}</div><p style="margin:28px 0 0"><a href="{{order_url}}" style="display:inline-block;background:#00a85a;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">View order</a></p></td></tr><tr><td style="padding:22px 32px;border-top:1px solid #e8ece7;color:#758078;font-size:12px;line-height:1.6">Beulah Foods · Lagos, Nigeria<br>Produced and distributed by Beulah Gain Nigeria Limited.<br><a href="mailto:beulahfoodshelp@gmail.com" style="color:#526057">beulahfoodshelp@gmail.com</a></td></tr></table></div></body></html>';

const STATUS_MESSAGES = Object.freeze({
  pending_payment: "Your order is waiting for payment.",
  paid: "Your payment has been confirmed and your order is now in our fulfilment queue.",
  confirmed: "Your order has been confirmed by Beulah Foods.",
  cancelled: "Your order has been cancelled. Please contact Beulah Foods support if you need help.",
});

function escapeEmailHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);
}

function formatNaira(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatOrderStatus(value) {
  return String(value || "").replaceAll("_", " ");
}

function renderTemplate(template, variables) {
  return Object.entries(variables).reduce(
    (html, [key, value]) => html.split("{{" + key + "}}").join(String(value ?? "")),
    template,
  );
}

function requireEmailConfig(env) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY_NOT_CONFIGURED");
  if (!env.RESEND_FROM_EMAIL) throw new Error("RESEND_FROM_EMAIL_NOT_CONFIGURED");
}

async function sendResendEmail(env, { to, subject, html, idempotencyKey, category }) {
  requireEmailConfig(env);
  const response = await fetch(RESEND_API + "/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
      tags: [
        { name: "category", value: category },
        { name: "application", value: "beulah-foods" },
      ],
    }),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const code = typeof data === "object" && data?.name ? data.name : "RESEND_SEND_FAILED";
    throw new Error(code);
  }
  return data;
}

async function getOrderEmailContext(env, orderId) {
  const query = new URLSearchParams({
    select: "id,order_number,customer_id,delivery_name,delivery_address,total,payment_status,status,order_items(product_name,unit_price,quantity,line_total)",
    id: "eq." + orderId,
    limit: "1",
  });
  const { response, data } = await supabaseRequest(env, "/rest/v1/orders?" + query.toString());
  if (!response.ok || !Array.isArray(data) || !data[0]) {\n    console.error(JSON.stringify({ event: "transactional_email_order_lookup_failed", order_id: orderId, http_status: response.status }));\n    throw new Error("ORDER_NOT_FOUND_FOR_EMAIL");\n  }
  const order = data[0];

  const userResponse = await fetch(
    env.SUPABASE_URL + "/auth/v1/admin/users/" + encodeURIComponent(order.customer_id),
    {
      headers: {
        apikey: requireSecret(env, "SUPABASE_SECRET_KEY"),
        Authorization: "Bearer " + requireSecret(env, "SUPABASE_SECRET_KEY"),
      },
    },
  );
  if (!userResponse.ok) {\n    console.error(JSON.stringify({ event: "transactional_email_customer_lookup_failed", order_id: orderId, customer_id: order.customer_id, http_status: userResponse.status }));\n    throw new Error("CUSTOMER_EMAIL_NOT_FOUND");\n  }
  const user = await userResponse.json();
  const email = String(user?.email || "").trim();
  if (!email) throw new Error("CUSTOMER_EMAIL_NOT_FOUND");

  const customerName =
    String(order.delivery_name || "").trim() ||
    String(user?.user_metadata?.full_name || "").trim() ||
    email;

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const itemsHtml = items.length
    ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px">' +
      '<tr><td style="padding:8px 0;border-bottom:1px solid #e8ece7;font-weight:700">Item</td><td align="right" style="padding:8px 0;border-bottom:1px solid #e8ece7;font-weight:700">Total</td></tr>' +
      items.map((item) =>
        '<tr><td style="padding:8px 0;border-bottom:1px solid #eef1ed">' +
        escapeEmailHtml(item.product_name) + " × " + Number(item.quantity || 0) +
        '</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eef1ed">' +
        formatNaira(item.line_total) + "</td></tr>",
      ).join("") +
      "</table>"
    : "<p>No item details are available.</p>";

  return {
    order,
    email,
    customerName,
    orderNumber: order.order_number || "BF-" + String(order.id).slice(0, 8),
    orderUrl: "https://www.beulahfoods.com/order?id=" + encodeURIComponent(order.id),
    total: formatNaira(order.total),
    paymentStatus: formatOrderStatus(order.payment_status),
    orderStatus: formatOrderStatus(order.status),
    deliveryAddress: escapeEmailHtml(order.delivery_address || "Delivery details on your order"),
    itemsHtml,
  };
}

export async function sendSuccessfulPaymentEmails(env, orderId, amountPaid, paymentReference) {
  const context = await getOrderEmailContext(env, orderId);
  const common = {
    customer_name: escapeEmailHtml(context.customerName),
    order_number: escapeEmailHtml(context.orderNumber),
    order_total: context.total,
    payment_status: escapeEmailHtml(context.paymentStatus),
    delivery_address: context.deliveryAddress,
    order_items_html: context.itemsHtml,
    order_url: context.orderUrl,
    amount_paid: formatNaira(amountPaid || context.order.total),
    payment_reference: escapeEmailHtml(paymentReference),
    order_status: escapeEmailHtml(context.orderStatus),
  };

  const sends = [
    sendResendEmail(env, {
      to: context.email,
      subject: "Order " + context.orderNumber + " received — Beulah Foods",
      html: renderTemplate(ORDER_CONFIRMATION_TEMPLATE, common),
      idempotencyKey: "order-confirmation/" + context.order.id,
      category: "order_confirmation",
    }),
    sendResendEmail(env, {
      to: context.email,
      subject: "Payment confirmed for " + context.orderNumber + " — Beulah Foods",
      html: renderTemplate(PAYMENT_SUCCESS_TEMPLATE, common),
      idempotencyKey: "payment-success/" + context.order.id,
      category: "payment_success",
    }),
  ];

  const results = await Promise.allSettled(sends);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((result) => result.value);
}

export async function trySendSuccessfulPaymentEmails(env, orderId, amountPaid, paymentReference) {
  try {
    await sendSuccessfulPaymentEmails(env, orderId, amountPaid, paymentReference);
    return { sent: true, error: null };
  } catch (error) {
    const code = String(error?.message || "EMAIL_SEND_FAILED");
    console.error(JSON.stringify({
      event: "payment_transaction_email_failed",
      order_id: orderId,
      code: code.split(":")[0],
      detail: code,
    }));
    return { sent: false, error: code.split(":")[0] };
  }
}

export async function sendOrderStatusEmail(env, orderId, nextStatus) {
  const context = await getOrderEmailContext(env, orderId);
  const statusMessage = STATUS_MESSAGES[nextStatus] || "Your order status has been updated. Please view your order for the latest details.";
  const html = renderTemplate(ORDER_STATUS_TEMPLATE, {
    customer_name: escapeEmailHtml(context.customerName),
    order_number: escapeEmailHtml(context.orderNumber),
    order_status: escapeEmailHtml(formatOrderStatus(nextStatus)),
    payment_status: escapeEmailHtml(context.paymentStatus),
    status_message: escapeEmailHtml(statusMessage),
    order_url: context.orderUrl,
  });
  return sendResendEmail(env, {
    to: context.email,
    subject: "Order " + context.orderNumber + " update — Beulah Foods",
    html,
    idempotencyKey: "order-status/" + context.order.id + "/" + nextStatus,
    category: "order_status_update",
  });
}
