const FORM_BUTTONS = {
  "category-form": "button[type=submit]",
  "promo-form": "button[type=submit]",
};

const originalLabels = new WeakMap();
function setBusy(form, busy) {
  const selector = FORM_BUTTONS[form.id];
  const button = selector ? form.querySelector(selector) : null;
  if (!button) return;
  if (!originalLabels.has(button)) originalLabels.set(button, button.textContent);
  button.disabled = busy;
  button.textContent = busy ? "Saving…" : originalLabels.get(button);
}
Object.keys(FORM_BUTTONS).forEach((id) => {
  const form = document.getElementById(id);
  form?.addEventListener("submit", () => setBusy(form, true), true);
});
const alertBox = document.getElementById("admin-alert");
if (alertBox) {
  new MutationObserver(() => {
    if (!alertBox.hidden) {
      Object.keys(FORM_BUTTONS).forEach((id) => {
        const form = document.getElementById(id);
        if (form) setBusy(form, false);
      });
      if (/saved\./i.test(alertBox.textContent || "")) window.dispatchEvent(new CustomEvent("beulah:admin-inventory-refresh"));
    }
  }).observe(alertBox, { attributes: true, childList: true, characterData: true, subtree: true });
}
