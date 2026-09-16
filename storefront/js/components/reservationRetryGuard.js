import { supabase } from "../lib/supabaseClient.js";

const retryButton = document.getElementById("checkout-retry-reservation");
const countdown = document.getElementById("checkout-reservation-countdown");
const status = document.getElementById("checkout-status");

if (retryButton) {
  retryButton.hidden = true;

  const setError = (message) => {
    if (!status) return;
    status.textContent = message;
    status.className = "checkout-status checkout-status--error";
    status.hidden = false;
  };

  const syncVisibility = () => {
    retryButton.hidden = countdown?.textContent?.trim() !== "Expired";
  };

  new MutationObserver(syncVisibility).observe(countdown || retryButton, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  retryButton.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (countdown?.textContent?.trim() !== "Expired") {
        retryButton.hidden = true;
        setError("This reservation is still active. Please wait for the countdown to finish.");
        return;
      }

      retryButton.disabled = true;
      retryButton.textContent = "Preparing…";

      const now = new Date().toISOString();
      const { data: reservations, error: lookupError } = await supabase
        .from("reservations")
        .select("order_id")
        .eq("status", "active")
        .gt("expires_at", now)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lookupError || !reservations?.length) {
        retryButton.disabled = false;
        retryButton.textContent = "Retry checkout";
        setError(
          "This reservation is no longer available. Please return to your cart and start checkout again.",
        );
        return;
      }

      const { error } = await supabase.rpc("retry_expired_pending_order", {
        target_order_id: reservations[0].order_id,
      });

      if (error) {
        retryButton.disabled = false;
        retryButton.textContent = "Retry checkout";
        if (error.message?.includes("RESERVATION_STILL_ACTIVE")) {
          retryButton.hidden = true;
          setError("This reservation is still active. Please wait for the countdown to finish.");
        } else {
          setError(error.message || "Could not prepare checkout. Please try again.");
        }
        return;
      }

      window.location.href = "/checkout.html";
    },
    true,
  );

  syncVisibility();
}
