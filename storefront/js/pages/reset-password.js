import { updatePassword, onAuthStateChange } from "../services/authService.js";
import { initHeader } from "../components/navbar.js";

initHeader(document.getElementById("site-header-nav"));

const form = document.getElementById("reset-password-form");
const statusText = document.getElementById("reset-password-status");
const alertBox = document.getElementById("form-alert");
const submitBtn = document.getElementById("reset-password-submit");

const POST_RESET_DESTINATION = "index.html";
const RECOVERY_TIMEOUT_MS = 8000;

let recoveryReady = false;

const urlError = readUrlError();

if (urlError) {
  showLinkError(urlError);
} else {
  onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryReady = true;
      showResetForm();
    }
  });

  setTimeout(() => {
    if (!recoveryReady) {
      showLinkError();
    }
  }, RECOVERY_TIMEOUT_MS);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();

  const newPassword = form.newPassword.value;
  const confirmNewPassword = form.confirmNewPassword.value;

  if (!newPassword || !confirmNewPassword) {
    showAlert("error", "Enter and confirm your new password.");
    return;
  }

  if (newPassword !== confirmNewPassword) {
    showAlert("error", "Passwords don't match.");
    return;
  }

  setLoading(true);

  try {
    await updatePassword(newPassword);
    showSuccess();
  } catch (error) {
    setLoading(false);
    showAlert("error", describeUpdateError(error));
  }
});

function describeUpdateError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("password")) return error.message;
  if (message.includes("session") || message.includes("token")) {
    return "Your reset link has expired. Please request a new one.";
  }
  return "Something went wrong setting your new password. Please try again.";
}

function showResetForm() {
  statusText.hidden = true;
  form.hidden = false;
}

function showLinkError(urlErrorInfo) {
  statusText.hidden = true;
  form.hidden = true;

  const message =
    urlErrorInfo?.description ||
    "This reset link is invalid or has expired. Please request a new one.";

  showAlert("error", message);
  appendRequestNewLinkAction();
}

function showSuccess() {
  form.hidden = true;
  hideAlert();

  const wrapper = document.createElement("div");

  const alert = document.createElement("div");
  alert.className = "alert alert-success";
  alert.setAttribute("role", "status");
  alert.textContent = "Your password has been updated.";

  const link = document.createElement("a");
  link.href = POST_RESET_DESTINATION;
  link.className = "btn btn-primary";
  link.textContent = "Continue to Beulah Foods";

  wrapper.append(alert, link);
  form.replaceWith(wrapper);
}

function appendRequestNewLinkAction() {
  const link = document.createElement("a");
  link.href = "forgot-password.html";
  link.className = "btn btn-primary";
  link.textContent = "Request a new link";
  alertBox.insertAdjacentElement("afterend", link);
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
  submitBtn.textContent = isLoading ? "Setting password…" : "Set new password";
}

function readUrlError() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);

  const errorCode = hashParams.get("error_code") || queryParams.get("error_code");
  const errorDescription =
    hashParams.get("error_description") || queryParams.get("error_description");
  const error = hashParams.get("error") || queryParams.get("error");

  if (!error && !errorCode) return null;

  return {
    code: errorCode,
    description: errorDescription ? errorDescription.replace(/\+/g, " ") : null,
  };
}
