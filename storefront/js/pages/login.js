import { signInCustomer } from "../services/authService.js";
import { isValidEmail } from "../utils/validators.js";
import { initHeader } from "../components/navbar.js";
import { showToast } from "../components/toast.js";

initHeader(document.getElementById("site-header-nav"));

const form = document.getElementById("login-form");
const alertBox = document.getElementById("form-alert");
const submitBtn = document.getElementById("login-submit");
const params = new URLSearchParams(window.location.search);
const redirectTarget = sanitizeRedirect(params.get("redirect"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!email || !password) return showAlert("error", "Enter your email and password.");
  if (!isValidEmail(email)) return showAlert("error", "Enter a valid email address.");

  setLoading(true);
  try {
    await signInCustomer({ email, password });
    showToast("Logged in successfully.");
    window.setTimeout(() => {
      window.location.href = redirectTarget;
    }, 250);
  } catch (error) {
    setLoading(false);
    const message = describeLoginError(error);
    showAlert("error", message);
    showToast(message, "error", 3600);
  }
});

function sanitizeRedirect(value) {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  if (/^[a-zA-Z0-9_-]+\.html(?:\?.*)?$/.test(value)) return `/${value}`;
  return "/";
}

function describeLoginError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("email not confirmed"))
    return "Please confirm your email before logging in — check your inbox for the confirmation link.";
  if (message.includes("invalid login credentials"))
    return "That email or password isn't right. Please try again.";
  return "Something went wrong logging in. Please try again.";
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
  submitBtn.textContent = isLoading ? "Logging in…" : "Log in";
}
