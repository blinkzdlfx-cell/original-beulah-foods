# Checkout and Payment Sequencing Contract

## Purpose

This document is the release-gate contract for the customer checkout flow. It prevents payment from starting before stock has been successfully reserved and prevents payment initialization from happening unless the customer explicitly chooses to continue to payment.

## Required customer flow

```text
Shop
  -> Add to cart
  -> Cart
  -> Checkout / Review Order
  -> Confirm order & reserve items
  -> Reservation created successfully
  -> Continue to payment
  -> Paystack checkout
  -> Callback verification and/or webhook
  -> Supabase payment finalization
```

## Hard sequencing rules

1. Adding an item to cart does not create an order, reservation, payment, or Paystack transaction.
2. Opening the cart does not create an order, reservation, payment, or Paystack transaction.
3. Opening checkout/review order does not create an order, reservation, payment, or Paystack transaction.
4. The first checkout submission creates the pending order and reserves stock through the authoritative Supabase transaction.
5. Payment initialization must not run until the reservation exists and remains active.
6. The customer must explicitly click the payment action (`Continue to payment`) after reservation. There is no automatic payment initialization immediately after reservation creation.
7. Paystack initialization is performed by Cloudflare using the authoritative database amount. The browser never supplies the payment amount.
8. If reservation creation fails, Paystack must never be called.
9. If the reservation expires before payment initialization, Paystack must not be initialized.
10. If the customer cancels the reservation, Paystack must not be initialized for that cancelled order.
11. If Paystack initialization fails after a valid reservation exists, the reservation remains governed by its normal expiry/cancellation rules; the customer may retry payment while the reservation is still valid.
12. A callback URL visit is not proof of payment. Cloudflare verifies with Paystack, and webhook processing is independently verified.
13. Successful payment finalization is performed by the same idempotent Supabase finalizer for callback verification and webhook processing.
14. Stock is decremented and the reservation is completed only by successful payment finalization; duplicate callback/webhook delivery must not duplicate these effects.
15. A successful provider transaction received after the reservation has expired must not silently recreate the reservation or restore a cancelled order to payable state. It is handled as a late-payment/manual-resolution case according to the database contract.

## Current implementation evidence

The checkout page initially renders the `Confirm order & reserve items` action. On its first submission it calls the Supabase `create_pending_order` RPC, receives the order/reservation result, shows the reservation countdown, and changes the action to `Continue to payment`. Only a later explicit submission calls `/api/paystack/initialize`. fileciteturn184file0L2-L2

The Cloudflare initialize route calls the database `create_paystack_payment_attempt` operation only after receiving an order ID, then initializes Paystack using the authoritative payment amount returned by the database. fileciteturn180file0L2-L2

The checkout HTML also explicitly describes the review stage as occurring before reservation/payment and labels the first action `Confirm order & reserve items`. fileciteturn181file0L2-L2

## Verification requirement

A manual acceptance test must prove the sequence from the browser and database, not only from UI appearance. During testing record:

- cart state before checkout
- order ID/order number after reservation
- reservation ID and expiry
- payment row count/status before clicking `Continue to payment`
- Paystack reference only after payment initialization
- final payment/order/reservation/stock states after payment

The key negative test is: **reserve successfully, then stop without clicking `Continue to payment`; no Paystack transaction should be initialized.**

The second key negative test is: **attempt checkout with insufficient stock; no Paystack transaction should be initialized.**

## Source-of-truth boundaries

- Cart intent: browser localStorage.
- Product price/availability: Supabase catalogue.
- Order total: Supabase pending-order transaction.
- Reservation and stock hold: Supabase transaction/state machine.
- Paystack secret operations: Cloudflare Worker.
- Paystack provider status/amount: Paystack server response/webhook.
- Final payment/order/stock state: Supabase finalizer.
