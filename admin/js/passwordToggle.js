const eyeIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.1 12s3.6-6 9.9-6 9.9 6 9.9 6-3.6 6-9.9 6-9.9-6-9.9-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>';
const eyeOffIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 3 18 18"/><path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6.3 0 9.9 6 9.9 6a17.4 17.4 0 0 1-3.4 3.9"/><path d="M6.4 7.5C3.6 9.4 2.1 12 2.1 12s3.6 6 9.9 6c1.2 0 2.3-.2 3.3-.5"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2"/></svg>';

const input = document.getElementById("admin-password");
if (input) {
  const wrapper = document.createElement("div");
  wrapper.className = "admin-password-field";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.append(input);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-password-toggle";
  button.setAttribute("aria-label", "Show password");
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = eyeIcon;
  wrapper.append(button);

  button.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    button.setAttribute("aria-pressed", String(!visible));
    button.innerHTML = visible ? eyeIcon : eyeOffIcon;
  });
}
