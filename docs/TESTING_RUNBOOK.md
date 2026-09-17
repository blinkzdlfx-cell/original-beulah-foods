# Controlled Checkout and Payment Test Runbook

## Scope

TEST environment only. Do not use production Supabase, production Paystack keys, production Worker routes, or the production repository during this run.

Repository: `blinkzdlfx-cell/original-beulah-foods`
Supabase project: `original-beulah-foods`
Supabase ref: `wzrqlquspbipvrzidcxe`

## Evidence rule

Every test result should be recorded as PASS, FAIL, or BLOCKED with the date/time, relevant order/payment/reservation IDs, and a short observation. Do not repair database rows manually just to make a test pass. If a test fails, record the failure and investigate the root cause first.

## Test sequence

### T01 — Shop and cart only

1. Open Shop.
2. Add one real product to cart.
3. Open Cart.
4. Reload the page.

Expected:
- Product and quantity persist.
- No order is created.
- No reservation is created.
- No payment is created.
- No Paystack checkout is opened.

### T02 — Review checkout without reservation

1. From Cart, continue to Checkout / Review Order.
2. Review delivery details, items, and total.
3. Do not click the confirmation button.

Expected:
- Checkout shows `Confirm order & reserve items`.
- No order/reservation/payment is created merely by opening the page.
- No Paystack request is made.

### T03 — Reservation gate

1. Click `Confirm order & reserve items` once.
2. Wait for the reservation result.
3. Stop. Do not click `Continue to payment`.

Expected:
- A pending-payment order is created.
- A reservation is created and active.
- Reserved stock increases by the reserved quantity.
- A reservation countdown is displayed.
- The action changes to `Continue to payment`.
- **No Paystack transaction is initialized.**
- The payment record must not have a provider reference created by Paystack initialization merely because the reservation was created.

This is the primary negative test for the requested payment gate.

### T04 — Explicit payment gate

Starting from the valid active reservation from T03:

1. Click `Continue to payment`.
2. Confirm that the browser reaches the Paystack checkout URL.

Expected:
- Only this explicit action starts Paystack initialization.
- Cloudflare authenticates the customer and validates the order/reservation through Supabase.
- The amount sent to Paystack is the authoritative order/payment amount converted to integer kobo.
- Browser code does not provide the payment amount.

Paystack's current documentation requires backend initialization and server-side verification, and states that callback visitation alone is not proof of successful payment. The amount must also be verified before value is delivered. 

### T05 — Successful TEST payment

Use the Paystack TEST environment only.

1. Complete payment with Paystack's current TEST payment method.
2. Return through the callback page.
3. Allow webhook delivery.
4. Check the database.

Expected final state:
- Payment is successful exactly once.
- Order is paid/confirmed according to the database state machine.
- Reservation is confirmed/completed.
- Reserved stock is released/decremented exactly once according to the finalizer rules.
- No duplicate order/payment/stock effects occur.

### T06 — Callback/webhook race and idempotency

For the same successful transaction, verify that callback verification followed by webhook delivery, or webhook delivery followed by callback verification, does not duplicate fulfillment.

Expected:
- Both paths converge on the same database finalizer.
- Repeated finalization is idempotent.
- Stock and reservation effects happen once.

### T07 — Failed/abandoned payment

Create a new valid reservation and start Paystack only after the explicit payment click. Abandon or fail the TEST transaction.

Expected:
- No successful fulfillment.
- Payment remains/ends in the correct provider state.
- Reservation remains active until cancellation/expiry according to policy, then releases correctly.
- Order does not become paid.

### T08 — Expired reservation before payment

Create a reservation, do not click `Continue to payment`, and allow/accelerate it to expiry using the approved TEST procedure.

Expected:
- Reservation becomes expired.
- Pending order becomes cancelled/expired according to the state machine.
- Reserved stock is released.
- Attempting to continue to payment after expiry does not initialize Paystack.

### T09 — Insufficient stock gate

Use a quantity greater than currently available stock.

Expected:
- Pending order/reservation creation fails atomically.
- No stock is reserved.
- No Paystack transaction is initialized.
- Cart remains available for correction.

### T10 — Cancellation gate

Create a valid reservation, then click `Cancel reservation` before payment.

Expected:
- Reservation is cancelled/released.
- Pending order is cancelled.
- Paystack is not initialized.
- Repeated cancellation does not double-release stock.

### T11 — Amount contract

For a known order total, record:

```text
orders.total          = NGN
payments.amount       = NGN
Paystack data.amount  = integer kobo
```

Expected:
- NGN 4,000.00 becomes exactly 400000 kobo.
- The finalizer rejects provider amount mismatches.
- No browser-supplied amount can override the authoritative database amount.

### T12 — Webhook security

Send an invalidly signed webhook request to the Worker TEST endpoint.

Expected:
- Request is rejected.
- No payment/order/stock state changes.

Paystack documents HMAC SHA-512 signature validation using the secret key and recommends validating the signature before processing the event.

### T13 — Webhook retry behavior

Cause a controlled finalization failure in TEST only, if a safe mechanism exists, and verify the Worker returns non-200 so Paystack can retry.

Do not introduce production-like failure data solely for this test if it would contaminate the clean test environment.

### T14 — Late payment

Use the approved TEST procedure to allow a reservation to expire before a successful provider transaction is finalized.

Expected:
- The transaction is not allowed to silently resurrect the expired reservation/order.
- The payment is recorded as a late-payment/manual-resolution case according to the DB contract.

### T15 — Full customer journey

Run the exact journey without shortcuts:

```text
Shop
-> Add to cart
-> Cart
-> Checkout
-> Review order
-> Confirm order & reserve items
-> Verify reservation
-> Stop and verify no payment started
-> Click Continue to payment
-> Paystack TEST checkout
-> Callback
-> Webhook
-> Final DB state
```

Record all IDs and final invariants.

## Database invariants to check after each relevant test

- No active reservation has `expires_at <= now()`.
- Expired/cancelled reservations do not contribute to reserved stock.
- Product `reserved_quantity` equals the quantity represented by valid active reservations.
- Paid orders have successful payment state according to the state machine.
- Cancelled/expired orders are not payable.
- Provider amount equals authoritative payment/order amount before fulfillment.
- Duplicate webhook/callback delivery does not duplicate fulfillment.
- Historical test evidence is not silently rewritten.

## Current implementation verification before manual testing

The repository currently defines separate checkout and payment stages: the first checkout submission creates the pending order/reservation, while a later explicit submission calls the Cloudflare Paystack initialize route. The Cloudflare Worker then obtains the authoritative payment amount from Supabase before initializing Paystack.

The Worker configuration currently declares `PAYSTACK_SECRET_KEY` and `SUPABASE_SECRET_KEY` as required secrets. The user has reported that both TEST secrets have been added in Cloudflare; public deployment/secret visibility still needs to be verified through an actual deployed request because repository inspection cannot prove Cloudflare runtime configuration.

## Release evidence

Update `docs/WORKLOG.md` after every test batch. Do not mark Phase 6 or the release gate complete until the actual TEST environment results are recorded.
