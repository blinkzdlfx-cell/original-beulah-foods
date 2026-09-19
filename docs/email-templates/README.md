# Beulah Foods Transactional Email Templates

These HTML templates are the production email design source for Beulah Foods.

## Supabase Auth templates

- `confirm-signup.html` — signup/email confirmation
- `reset-password.html` — customer password recovery
- `admin-reset-password.html` — admin password recovery design
- `change-email.html` — email address change
- `magic-link.html` — passwordless sign-in

Supabase Auth template variables such as `{{ .Email }}` and `{{ .ConfirmationURL }}` are intentionally retained for direct use in the Supabase Auth email-template editor. The admin reset page already uses Supabase's password-recovery flow and redirects to `/admin/reset-password.html`.

### Admin password recovery note

The admin UI has its own `/admin/forgot-password.html` and `/admin/reset-password.html` flow. The `admin-reset-password.html` file documents the intended admin-specific email design. Supabase Auth provides one password-recovery email template per project, so a role-specific admin email cannot be selected automatically by the standard Auth template editor. If customer and admin emails must have different live content, use a custom application/Resend sending path rather than silently replacing the shared Supabase reset template.

## Application transactional templates

- `order-confirmation.html`
- `payment-success.html`
- `order-status-update.html`

These use application variables such as `{{customer_name}}`, `{{order_number}}`, and `{{order_url}}`. They are now wired into the Cloudflare Worker + Resend transactional sending path. The Worker renders the templates server-side and sends them through the Resend Email API.

## Rules

- Do not place API keys, SMTP passwords, or secrets in these templates.
- Keep all email links on `https://www.beulahfoods.com`.
- Keep transactional/auth email separate from Brevo marketing email.
- Test every template on desktop and mobile before production activation.
