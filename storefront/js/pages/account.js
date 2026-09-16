import { getCurrentSession, onAuthStateChange } from "../services/authService.js";
import { getCustomerProfile, updateCustomerProfile } from "../services/profileService.js";
import { initHeader } from "../components/navbar.js";

const nav = document.getElementById("site-header-nav");
const form = document.getElementById("account-form");
const view = document.getElementById("account-view");
const alertBox = document.getElementById("account-alert");
const editButton = document.getElementById("edit-profile");
const cancelButton = document.getElementById("cancel-edit");
const saveButton = document.getElementById("save-profile");
const emailInput = document.getElementById("email");
const fullNameInput = document.getElementById("full-name");
const phoneInput = document.getElementById("phone");
const addressInput = document.getElementById("address");
const emailLabel = document.getElementById("account-email");
const avatar = document.getElementById("account-avatar");
const viewFullName = document.getElementById("view-full-name");
const viewEmail = document.getElementById("view-email");
const viewPhone = document.getElementById("view-phone");
const viewAddress = document.getElementById("view-address");

const editableFields = [fullNameInput, phoneInput, addressInput];
let savedValues = { fullName: "", phone: "", address: "" };

initHeader(nav);

async function loadAccount() {
  const session = await getCurrentSession();
  if (!session?.user) {
    window.location.href = "login.html?redirect=account.html";
    return;
  }

  const email = session.user.email || "";
  emailInput.value = email;
  emailLabel.textContent = email;
  viewEmail.textContent = email || "Not available";
  avatar.setAttribute("aria-label", "Beulah Foods account");

  const profile = await getCustomerProfile();
  if (profile) {
    fullNameInput.value = profile.full_name || "";
    phoneInput.value = profile.phone || "";
    addressInput.value = profile.address || "";
  }

  captureSavedValues();
  renderSavedDetails();
  setEditMode(false);
}

editButton.addEventListener("click", () => {
  clearAlert();
  setEditMode(true);
  fullNameInput.focus();
});

cancelButton.addEventListener("click", () => {
  restoreSavedValues();
  clearAlert();
  setEditMode(false);
});

editableFields.forEach((field) => field.addEventListener("input", updateDirtyState));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();

  const fullName = fullNameInput.value.trim();
  if (!fullName) {
    showAlert("Please enter your full name.", "error");
    fullNameInput.focus();
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const profile = await updateCustomerProfile({
      fullName,
      phone: phoneInput.value.trim(),
      address: addressInput.value.trim(),
    });

    fullNameInput.value = profile.full_name || "";
    phoneInput.value = profile.phone || "";
    addressInput.value = profile.address || "";
    captureSavedValues();
    renderSavedDetails();
    setEditMode(false);
    showAlert("Your account details have been saved.", "success");
  } catch (error) {
    showAlert(error?.message || "Unable to save your account details. Please try again.", "error");
    saveButton.disabled = false;
    saveButton.textContent = "Save changes";
  }
});

onAuthStateChange((_event, session) => {
  if (!session?.user) window.location.href = "login.html?redirect=account.html";
});

function setEditMode(editing) {
  view.hidden = editing;
  form.hidden = !editing;
  editButton.hidden = editing;
  cancelButton.hidden = !editing;
  saveButton.hidden = !editing;
  saveButton.disabled = !hasChanges();
  saveButton.textContent = "Save changes";
}

function updateDirtyState() {
  saveButton.hidden = false;
  saveButton.disabled = !hasChanges();
}

function hasChanges() {
  return (
    fullNameInput.value.trim() !== savedValues.fullName ||
    phoneInput.value.trim() !== savedValues.phone ||
    addressInput.value.trim() !== savedValues.address
  );
}

function captureSavedValues() {
  savedValues = {
    fullName: fullNameInput.value.trim(),
    phone: phoneInput.value.trim(),
    address: addressInput.value.trim(),
  };
}

function renderSavedDetails() {
  viewFullName.textContent = savedValues.fullName || "Not added yet";
  viewEmail.textContent = emailInput.value || "Not available";
  viewPhone.textContent = savedValues.phone || "Not added yet";
  viewAddress.textContent = savedValues.address || "Not added yet";
}

function restoreSavedValues() {
  fullNameInput.value = savedValues.fullName;
  phoneInput.value = savedValues.phone;
  addressInput.value = savedValues.address;
}

function showAlert(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.hidden = false;
}

function clearAlert() {
  alertBox.hidden = true;
  alertBox.textContent = "";
}

loadAccount().catch((error) => {
  showAlert(
    error?.message || "Unable to load your account. Please refresh and try again.",
    "error",
  );
});
