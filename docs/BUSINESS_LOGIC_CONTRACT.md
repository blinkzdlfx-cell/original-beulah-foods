# Beulah Foods Business Logic Contract

## Purpose

This document defines the customer purchase lifecycle before the new Supabase schema and Paystack integration are implemented. It is the business-logic contract for the clean rebuild.

The storefront UI may change, but these state transitions must remain stable.

## Canonical customer flow

```text
Shop
  -> Cart
  -> Checkout
  -> Create pending order + reservation
  -> Continue to payment
  -> Paystack
  -> payment outcome
       -> successful
       -> failed
       -> pending / abandoned / unknown
       -> expired
       -> cancelled
```

The reservation is created **before** Paystack is opened. Payment does not create the reservation.

## 1. Shop

- Products are read from the live catalogue.
- Product price and available stock shown to the customer are informational and must not become payment authority.
- Available stock displayed to the customer is physical stock minus currently reserved stock.
- A product can be added to the browser cart only when currently available stock is greater than zero.
- Product quantity added from the product page is capped by the currently displayed available stock.

Current implementation reflects this catalogue/cart boundary in `shop.js`, `product.js`, and `catalogService.js`.

## 2. Cart

The cart is localStorage-first.

Stored data contains only:

```json
[
  { "productId": "<uuid>", "quantity": 2 }
]
```

The browser cart is not authoritative for price, stock, delivery, promotion, order status, reservation status, or payment status.

Rules:

- Cart survives navigation and reloads.
- Cart does not require login.
- Cart is not cleared merely because the user logs out.
- Product details are re-read from the live catalogue when required for display.
- Checkout revalidates everything server-side before creating the order.
- A successful purchase removes only the purchased product IDs from the browser cart.
- Failed, cancelled, abandoned, or expired payment attempts do not permanently destroy the cart contents.
- A retry starts from the cart and creates a fresh reservation/payment attempt rather than resurrecting an old payment attempt.

## 3. Checkout entry

Checkout requires an authenticated customer because the order and reservation belong to a customer account.

The customer must have complete delivery details:

- full name
- phone number
- delivery address

The checkout page may display a local preview of subtotal/delivery, but those values are not authoritative.

## 4. Create order + reservation

When the customer clicks **Confirm order & reserve items**:

1. Validate the authenticated customer.
2. Validate the selected cart items.
3. Re-read current product data.
4. Validate product availability and requested quantities.
5. Validate delivery configuration.
6. Validate the requested promo code, if present.
7. Calculate authoritative subtotal, discount, delivery fee, and total.
8. Create the pending order and order items.
9. Create the reservation atomically with the order.
10. Increase reserved inventory only through the reservation transaction.
11. Set the order to `pending_payment` / payment `pending`.
12. Return the order ID, order number, reservation ID, expiry time, and authoritative totals.

The entire order/reservation operation must be atomic. There must not be a state where an order exists without its reservation when stock was intended to be reserved.

The reservation window is 15 minutes.

## 5. Reserved state

While the reservation is active:

```text
order.status          = pending_payment
payment.status        = pending
reservation.status    = active
reservation.expires_at > now
```

The customer can:

- continue to payment;
- cancel the reservation;
- wait for the reservation to expire.

The customer cannot create a second active reservation for the same checkout attempt.

The countdown in the browser is only a UI representation of the server expiry timestamp. It is not the authority for expiration.

## 6. Continue to payment

Paystack is opened only after an active reservation exists.

The payment initialization request must use the authoritative order total from the backend. The browser must not supply the amount as payment authority.

Cloudflare is the Paystack server boundary:

```text
Browser
  -> Cloudflare /api/paystack/initialize
  -> Paystack
```

The Paystack secret never reaches the browser.

## 7. Successful payment

A payment is successful only after server-side verification/trusted webhook processing confirms the Paystack transaction.

Successful finalization must atomically:

1. identify the payment/order;
2. verify the Paystack reference;
3. verify the expected amount and currency;
4. verify the order is owned by the correct customer/context;
5. ensure the payment attempt has not already been finalized;
6. mark the payment successful;
7. mark the order paid/confirmed according to the final order-state contract;
8. convert the reservation from temporary hold to completed inventory consumption;
9. consume physical stock exactly once;
10. prevent a second callback/webhook from consuming stock again.

After success, the browser may remove the purchased product IDs from localStorage and show the confirmed order.

## 8. Failed payment

A Paystack transaction reported as failed is **not** a successful order.

The failed payment attempt remains in payment history.

The active reservation may remain available for another payment attempt until it expires or the customer cancels it, according to the payment-attempt contract.

A retry must create a fresh payment attempt/reference. It must not reuse an old Paystack reference.

No physical stock is consumed for a failed payment.

## 9. Pending, abandoned, or unknown payment

These states must never be converted to successful merely because the browser returned from Paystack.

Examples:

- customer closes the Paystack page;
- customer loses network connectivity;
- callback is delayed;
- verification request times out;
- provider reports a transaction as still pending;
- browser callback never arrives.

In these cases:

```text
payment = pending/unknown
order   = pending_payment
```

until a trusted provider result or defined expiration/cancellation rule resolves the attempt.

The UI must not claim success from a missing or ambiguous provider response.

## 10. Callback and webhook convergence

Both provider paths must converge on the same idempotent backend finalization mechanism:

```text
Paystack callback
      \
       -> trusted verification/finalizer -> Supabase state
      /
Paystack webhook
```

The callback is a customer-return mechanism and verification trigger. It is not itself the payment authority.

The webhook is independently validated using Paystack's signature mechanism before its event is trusted.

Duplicate callback/webhook delivery must be safe.

## 11. Reservation expiry

Expiration is a server-side state transition, not a browser-only event.

When the 15-minute reservation expires without successful payment:

```text
reservation.active -> reservation.expired
order.pending_payment -> order.cancelled
payment.pending -> remains historical pending/expired as defined by payment-attempt state
reserved inventory -> released
physical stock -> unchanged
```

The expired order remains in history.

The customer can start checkout again if stock is available.

The browser countdown may immediately display `Expired`, but the database must perform the authoritative release.

## 12. Explicit cancellation

If the customer cancels an active reservation before payment:

```text
reservation.active -> reservation.cancelled
order.pending_payment -> order.cancelled
reserved inventory -> released
physical stock -> unchanged
```

The order/payment history is retained.

The browser cart remains available so the customer can shop again.

## 13. Late payment after reservation expiry

A successful Paystack result received after the reservation has already expired must not automatically consume inventory that has already been released.

The finalizer must detect this condition and place the payment/order into the defined late-payment/manual-resolution path rather than silently resurrecting the expired reservation.

This protects inventory correctness and prevents double allocation.

## 14. Payment initialization failure

If order/reservation creation succeeds but Cloudflare cannot initialize Paystack:

- do not mark the order paid;
- do not consume physical stock;
- keep the active reservation until its normal expiry or explicit cancellation;
- allow the customer to retry payment initialization while the reservation is active;
- record the failure where appropriate without fabricating a provider transaction.

## 15. Browser state vs authoritative state

### Browser may own

- cart product IDs and quantities;
- selected cart items for checkout;
- UI countdown rendering;
- temporary navigation/locator information.

### Backend must own

- product price;
- physical stock;
- reserved stock;
- delivery fee/configuration;
- promo validity and discount;
- order totals;
- order status;
- reservation status/expiry;
- payment status;
- Paystack reference and transaction result;
- final inventory consumption.

## 16. Required invariants

The new backend must enforce these invariants:

1. **No payment without a reservation.**
2. **No successful payment without trusted Paystack verification.**
3. **No physical stock consumption before successful payment finalization.**
4. **A reservation cannot consume more stock than is available.**
5. **Expiration/cancellation releases reserved stock exactly once.**
6. **Successful finalization consumes physical stock exactly once.**
7. **Duplicate callback/webhook delivery is idempotent.**
8. **A late success cannot automatically consume already-released inventory.**
9. **Payment amount is derived from authoritative order data and verified against Paystack.**
10. **Historical orders/payment attempts are not silently deleted during retry.**
11. **A retry creates a fresh payment attempt/reference.**
12. **The browser cart is not the source of truth for inventory or money.**

## 17. Current frontend audit status

The imported storefront already contains most of the intended customer-facing state flow:

- Shop reads the catalogue and prevents adding an unavailable product.
- Cart persists locally and supports item selection.
- Checkout requires authentication and complete delivery details.
- Checkout calls `create_pending_order` before payment initialization.
- The resulting reservation has a 15-minute expiry shown in the UI.
- Active reservations can be cancelled.
- Expired reservations can be retried.
- Paystack initialization is routed through `/api/paystack/initialize`.
- The payment callback calls `/api/paystack/verify` and handles successful, failed, and unresolved results.
- Orders/reservations pages expose active, expired, cancelled, and completed states.

These behaviors are visible in the current storefront code and are the basis for the new backend contract.

## 18. Known frontend gaps before backend work

The business model is sound, but the current imported implementation is **not yet fully aligned with the clean rebuild**. These are frontend/state-orchestration issues to resolve before declaring the flow locked:

### A. Legacy checkout-state bridge

`checkoutStateBridge.js` still contains comments and logic from the previous database-cart architecture. Its cart hydration call is now only a local normalization compatibility function, while the bridge still queries old order state to select a checkout order.

For the clean rebuild, checkout order restoration should be explicit and deterministic:

- `checkout.html?items=...` means start from that cart selection;
- `checkout.html?order=...` means open that exact customer-owned order/reservation;
- plain `checkout.html` should start from the current cart, not silently select an unrelated historical pending order.

### B. Failed-payment retry semantics

The current callback clears the remembered checkout order after a failed payment. The intended business rule is that the failed payment attempt remains historical while the active reservation may still be usable for another fresh payment attempt. The UI should preserve a clear `Continue payment`/`Retry payment` path without creating duplicate active reservations.

### C. Browser countdown vs server expiry

The current UI changes to `Expired` when its local timer reaches zero. That is correct as a display response, but the actual release must always come from the backend. The frontend must revalidate the server state before allowing any payment continuation.

### D. Explicit retry must not resurrect an old attempt

Retry flows must create a new payment attempt/reference. If the reservation itself has expired, a new reservation/order flow must be created rather than reviving the expired inventory hold.

### E. Payment callback authentication

The current callback requires an authenticated Supabase session before it calls the verify endpoint. The final implementation must ensure that losing the browser session cannot cause a real successful payment to become invisible or permanently unresolved; the webhook/finalizer remains independently authoritative.

## 19. Implementation gate

**Do not implement the new database schema or Paystack integration until the state transitions above are accepted as the business-logic contract.**

After this contract is locked, the database schema/RPCs and Cloudflare endpoints should be designed directly from it rather than allowing database details to redefine the customer flow.
