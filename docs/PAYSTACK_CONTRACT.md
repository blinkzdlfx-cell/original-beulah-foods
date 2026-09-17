# Paystack Integration Contract

This contract is based on Paystack's current API/webhook guidance and the clean rebuild architecture.

## Server boundary

All Paystack secret-key operations run in Cloudflare Worker server code. Browser JavaScript never receives the Paystack secret key.

Implemented routes:

```text
POST /api/paystack/initialize
POST /api/paystack/verify
POST /api/paystack/webhook
```

The Worker authenticates customer requests with the Supabase Auth access token supplied by the browser. Privileged Worker-to-Supabase operations use the Cloudflare-only `SUPABASE_SERVICE_ROLE_KEY`.

## Initialize

1. Browser sends the existing order ID and the customer's Supabase access token to Cloudflare.
2. Cloudflare authenticates the access token with Supabase Auth.
3. Cloudflare calls `create_paystack_payment_attempt` using the customer's token so the database verifies order ownership, pending-payment state, active reservation, and authoritative order amount.
4. The database returns the payment reference and NGN amount.
5. Cloudflare converts NGN to kobo and initializes Paystack with the server-side secret.
6. Cloudflare returns only the Paystack authorization URL/reference needed by the browser.

Repeated initialization requests reuse an existing pending payment attempt for the same order rather than creating duplicate pending attempts.

## Amount contract

```text
orders.total    = NGN
payments.amount = NGN
Paystack amount = NGN × 100 (kobo)
```

The browser never supplies the authoritative payment amount.

## Callback

The callback page is a customer-facing return route only. It is not payment authority.

The callback sends the reference to:

```text
POST /api/paystack/verify
```

The Worker then verifies the transaction directly with Paystack and sends the provider status, amount and transaction ID to the same Supabase finalization function used by webhooks.

## Webhook

Paystack sends payment events to:

```text
POST /api/paystack/webhook
```

The Worker validates the `x-paystack-signature` HMAC SHA-512 signature over the raw request body using `PAYSTACK_SECRET_KEY` before trusting the event. Only `charge.success` currently causes payment finalization; other valid Paystack events are acknowledged and ignored.

If finalization fails, the Worker returns a non-200 response so Paystack can retry the event. Successful/accepted events return HTTP 200.

## Finalization

Both callback verification and webhook processing converge on:

```text
private.finalize_paystack_payment(...)
```

The database function is the business authority for payment state, order state, stock decrement and reservation completion. It is idempotent for an already-successful payment.

## Failure rules

- A redirect to the callback page is not proof of payment.
- A client-supplied payment amount is not authoritative.
- An unverified webhook payload is not trusted.
- Repeated callback/webhook events must not duplicate stock or reservation effects.
- A successful Paystack transaction received after the reservation expires is recorded as `late_payment` and does not silently resurrect stock/order state.
- Amount or currency mismatches do not finalize the order.

## Paystack fees — September 2026 reference

Paystack currently lists Nigerian local transactions at **1.5% + ₦100**, with the ₦100 component waived for transactions below ₦2,500 and a maximum local transaction fee of ₦2,000 per transaction. International card transactions are listed at **3.9% + ₦100** for Mastercard/Visa/Verve and **4.5% for American Express** in the current Paystack pricing/support material. Paystack states that integration itself has zero integration and maintenance fees. These charges are provider pricing, not application-side fees.

The application currently **does not add a Paystack fee to the customer's order total**. `orders.total` remains the merchandise/delivery/promo total defined by the database contract. If the business later chooses to pass Paystack fees to customers, that must be a separately approved pricing/business-rule change and must be implemented in the authoritative order calculation rather than in the browser.

## External configuration still required

The code and contracts are committed, but the deployed Worker still requires these server-only secrets:

- `PAYSTACK_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The Paystack Dashboard also needs the deployed webhook URL configured as:

```text
https://<storefront-origin>/api/paystack/webhook
```

Secrets must be configured in Cloudflare rather than committed to Git. The Wrangler configuration declares these secret names as required so deployment can validate their presence.
