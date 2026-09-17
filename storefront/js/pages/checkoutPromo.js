import { supabase } from "../lib/supabaseClient.js";

const form = document.getElementById("checkout-form");
const promoInput = document.getElementById("promo-code");
const checkButton = document.getElementById("checkout-promo-check");
const promoStatus = document.getElementById("checkout-promo-status");
const subtotalEl = document.getElementById("checkout-subtotal");
const deliveryEl = document.getElementById("checkout-delivery");
const discountRow = document.getElementById("checkout-discount-row");
const discountEl = document.getElementById("checkout-discount");
const totalEl = document.getElementById("checkout-total");

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});

function setPromoStatus(message, type = "") {
  promoStatus.textContent = message;
  promoStatus.className = `checkout-promo-status${type ? ` is-${type}` : ""}`;
}

function parseNaira(text) {
  const value = String(text ?? "").replace(/[^0-9.-]/g, "");
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function showDiscount(discount) {
  const subtotal = parseNaira(subtotalEl.textContent);
  const delivery = parseNaira(deliveryEl.textContent);
  const total = Math.max(0, subtotal + delivery - discount);

  discountRow.hidden = discount <= 0;
  discountEl.textContent = discount > 0 ? `−${naira.format(discount)}` : "—";
  totalEl.textContent = naira.format(total);
}

checkButton?.addEventListener("click", async () => {
  setPromoStatus("");

  if (promoInput?.disabled) {
    setPromoStatus("This order is already reserved. Promo codes cannot be changed now.", "error");
    return;
  }

  const code = promoInput?.value.trim() || "";
  if (!code) {
    showDiscount(0);
    setPromoStatus("Enter a promo code to check it.", "error");
    return;
  }

  const subtotal = parseNaira(subtotalEl.textContent);
  if (subtotal <= 0) {
    setPromoStatus("Your order subtotal is not ready yet. Please try again.", "error");
    return;
  }

  checkButton.disabled = true;
  checkButton.textContent = "Checking…";

  try {
    const { data: discount, error } = await supabase.rpc("validate_promo", {
      p_code: code,
      p_subtotal: subtotal,
    });

    if (error) throw error;

    const amount = Math.max(0, Number(discount) || 0);
    showDiscount(amount);
    setPromoStatus(
      amount > 0
        ? `${code.toUpperCase()} is valid. ${naira.format(amount)} discount applied.`
        : `${code.toUpperCase()} is valid, but no discount applies.`,
      "success",
    );
  } catch (error) {
    showDiscount(0);
    const message = error?.message || "";
    if (message.includes("PROMO_MINIMUM_NOT_MET")) {
      setPromoStatus("This promo code does not meet the minimum order amount.", "error");
    } else if (message.includes("PROMO_INVALID")) {
      setPromoStatus("That promo code is invalid or inactive.", "error");
    } else {
      console.error(error);
      setPromoStatus("Could not check the promo code. Please try again.", "error");
    }
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = "Check promo code";
  }
});

promoInput?.addEventListener("input", () => {
  if (!promoInput.disabled) {
    setPromoStatus("");
    showDiscount(0);
  }
});

form?.addEventListener("submit", () => {
  setPromoStatus("");
});
