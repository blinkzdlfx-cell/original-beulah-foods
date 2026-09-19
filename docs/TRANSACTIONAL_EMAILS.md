# Beulah Foods Transactional Email Delivery

## Scope

The Cloudflare Worker now sends the existing Beulah Foods transactional HTML templates through the Resend Email API.

### Implemented flows

1. Successful Paystack finalization
   - `order-confirmation.html`
   - `payment-success.html`
2. Admin order-status change
   - `order-status-update.html`

Authentication emails remain under Supabase Auth + Resend SMTP. Brevo is not involved.

## Architecture

`Paystack verify/webhook`
→ `finalize_paystack_payment`
→ successful order
→ Worker transactional email service
→ Resend Email API
→ customer inbox

Admin:

`Admin Orders`
→ `POST /api/admin/orders/status`
→ Worker verifies admin session
→ updates `orders.status`
→ Resend Email API
→ customer inbox

## Configuration

The Worker requires:

- `RESEND_API_KEY` — Cloudflare Worker secret. Use a Resend sending-access key and restrict it to the verified Beulah sending domain when possible.
- `RESEND_FROM_EMAIL` — Cloudflare Worker variable containing the verified sender, for example `Beulah Foods <orders@beulahfoods.com>` if that address is verified in Resend.

Do not put the Resend API key in GitHub or the browser.

## Idempotency

Resend idempotency keys are used for every transactional email:

- `order-confirmation/<order-id>`
- `payment-success/<order-id>`
- `order-status/<order-id>/<status>`

This prevents duplicate sends when Paystack verification and webhook processing both reach the same successful payment, and makes retries safe within Resend's idempotency window.

## Important payment behavior

Email delivery is downstream of payment finalization. If Resend is unavailable, the Worker does not roll back or invalidate a successful payment. It logs the email failure and returns the payment result with `email_sent: false`.

A later Paystack retry can attempt the same transactional email again using the same idempotency key.

## Order-status behavior

The current Supabase `orders.status` constraint allows:

- `pending_payment`
- `paid`
- `confirmed`
- `cancelled`

The admin Orders page now uses these actual database-supported values and routes status changes through the Worker so the customer notification is sent from the same trusted server boundary.

## Verification checklist

Before production activation:

- Set `RESEND_API_KEY` in the Cloudflare Worker.
- Set `RESEND_FROM_EMAIL` to an address on the verified Resend sending domain.
- Deploy the Worker.
- Create/use a controlled TEST order.
- Complete a Paystack TEST payment.
- Confirm both payment-related emails arrive.
- Confirm the email links open the customer's order on `https://www.beulahfoods.com`.
- Change the order status from the admin Orders page.
- Confirm the order-status email arrives.
- Repeat the payment verification/webhook path and confirm duplicate emails are not generated.
- Check Resend logs for the three transactional categories.

## Source templates

The editable design sources remain in `docs/email-templates/`:

- `order-confirmation.html`
- `payment-success.html`
- `order-status-update.html`

The Worker keeps a server-side copy of those templates in `worker/emailService.js` so the email body is not loaded from a public asset at send time.
