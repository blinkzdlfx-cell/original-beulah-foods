import { verifyPaystackPayment } from "../services/paystackService.js";
import { removeCartItems } from "../services/cartService.js";
import { getCheckoutSelection, clearCheckoutSelection } from "../services/checkoutStateBridge.js";

const title = document.getElementById("payment-title");
const message = document.getElementById("payment-message");
const status = document.getElementById("payment-status");

function setResult({ heading, detail, state = "" }) {
  title.textContent = heading;
  message.textContent = detail;
  status.textContent = detail;
  status.dataset.state = state;
}

async function init() {
  const params = new URLSearchParams(location.search);
  const reference = params.get("reference") || params.get("trxref");

  if (!reference) {
    setResult({
      heading: "Payment reference missing",
      detail: "We could not verify this payment because Paystack did not provide a reference.",
      state: "error",
    });
    return;
  }

  try {
    const result = await verifyPaystackPayment(reference);

    if (result?.status === "success" && result?.order_id) {
      // Only remove browser cart entries after the trusted server verification
      // reports success. The database remains the authority for the order.
      removeCartItems(getCheckoutSelection());
      clearCheckoutSelection();
      setResult({
        heading: "Payment confirmed",
        detail: "Your payment was verified successfully. Your order has been confirmed.",
        state: "success",
      });
      window.setTimeout(() => {
        window.location.assign(`order.html?id=${encodeURIComponent(result.order_id)}`);
      }, 900);
      return;
    }

    if (result?.status === "failed") {
      setResult({
        heading: "Payment was not completed",
        detail: "The payment was not confirmed. Your reservation remains governed by its server-side expiry rules.",
        state: "failed",
      });
      return;
    }

    setResult({
      heading: "Payment is still being verified",
      detail: "We have not received a trusted successful payment state yet. Please check My Orders rather than starting another payment immediately.",
      state: "pending",
    });
  } catch (error) {
    console.error(error);
    setResult({
      heading: "Payment verification unavailable",
      detail: error.message || "We could not verify the payment right now. Do not assume the payment failed; check My Orders or try again later.",
      state: "error",
    });
  }
}

init();
