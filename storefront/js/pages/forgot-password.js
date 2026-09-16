import { requestPasswordReset } from "../services/authService.js";
import { isValidEmail } from "../utils/validators.js";
import { initHeader } from "../components/navbar.js";

initHeader(document.getElementById("site-header-nav"));

const form = document.getElementById("forgot-password-form");
const alertBox = document.getElementById("form-alert");
const submitBtn = document.getElementById("forgot-password-submit");
const RESET_PASSWORD_URL = new URL("/reset-password.html", window.location.origin).toString();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();
  const email = form.email.value.trim();
  if (!email) return showAlert("error", "Enter your email address.");
  if (!isValidEmail(email)) return showAlert("error", "Enter a valid email address.");
  setLoading(true);
  try {
    await requestPasswordReset(email, RESET_PASSWORD_URL);
    showFinishedState(
      `If an account exists for ${email}, we've sent a link to reset your password. Check your inbox.`,
    );
  } catch (error) {
    setLoading(false);
    showAlert("error", describeResetRequestError(error));
  }
});

function describeResetRequestError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("rate limit") || message.includes("too many"))
    return "Too many requests. Please wait a moment and try again.";
  return "Something went wrong sending the reset link. Please try again.";
}
function showAlert(kind, message) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${kind}`;
  alertBox.hidden = false;
}
function hideAlert() {
  alertBox.hidden = true;
}
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Sending…" : "Send reset link";
}
function showFinishedState(message) {
  form.replaceWith(buildFinishedCard(message));
}
function buildFinishedCard(message) {
  const wrapper = document.createElement("div");
  const alert = document.createElement("div");
  alert.className = "alert alert-success";
  alert.setAttribute("role", "status");
  alert.textContent = message;
  wrapper.append(alert);
  return wrapper;
}
