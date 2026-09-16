# Beulah Foods Clean Rebuild Architecture

## 1. System boundary

```text
Customer browser
    |
    v
Cloudflare Worker
  - static storefront
  - Paystack initialize/verify API
  - Paystack webhook endpoint
    |
    +--------------------> Paystack
    |
    +--------------------> Supabase
                              - Auth
                              - Products/catalogue
                              - Orders/order items
                              - Reservations/inventory state
                              - Payments
                              - trusted database finalization
```

Cloudflare is the privileged payment integration boundary. Supabase remains the business and database source of truth.

## 2. Paystack lifecycle

### Initialize

1. Browser authenticates with Supabase and sends an order identifier to Cloudflare.
2. Cloudflare authenticates the request and asks Supabase for authoritative checkout/payment data.
3. Cloudflare validates that the order is payable and the reservation is valid.
4. Cloudflare initializes Paystack with the server-side secret key.
5. Cloudflare returns only the Paystack authorization URL/reference needed by the browser.

### Customer callback

Paystack redirects to the static storefront callback page with the transaction reference. The browser sends that reference to Cloudflare. Cloudflare verifies the transaction with Paystack and forwards verified payment data to Supabase for authoritative finalization.

### Webhook

Paystack calls the Cloudflare webhook endpoint. Cloudflare validates the Paystack signature, verifies/normalizes the event, and forwards the trusted payment result to Supabase. Webhook and callback paths use the same idempotent Supabase finalization mechanism.

## 3. Secrets

Browser-safe values:

- Supabase project URL
- Supabase anon/public key

Server-only values:

- Paystack secret key
- Supabase service-role key, if required by the chosen server-to-server implementation
- Any internal authentication secret used between Cloudflare and Supabase

No server secret may be embedded in HTML, CSS, JavaScript bundles, Git history, or public configuration.

## 4. Supabase authority

Supabase owns:

- customer authentication and authorization
- product prices and stock
- order totals
- order items
- reservation lifecycle
- payment records
- payment/order/reservation finalization
- idempotency rules

Cloudflare must not maintain a second authoritative copy of order or inventory state.

## 5. Reservations

Reservations remain in Supabase. Checkout creates a time-limited reservation. Expiry releases reserved stock and transitions the unpaid order according to the database state machine. Payment success confirms the reservation and consumes the reserved stock exactly once.

## 6. Payment amount contract

The application stores monetary values in naira at the database/business layer.

```text
orders.total       = NGN
payments.amount    = NGN
Paystack amount    = NGN * 100 (kobo)
```

The final payment amount must be derived from authoritative order/payment state, never trusted from browser input.

## 7. Idempotency

The same payment event may arrive through callback and webhook, or the webhook may be retried. Both paths must safely converge on the same final database state without double-decrementing stock, double-confirming reservations, or creating duplicate successful payment effects.
