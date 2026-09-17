import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";

const rows = document.getElementById("rows");
const status = document.getElementById("status");
const pagination = document.getElementById("transaction-pagination");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
const PAGE_SIZE = 25;
let page = 1;

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}

function formatStatus(value) {
  return String(value || "").replaceAll("_", " ");
}

function paymentLabel(value) {
  const labels = { pending: "Pending", successful: "Successful", failed: "Failed" };
  return labels[value] || formatStatus(value);
}

function orderLabel(value) {
  const labels = {
    pending_payment: "Pending payment",
    paid: "Paid",
    processing: "Processing",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[value] || formatStatus(value);
}

function paymentClass(value) {
  if (value === "successful") return "is-paid";
  if (value === "failed") return "is-cancelled";
  return "is-pending";
}

function orderClass(value) {
  if (value === "cancelled") return "is-cancelled";
  if (value === "paid" || value === "processing" || value === "completed") return "is-paid";
  return "is-pending";
}

function renderPagination(totalPages) {
  pagination.innerHTML = "";
  if (totalPages <= 1) return;

  const previous = document.createElement("button");
  previous.className = "btn btn-secondary";
  previous.type = "button";
  previous.textContent = "Previous";
  previous.disabled = page <= 1;
  previous.onclick = () => {
    page -= 1;
    load();
  };

  const label = document.createElement("span");
  label.className = "admin-pagination__label";
  label.textContent = `Page ${page} of ${totalPages}`;

  const next = document.createElement("button");
  next.className = "btn btn-secondary";
  next.type = "button";
  next.textContent = "Next";
  next.disabled = page >= totalPages;
  next.onclick = () => {
    page += 1;
    load();
  };

  pagination.append(previous, label, next);
}

async function load() {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("payments")
    .select(
      "id,order_id,provider,provider_reference,amount,status,created_at,orders(order_number,status,payment_status)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  if (page > totalPages) {
    page = totalPages;
    return load();
  }

  rows.innerHTML =
    (data || [])
      .map((payment) => {
        const order = payment.orders;
        const orderNumber = order?.order_number || `BF-${String(payment.order_id).slice(0, 8)}`;
        const paymentStatus = payment.status || "pending";
        const orderStatus = order?.status || "pending_payment";

        return `<tr>
      <td><strong>${escapeHtml(String(payment.id).slice(0, 8))}</strong></td>
      <td><strong>${escapeHtml(orderNumber)}</strong><small class="admin-order-id">${escapeHtml(String(payment.order_id).slice(0, 8))}</small></td>
      <td>${escapeHtml(payment.provider || "—")}</td>
      <td>${escapeHtml(payment.provider_reference || "—")}</td>
      <td>${naira.format(Number(payment.amount))}</td>
      <td><span class="admin-status-badge ${paymentClass(paymentStatus)}">${escapeHtml(paymentLabel(paymentStatus))}</span></td>
      <td><span class="admin-status-badge ${orderClass(orderStatus)}">${escapeHtml(orderLabel(orderStatus))}</span></td>
      <td>${escapeHtml(new Date(payment.created_at).toLocaleString("en-NG"))}</td>
    </tr>`;
      })
      .join("") || '<tr><td colspan="8">No transactions yet.</td></tr>';

  renderPagination(totalPages);
}

async function init() {
  const access = await requireAdmin();
  if (!access) {
    location.href = "/admin/";
    return;
  }
  await load();
}

init().catch((error) => {
  console.error(error);
  status.textContent = "Could not load transactions.";
  status.hidden = false;
});
