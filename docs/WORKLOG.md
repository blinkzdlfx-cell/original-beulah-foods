# Clean Rebuild Worklog

## 2026-09-17 — Payment boundary and consistency pass

### Repository verified

Repository: `blinkzdlfx-cell/original-beulah-foods`

The clean rebuild repository contains the documented architecture, business logic contract, database plan, cart contract, Paystack contract, URL/secret contract, storefront, Worker, and admin foundation.

### Database verified

Supabase project: `wzrqlquspbipvrzidcxe`

Verified:

- 11 public application tables.
- No test customer/order/payment/reservation data in the clean database at the time of review.
- Trusted pending-order creation function exists.
- Paystack payment-attempt creation function exists.
- Paystack payment finalization function exists.
- Reservation expiration/release function exists.
- `pg_cron` reservation cleanup job is active at five-minute intervals, with recent runs succeeding.
- RLS policies protect customer-owned orders, order items, payments and profiles.
- Admin policies use `private.is_admin()`.

### Database corrections applied

1. `private.create_paystack_payment_attempt(uuid)` was changed to reuse an existing pending payment attempt for the same order. This prevents repeated initialization requests from creating multiple pending payment records for one order.
2. `private.finalize_paystack_payment(...)` was hardened so Paystack `pending`, `ongoing`, and `processing` statuses remain `pending` instead of being incorrectly converted to `failed`. `abandoned` remains `abandoned`; other non-success terminal states become `failed`.

### Cloudflare Worker implemented

Implemented:

- `POST /api/paystack/initialize`
- `POST /api/paystack/verify`
- `POST /api/paystack/webhook`
- customer access-token authentication at the Worker boundary
- server-to-server Supabase requests using the Worker service-role secret
- Paystack secret isolation inside Worker secrets
- authoritative amount retrieval from the Supabase order/payment records
- NGN-to-kobo conversion before Paystack initialization
- Paystack transaction verification
- webhook HMAC SHA-512 signature verification
- shared Supabase finalization for callback verification and webhook processing
- idempotent successful-payment finalization through the database
- non-200 response when webhook finalization fails, allowing Paystack retry behavior
- no payment mocks

### Frontend correction applied

The payment callback now calls the Cloudflare verification boundary with `POST /api/paystack/verify` rather than treating a callback redirect as proof of payment.

### Admin correction applied

Connected the admin Orders and Transactions pages to the authoritative Supabase tables with authenticated admin checks and pagination. No mock records are displayed. The Orders page uses the database's actual order-to-user relationship and snapshot delivery name rather than assuming a direct orders-to-profile foreign key.

### Configuration correction applied

`wrangler.toml` now declares these required Worker secrets:

- `PAYSTACK_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

A repository `.gitignore` now protects `.env*`, `.dev.vars*`, and Wrangler local state while retaining `.env.example`.

The secrets are intentionally not stored in Git. Because this rebuild is still test-only, `PAYSTACK_SECRET_KEY` must be the Paystack **test-mode** secret (`sk_test_...`), not a live key. Paystack maintains separate test and live keys/environments.

### Provider fee record

As of September 2026, Paystack lists Nigerian local transaction pricing at 1.5% + ₦100, with the ₦100 component waived below ₦2,500 and local transaction fees capped at ₦2,000. Paystack lists international card pricing separately. Integration and maintenance fees are listed as zero.

The application does not currently pass Paystack transaction fees to customers. Customer-facing fee pass-through is a separate business-rule decision and is not being introduced implicitly during this rebuild.

### Still requiring external configuration

These cannot be safely committed to the repository:

1. Set the Paystack **test** secret key in the deployed Cloudflare Worker as `PAYSTACK_SECRET_KEY`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in the deployed Cloudflare Worker.
3. Set the Paystack Dashboard **test-mode** webhook URL to the deployed storefront origin plus `/api/paystack/webhook`.
4. Verify the deployed Worker route is serving the new API implementation.

### Still requiring behavioral acceptance tests

- real customer signup/login/session
- real catalogue data and stock reconciliation
- real cart persistence/reconciliation
- pending order + 15-minute reservation
- Paystack test-mode initialization
- Paystack test payment
- callback verification
- webhook finalization
- callback/webhook race/idempotency
- failed/abandoned/pending payment handling
- late-payment handling
- admin authentication and data reads/writes
- final stock/order/reservation/payment invariants
- Easter test

Production resources remain out of scope until the complete test environment passes the release gate.
