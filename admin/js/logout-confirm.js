import { supabase } from "./lib/supabaseClient.js";
import { signOutAdmin } from "./services/adminAuthService.js";

const button = document.getElementById("admin-logout");
const deliveryRows = document.getElementById("delivery-rows");
const promoRows = document.getElementById("promo-rows");
const adminAlert = document.getElementById("admin-alert");

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}

function showAdminAlert(message, error = false) {
  if (!adminAlert) return;
  adminAlert.textContent = message;
  adminAlert.className = `alert${error ? " error" : ""}`;
  adminAlert.hidden = false;
}

function openConfirm({ title, message, confirmLabel = "Delete", onConfirm }) {
  const modal = document.createElement("div");
  modal.className = "logout-modal admin-confirm-modal";
  modal.innerHTML = `
    <div class="logout-modal__backdrop" data-close></div>
    <section class="logout-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-copy">
      <div class="logout-modal__icon admin-confirm-modal__icon--danger" aria-hidden="true">!</div>
      <h2 id="admin-confirm-title">${escapeHtml(title)}</h2>
      <p id="admin-confirm-copy">${escapeHtml(message)}</p>
      <div class="logout-modal__actions">
        <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
        <button type="button" class="btn btn-danger" data-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    </section>
  `;
  document.body.append(modal);

  const confirmButton = modal.querySelector("[data-confirm]");
  const close = () => {
    modal.hidden = true;
    setTimeout(() => modal.remove(), 120);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      cleanup();
      close();
    }
  };
  const onClick = async (event) => {
    if (event.target.closest("[data-close], [data-cancel]")) {
      cleanup();
      close();
      return;
    }
    if (!event.target.closest("[data-confirm]") || confirmButton.disabled) return;
    confirmButton.disabled = true;
    confirmButton.textContent = "Deleting…";
    try {
      await onConfirm();
      cleanup();
      close();
    } catch (error) {
      confirmButton.disabled = false;
      confirmButton.textContent = confirmLabel;
      modal.querySelector("#admin-confirm-copy").textContent =
        error?.message || "The action could not be completed.";
    }
  };
  const cleanup = () => {
    document.removeEventListener("keydown", onKeydown);
    modal.removeEventListener("click", onClick);
  };

  modal.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  modal.hidden = false;
  modal.querySelector("[data-cancel]").focus();
}

if (button) {
  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openConfirm({
        title: "Log out?",
        message: "Are you sure you want to log out of Beulah Foods Admin?",
        confirmLabel: "Log out",
        onConfirm: async () => {
          await signOutAdmin();
          window.location.reload();
        },
      });
    },
    true,
  );
}

async function refreshDeliveryTable() {
  if (!deliveryRows) return;
  const { data, error } = await supabase
    .from("delivery_settings")
    .select("id,delivery_fee,is_delivery_enabled,is_active,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  deliveryRows.innerHTML =
    (data || [])
      .map((item) => {
        const deliveryLabel = item.is_delivery_enabled
          ? `On · ${formatNaira(item.delivery_fee)}`
          : "Off";
        return `<tr><td>${deliveryLabel}</td><td>—</td><td>${item.is_active ? '<span class="badge">Active</span>' : "Inactive"}</td><td><button class="btn btn-secondary" data-delivery-edit="${item.id}">Edit</button> <button class="btn btn-secondary" data-delivery-toggle="${item.id}">${item.is_active ? "Deactivate" : "Activate"}</button> <button class="btn btn-secondary" data-delivery-delete="${item.id}">Delete</button></td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="4" class="muted">No delivery settings. Checkout will work without delivery charges.</td></tr>';
}

window.addEventListener("beulah:delivery-saved", () => {
  refreshDeliveryTable().catch((error) =>
    showAdminAlert(error?.message || "Could not refresh delivery settings.", true),
  );
});

async function handleDeliveryControl(button, action) {
  const id = button.dataset.deliveryEdit || button.dataset.deliveryToggle;
  const { data, error } = await supabase
    .from("delivery_settings")
    .select("id,delivery_fee,is_delivery_enabled,is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;

  if (action === "edit") {
    document.getElementById("delivery-id").value = data.id;
    document.getElementById("delivery-fee").value = data.delivery_fee ?? "";
    document.getElementById("delivery-enabled").checked = Boolean(data.is_delivery_enabled);
    document.getElementById("delivery-active").checked = Boolean(data.is_active);
    document.getElementById("free-delivery-enabled").checked = false;
    document.getElementById("delivery-threshold").value = "";
    document
      .getElementById("delivery-form")
      .scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!data.is_active) {
    const { error: deactivateError } = await supabase
      .from("delivery_settings")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true);
    if (deactivateError) throw deactivateError;
  }

  const { error: updateError } = await supabase
    .from("delivery_settings")
    .update({ is_active: !data.is_active, updated_at: new Date().toISOString() })
    .eq("id", data.id);
  if (updateError) throw updateError;
  await refreshDeliveryTable();
  showAdminAlert(
    data.is_active ? "Delivery settings deactivated." : "Delivery settings activated.",
  );
}

async function handleDelete(event) {
  const deliveryButton = event.target.closest("[data-delivery-delete]");
  const promoButton = event.target.closest("[data-promo-delete]");
  if (!deliveryButton && !promoButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const isDelivery = Boolean(deliveryButton);
  const id = (deliveryButton || promoButton).dataset[isDelivery ? "deliveryDelete" : "promoDelete"];
  const title = isDelivery ? "Delete delivery settings?" : "Delete promo code?";
  const message = isDelivery
    ? "This delivery setting will be permanently removed."
    : "This promo code will be permanently removed.";

  openConfirm({
    title,
    message,
    confirmLabel: "Delete",
    onConfirm: async () => {
      const { error } = await supabase
        .from(isDelivery ? "delivery_settings" : "promo_codes")
        .delete()
        .eq("id", id);
      if (error) throw error;

      if (isDelivery) {
        await refreshDeliveryTable();
      } else if (promoRows) {
        const row = promoButton.closest("tr");
        row?.remove();
        if (!promoRows.querySelector("tr")) {
          promoRows.innerHTML = '<tr><td colspan="5" class="muted">No promo codes yet.</td></tr>';
        }
      }
      showAdminAlert(isDelivery ? "Delivery settings deleted." : "Promo code deleted.");
    },
  });
}

document.addEventListener(
  "click",
  async (event) => {
    const editButton = event.target.closest("[data-delivery-edit]");
    const toggleButton = event.target.closest("[data-delivery-toggle]");
    if (!editButton && !toggleButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      await handleDeliveryControl(editButton || toggleButton, editButton ? "edit" : "toggle");
    } catch (error) {
      showAdminAlert(error?.message || "Could not update delivery settings.", true);
    }
  },
  true,
);

document.addEventListener("click", handleDelete, true);
