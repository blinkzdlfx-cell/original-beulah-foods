import { supabase } from "./lib/supabaseClient.js";
import { requireAdmin } from "./services/adminAuthService.js";

const rows = document.getElementById("rows");
const status = document.getElementById("status");
const pagination = document.getElementById("order-pagination");
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
const statuses = ["pending_payment", "paid", "processing", "completed", "cancelled"];
const PAGE_SIZE = 25;
let page = 1;

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}
function showStatus(message, error = false) {
  status.textContent = message;
  status.className = `alert${error ? " error" : ""}`;
  status.hidden = false;
}
function formatStatus(value) {
  return String(value || "").replaceAll("_", " ");
}
function statusLabel(value) {
  const labels = { pending_payment: "Pending payment", paid: "Paid", processing: "Processing", completed: "Completed", cancelled: "Cancelled" };
  return labels[value] || formatStatus(value);
}

async function init() {
  const access = await requireAdmin();
  if (!access) {
    location.href = "/admin/";
    return;
  }
  await loadOrders();
}

async function loadOrders() {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from("orders")
    .select(
      "id,order_number,customer_id,delivery_name,delivery_phone,delivery_address,subtotal,delivery_fee,discount_amount,total,promo_code,payment_status,status,created_at,order_items(product_name,quantity,line_total)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  rows.innerHTML =
    (data || [])
      .map((order) => {
        const options = statuses
          .map((value) => `<option value="${value}" ${value === order.status ? "selected" : ""}>${statusLabel(value)}</option>`)
          .join("");
        const items = order.order_items || [];
        const itemMarkup = items.length
          ? items.map((item) => `<span>${escapeHtml(item.product_name)} × ${item.quantity}</span>`).join("")
          : "<span>—</span>";
        const delivery = [order.delivery_name, order.delivery_phone, order.delivery_address]
          .filter(Boolean)
          .map(escapeHtml);
        const orderNumber = order.order_number || `BF-${String(order.id).slice(0, 8)}`;
        const orderStatus = statusLabel(order.status);
        const paymentStatus = formatStatus(order.payment_status);
        const statusClass = order.status === "cancelled" ? "is-cancelled" : ["paid", "processing", "completed"].includes(order.status) ? "is-paid" : "is-pending";
        const promoMarkup = order.promo_code
          ? `<strong>${escapeHtml(order.promo_code)}</strong><small>Discount ${naira.format(Number(order.discount_amount || 0))}</small>`
          : "—";
        return `<tr><td><strong>${escapeHtml(orderNumber)}</strong><small class="admin-order-id">${escapeHtml(order.id.slice(0, 8))}</small></td><td><div class="admin-order-customer"><strong>${delivery[0] || "Customer"}</strong><small>${delivery[1] || `ID ${escapeHtml(order.customer_id.slice(0, 8))}`}</small></div></td><td><div class="admin-order-items">${itemMarkup}</div></td><td><div class="admin-order-address">${delivery[2] || "No delivery address"}</div></td><td><div class="admin-order-total"><strong>${naira.format(Number(order.total))}</strong><small>Subtotal ${naira.format(Number(order.subtotal))}</small></div></td><td><div class="admin-order-total">${promoMarkup}</div></td><td><span class="admin-status-badge">${escapeHtml(paymentStatus)}</span></td><td><span class="admin-status-badge ${statusClass}">${escapeHtml(orderStatus)}</span><select class="order-status-select" data-order-id="${escapeHtml(order.id)}" aria-label="Order status for ${escapeHtml(orderNumber)}">${options}</select></td><td>${escapeHtml(new Date(order.created_at).toLocaleString("en-NG"))}</td></tr>`;
      })
      .join("") || '<tr><td colspan="9">No orders yet.</td></tr>';

  renderPagination(Math.ceil((count || 0) / PAGE_SIZE));
  rows.querySelectorAll(".order-status-select").forEach((select) => select.addEventListener("change", () => updateStatus(select)));
}

function renderPagination(totalPages) {
  pagination.innerHTML = "";
  if (totalPages <= 1) return;
  const previous = document.createElement("button");
  previous.className = "btn btn-secondary";
  previous.type = "button";
  previous.textContent = "Previous";
  previous.disabled = page <= 1;
  previous.onclick = () => { page -= 1; loadOrders(); };
  const label = document.createElement("span");
  label.className = "admin-pagination__label";
  label.textContent = `Page ${page} of ${totalPages}`;
  const next = document.createElement("button");
  next.className = "btn btn-secondary";
  next.type = "button";
  next.textContent = "Next";
  next.disabled = page >= totalPages;
  next.onclick = () => { page += 1; loadOrders(); };
  pagination.append(previous, label, next);
}

async function updateStatus(select) {
  const orderId = select.dataset.orderId;
  const nextStatus = select.value;
  select.disabled = true;
  try {
    const { error } = await supabase.rpc("admin_update_order_status", { target_order_id: orderId, target_status: nextStatus });
    if (error) throw error;
    showStatus("Order status updated.");
    await loadOrders();
  } catch (error) {
    console.error(error);
    showStatus(error?.message || "Could not update order status.", true);
    await loadOrders();
  } finally {
    select.disabled = false;
  }
}

init().catch((error) => {
  console.error(error);
  showStatus("Could not load orders.", true);
});
