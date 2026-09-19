# Production Readiness Phase 2 — Supabase Auth + Resend

## Objective

Move the Beulah Foods authentication/email path from TEST assumptions to the production hostname:

- https://www.beulahfoods.com
- Supabase Auth
- Resend SMTP
- signup confirmation
- password reset
- email-change confirmation where enabled

This phase does not change Beulah AI, catalogue logic, checkout logic, or Paystack payment behavior.

## Architecture

    Beulah Foods storefront
            |
            v
       Supabase Auth
            |
            v
        Resend SMTP
            |
            v
    Customer authentication / transactional email

Brevo remains outside this phase and remains reserved for marketing email.

## Production URL contract

Primary site:

- https://www.beulahfoods.com/

Required authentication routes:

- /login
- /signup
- /forgot-password
- /reset-password
- /verification-success

The production Supabase Auth Site URL and redirect allowlist must use the production hostname and the exact callback paths used by the storefront.

## Configuration gates

### A. Supabase Auth

- [ ] Confirm the production candidate project is wzrqlquspbipvrzidcxe.
- [ ] Set/verify Site URL: https://www.beulahfoods.com
- [ ] Add the required production redirect URLs.
- [ ] Confirm email confirmations are configured as intended.
- [ ] Confirm password recovery redirects to /reset-password.
- [ ] Confirm signup verification redirects to /verification-success.
- [ ] Confirm no TEST hostname is required for the production customer flow.
- [ ] Confirm browser code uses only the publishable Supabase key.
- [ ] Confirm server-side Worker authentication continues to use the server secret only.

### B. Resend

- [ ] Confirm the Beulah Foods sending domain is verified in Resend.
- [ ] Confirm the sender identity is verified.
- [ ] Obtain the SMTP credentials/configuration required by Supabase Auth.
- [ ] Configure Supabase Auth SMTP with the production sender.
- [ ] Keep Resend credentials out of browser code and Git.
- [ ] Confirm sender/from identity matches the verified production domain.

### C. Acceptance tests

- [ ] New customer signup.
- [ ] Confirmation email delivered.
- [ ] Confirmation link opens the production hostname.
- [ ] Account becomes verified after confirmation.
- [ ] Login succeeds after verification.
- [ ] Forgot-password email delivered.
- [ ] Password reset link opens /reset-password.
- [ ] New password is accepted.
- [ ] Old password no longer works.
- [ ] Email-change flow tested if enabled.
- [ ] No authentication email is sent through Brevo.

## Safety rules

- Do not expose SMTP credentials or API keys.
- Do not paste secret values into source files.
- Do not disable email confirmation merely to make acceptance tests pass.
- Do not modify customer records manually to simulate successful verification.
- Do not change Paystack production configuration in this phase.
- Do not modify Beulah AI behavior.

## Exit criteria

Phase 2 is complete only when:

1. Supabase Auth production URLs are configured.
2. Resend SMTP is verified and connected.
3. Signup confirmation passes end-to-end.
4. Password reset passes end-to-end.
5. Any enabled email-change flow passes.
6. Production URLs are confirmed on the actual deployed Worker.
7. The results are recorded in docs/WORKLOG.md.

Until then, production release remains gated.


## Email template design

The initial production email design set is stored under `docs/email-templates/`. Supabase Auth templates use Supabase's template variables; application order/payment templates use explicit application placeholders and are not considered integrated until the Resend sending path is verified.
