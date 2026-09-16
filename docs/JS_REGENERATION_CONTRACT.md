# Storefront JavaScript Regeneration Contract

This branch rebuilds the customer storefront JavaScript against the clean-rebuild contracts.

## Source of truth

- `test-beulah-foods` is the UI/DOM reference only.
- The new Supabase project is the backend authority.
- Cloudflare is the Paystack server boundary.
- Browser storage is not an order, payment, price, or inventory authority.

## Cart

The browser stores only:

```json
[{"productId":"<uuid>","quantity":2}]
```

Product names, prices, stock, delivery fees, promotions, order totals, and payment state are never authoritative in localStorage.

The cart page reads localStorage once, fetches current product data once, reconciles the visible state, and reacts to explicit cart events. It does not poll or recursively refresh.

## Checkout

The regenerated checkout flow is:

1. Require an authenticated customer.
2. Read the current cart and explicit checkout selection.
3. Fetch current product/profile/display delivery context.
4. Send product IDs, quantities, and optional promo code to the Supabase checkout RPC.
5. The RPC must atomically validate stock/pricing/promo/delivery, create the order, create the 15-minute reservation, and return the authoritative order/reservation identifiers and expiry.
6. Send the order ID to Cloudflare `/api/paystack/initialize`.
7. Redirect to Paystack.

The browser does not auto-restore an old pending order and does not synchronize a database cart.

## Payment callback

`payment-callback.js` sends the Paystack reference to Cloudflare `/api/paystack/verify`.

Only a trusted successful verification permits the browser to remove the selected cart items and navigate to the order.

A pending, failed, unknown, or unavailable verification is never converted into success by the browser.

## Reservation expiry

The countdown is display-only. At zero, the browser may request the server expiry transition, but the backend remains authoritative.

## Backend contracts still required

The frontend currently expects these Supabase RPC boundaries:

- `create_pending_checkout(p_items, p_promo_code)`
- `cancel_customer_reservation(p_order_id)`
- `expire_customer_reservation(p_order_id)`

These are contracts for the next Supabase schema phase. No mock implementation is included in this branch.

## Payment Worker contracts

The frontend expects:

- `POST /api/paystack/initialize`
- `POST /api/paystack/verify`
- `POST /api/paystack/webhook` (server-to-server only)

The browser never receives or stores `PAYSTACK_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
