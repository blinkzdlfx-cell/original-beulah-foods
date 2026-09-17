# Beulah Foods Database Plan

## Purpose

Build the new Supabase database from the accepted business-logic contract. The new database is empty and must not inherit the TEST project's historical state or defects.

The TEST repository is used as a reference for the proven UI/business concepts, especially catalogue, admin operations, orders, payments, reservations, promo codes, delivery settings, RLS, and the checkout state machine. The new schema is regenerated for the clean architecture.

## Authority model

- Supabase/Postgres is authoritative for catalogue, price, physical stock, reserved stock, delivery settings, promotions, orders, reservations, payments, and final inventory consumption.
- Browser localStorage is authoritative only for the customer's temporary cart selection.
- Cloudflare Worker is the Paystack server boundary.
- Paystack is the external payment provider; its result is trusted only after server-side verification/webhook validation.

## Phase 1 — Core catalogue and store configuration

Tables:

- `categories`
- `products`
- `delivery_settings`
- `promo_codes`
- `admin_users`

Requirements:

- UUID primary keys.
- `products.stock_quantity` is physical stock.
- Reserved inventory is tracked separately through reservations.
- Product price is stored as NGN numeric money value and is never taken from the browser as payment authority.
- Category slug is unique.
- Product sort/active/featured fields support the existing admin and storefront UI.
- Delivery has one authoritative active configuration.
- Promo rules include type, value, minimum order, optional maximum discount, usage limit, active window, and usage count.
- Admin authorization is separate from ordinary Supabase authentication.

## Phase 2 — Orders and checkout records

Tables:

- `orders`
- `order_items`

Order requirements:

- Customer ownership through `auth.users.id`.
- Immutable order-number/reference suitable for customer-facing history.
- Snapshot customer delivery details at checkout.
- Store authoritative subtotal, discount, delivery fee, and total.
- Store promo reference/snapshot where applicable.
- Order status explicitly models `pending_payment`, `paid/confirmed`, and `cancelled` states needed by the contract.
- Order items snapshot product name and unit price so historical orders do not change when catalogue records change.
- Quantity is integer and positive.

## Phase 3 — Reservations and inventory protection

Tables:

- `reservations`
- `reservation_items`

Rules:

- Reservation belongs to one order/customer.
- Reservation window is 15 minutes.
- Active reservations hold inventory separately from physical stock.
- Reservation creation and stock reservation happen atomically.
- Expiry/cancellation releases reserved inventory exactly once.
- A reservation cannot reserve more than currently available physical inventory.
- A reservation cannot be duplicated for the same active checkout attempt.
- Database timestamps use `timestamptz` and UTC semantics.

## Phase 4 — Payments

Tables:

- `payments`

Payment requirements:

- One order can have multiple historical payment attempts.
- Each retry gets a new payment attempt and provider reference.
- Payment amount is stored in NGN; Paystack API amount is NGN x 100.
- Currency is explicitly stored and validated as `NGN`.
- Paystack reference is unique.
- Provider transaction ID is stored when available.
- Payment status distinguishes pending, successful, failed, expired/abandoned, and late/manual-resolution conditions where required.
- Provider metadata is retained safely for audit/debugging without becoming business authority.

## Phase 5 — Database functions and state transitions

Implement privileged, tightly scoped Postgres functions for the operations that must be atomic:

1. `create_pending_order`
   - authenticate customer
   - validate cart/product state
   - validate delivery
   - validate promo
   - calculate authoritative totals
   - create order + items + reservation atomically

2. `cancel_customer_reservation`
   - customer ownership check
   - release reservation inventory exactly once
   - cancel pending order

3. `release_expired_reservations`
   - find expired active reservations
   - release reserved inventory exactly once
   - expire/cancel associated checkout state

4. `finalize_paystack_payment`
   - accept only trusted server-side verification input
   - validate payment reference/order/amount/currency
   - lock relevant rows
   - reject invalid or duplicate finalization
   - handle expired/late payments safely
   - mark successful payment/order
   - complete reservation
   - consume physical stock exactly once

5. Admin RPCs
   - product/category management
   - delivery settings management
   - promo management
   - order status management where allowed

Every `SECURITY DEFINER` function will use an explicit safe `search_path`, explicit schema qualification, and restricted `EXECUTE` grants.

## Phase 6 — RLS and grants

Enable RLS on every exposed application table.

Customer access:

- public storefront can read only active catalogue/configuration data intended for public use;
- authenticated customers can read their own orders, order items, reservations, and payments as appropriate;
- customers cannot directly mutate authoritative checkout/payment/inventory state;
- privileged state transitions occur through approved RPCs/backend boundaries.

Admin access:

- authenticated admin users are checked against `admin_users`;
- admin operations are limited to approved catalogue, delivery, promo, order, and transaction functions/queries.

Server:

- Cloudflare uses the Supabase secret key only on the server side;
- the secret key is never exposed to the browser.

## Phase 7 — Indexes and constraints

Add indexes for:

- product/category lookups and active catalogue ordering;
- order customer/date/status;
- order items by order;
- reservation customer/status/expiry;
- reservation items by reservation/product;
- payments order/reference/status/date;
- promo code lookup and active windows.

Add database constraints for:

- positive quantities;
- non-negative prices/fees/stock;
- valid status transitions where practical;
- unique Paystack references;
- reservation expiry after creation;
- payment/order currency and amount consistency;
- single active delivery configuration;
- promo value validity.

## Phase 8 — Expiry scheduler

Enable `pg_cron` and schedule the authoritative expiry function every 5 minutes, matching the tested TEST architecture while keeping the new implementation independent.

The browser countdown is presentation only; the scheduled database function performs the actual release.

## Phase 9 — Database tests

Before Paystack integration, test:

- catalogue reads;
- admin authorization;
- customer ownership/RLS;
- atomic order + reservation creation;
- insufficient stock rejection;
- reservation expiry and release;
- explicit cancellation and release;
- duplicate cancellation safety;
- payment amount mismatch rejection;
- successful finalization;
- duplicate callback/webhook finalization idempotency;
- failed payment with no physical stock consumption;
- late payment after reservation expiry;
- retry creating a new payment attempt;
- promo validation and usage limits.

Run security advisors after schema/RLS changes and address findings before payment integration.

## Phase order

```text
1. Core schema
2. Constraints + indexes
3. RLS + grants
4. Catalogue/admin RPCs
5. Checkout/order/reservation RPCs
6. Payment/finalization RPC
7. Expiry scheduler
8. Database tests
9. Admin/storefront wiring
10. Cloudflare Paystack boundary
11. End-to-end TEST payment flow
```

No real payment test should begin until the database state machine and finalization tests pass.