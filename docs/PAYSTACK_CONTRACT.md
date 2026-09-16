# Paystack Integration Contract

This contract is based on Paystack's current webhook guidance and the clean rebuild architecture.

## Server boundary

All Paystack secret-key operations run in Cloudflare Worker server code. Browser JavaScript never receives the Paystack secret key.

## Initialize

Cloudflare creates the transaction from the authoritative order amount and returns the authorization URL/reference to the browser.

## Callback

The callback page is a customer-facing return route only. It is not payment authority. The callback sends the reference to the Cloudflare verification endpoint.

## Webhook

Paystack sends payment events to the Cloudflare webhook endpoint. The Worker must validate the `x-paystack-signature` HMAC SHA512 signature using the Paystack secret before trusting the event.

The webhook should acknowledge Paystack promptly with HTTP 200 after accepting a valid event; long-running business processing should not be allowed to cause unnecessary webhook timeouts.

## Finalization

Both callback verification and webhook processing converge on the same idempotent Supabase payment-finalization mechanism.

## Failure rules

- A redirect to the callback page is not proof of payment.
- A client-supplied payment amount is not authoritative.
- An unverified webhook payload is not trusted.
- Repeated callback/webhook events must not duplicate stock or reservation effects.
