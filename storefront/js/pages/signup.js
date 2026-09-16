import { signUpCustomer } from "../services/authService.js";
import { isValidEmail, passwordsMatch } from "../utils/validators.js";
import { initHeader } from "../components/navbar.js";

initHeader(document.getElementById("site-header-nav"));

const form = document.getElementById("signup-form");
const alertBox = document.getElementById("form-alert");
const submitBtn = document.getElementById("signup-submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();

  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (!fullName || !email || !password || !confirmPassword) {
    showAlert("error", "Please fill in every field.");
    return;
  }

  if (!isValidEmail(email)) {
    showAlert("error", "Enter a valid email address.");
    return;
  }

  if (!passwordsMatch(password, confirmPassword)) {
    showAlert("error", "Passwords don't match.");
    return;
  }

  setLoading(true);

  try {
    const data = await signUpCustomer({ fullName, email, password });
    window.localStorage.setItem("beulah:new-account-welcome", "1");

    if (data.session) {
      showFinishedState(
        "success",
        "Account created — you're already signed in.",
        "index.html",
        "Continue to Beulah Foods",
      );
    } else {
      showFinishedState(
        "success",
        `We've sent a confirmation link to ${email}. Confirm your email, then log in.`,
        "login.html",
        "Go to login",
      );
    }
  } catch (error) {
    setLoading(false);
    showAlert("error", describeSignupError(error));
  }
});

function describeSignupError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("already registered") || message.includes("already exists")) {
    return "That email is already registered. Try logging in instead.";
  }
  if (message.includes("password")) {
    return error.message;
  }
  return "Something went wrong creating your account. Please try again.";
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
  submitBtn.textContent = isLoading ? "Creating account…" : "Sign up";
}

function showFinishedState(kind, message, href, linkLabel) {
  form.replaceWith(buildFinishedCard(kind, message, href, linkLabel));
}

function buildFinishedCard(kind, message, href, linkLabel) {
  const wrapper = document.createElement("div");

  const alert = document.createElement("div");
  alert.className = `alert alert-${kind}`;
  alert.setAttribute("role", "status");
  alert.textContent = message;

  const link = document.createElement("a");
  link.href = href;
  link.className = "btn btn-primary";
  link.textContent = linkLabel;

  wrapper.append(alert, link);
  return wrapper;
}
