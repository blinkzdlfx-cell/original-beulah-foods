# Beulah Foods Transactional Email Templates

These HTML templates are the production email design source for Beulah Foods.

## Supabase Auth templates

- `confirm-signup.html` — signup/email confirmation
- `reset-password.html` — password recovery
- `change-email.html` — email address change
- `magic-link.html` — passwordless sign-in

Supabase Auth template variables such as `{{ .Email }}` and `{{ .ConfirmationURL }}` are intentionally retained for direct use in the Supabase Auth email-template editor.

## Application transactional templates

- `order-confirmation.html`
- `payment-success.html`
- `order-status-update.html`

These use application variables such as `{{customer_name}}`, `{{order_number}}`, and `{{order_url}}`. They are design/source templates only until the application email-sending path is explicitly wired to Resend.

## Rules

- Do not place API keys, SMTP passwords, or secrets in these templates.
- Keep all email links on `https://www.beulahfoods.com`.
- Keep transactional/auth email separate from Brevo marketing email.
- Test every template on desktop and mobile before production activation.
