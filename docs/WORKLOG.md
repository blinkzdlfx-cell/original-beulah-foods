# Clean Rebuild Worklog

## 2026-09-17 — Payment boundary, Supabase key, and amount consistency pass

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

### Cloudflare Worker implemented and rechecked

Implemented:

- `POST /api/paystack/initialize`
- `POST /api/paystack/verify`
- `POST /api/paystack/webhook`
- customer access-token authentication at the Worker boundary
- server-to-server Supabase requests using the current Supabase `SUPABASE_SECRET_KEY` backend secret
- no use of the deprecated `SUPABASE_SERVICE_ROLE_KEY` in the Worker
- Supabase secret key is sent as `apikey`; it is never incorrectly sent as a non-JWT `Authorization: Bearer` token
- Paystack secret isolation inside Worker secrets
- authoritative amount retrieval from the Supabase order/payment records
- exact NGN-to-kobo conversion using integer arithmetic before Paystack initialization
- exact Paystack kobo-to-NGN conversion before database finalization
- Paystack transaction verification
- webhook HMAC SHA-512 signature verification over the raw request body
- shared Supabase finalization for callback verification and webhook processing
- idempotent successful-payment finalization through the database
- non-200 response when webhook finalization fails, allowing Paystack retry behavior
- no payment mocks

### Amount contract verified

The authoritative contract is:

```text
orders.total    = NGN
payments.amount = NGN
Paystack amount = integer kobo
```

Examples:

```text
₦4,000.00 -> 400000
₦2,500.50 -> 250050
```

The browser never supplies the authoritative amount. The Worker gets the database amount, converts it once to kobo, and sends that integer to Paystack. Paystack verification/webhook amounts are received as kobo and converted once back to a two-decimal NGN value before `private.finalize_paystack_payment` compares the provider amount with both `payments.amount` and `orders.total`.

### Supabase key model correction

Supabase's current documentation is now reflected in the clean rebuild:

- browser: publishable key
- Cloudflare Worker/backend: secret key
- legacy `anon` and `service_role` names are not used for the new clean rebuild boundary

The repository's browser config/client were renamed from `SUPABASE_ANON_KEY` terminology to `SUPABASE_PUBLISHABLE_KEY` terminology. The Cloudflare required secret is now `SUPABASE_SECRET_KEY`.

### Frontend correction applied

The payment callback calls the Cloudflare verification boundary with `POST /api/paystack/verify` rather than treating a callback redirect as proof of payment.

### Webhook/callback verification review

Callback verification:

1. Requires a valid signed-in customer access token.
2. Checks that the Paystack reference belongs to that customer's payment/order.
3. Calls Paystack's server-side verify endpoint.
4. Sends Paystack's provider status, transaction ID, currency and amount to the same database finalizer used by the webhook.

Webhook verification:

1. Reads the raw request body before parsing JSON.
2. Validates `x-paystack-signature` using HMAC SHA-512 and the Paystack secret.
3. Rejects invalid signatures with HTTP 401.
4. Processes `charge.success` through the same finalizer.
5. Returns non-200 when finalization fails so Paystack can retry.

### Admin correction applied

Connected the admin Orders and Transactions pages to the authoritative Supabase tables with authenticated admin checks and pagination. No mock records are displayed. The Orders page uses the database's actual order-to-user relationship and snapshot delivery name rather than assuming a direct orders-to-profile foreign key.

### Provider fee record

As of September 2026, Paystack lists Nigerian local transaction pricing at 1.5% + ₦100, with the ₦100 component waived below ₦2,500 and local transaction fees capped at ₦2,000. Paystack lists international card pricing separately. Integration and maintenance fees are listed as zero.

The application does not currently pass Paystack transaction fees to customers. Customer-facing fee pass-through is a separate business-rule decision and is not being introduced implicitly during this rebuild.

### Still requiring external configuration

These cannot be safely committed to the repository:

1. Set the Paystack **test** secret key in the deployed Cloudflare Worker as `PAYSTACK_SECRET_KEY`.
2. Set the new Supabase secret key in the deployed Cloudflare Worker as `SUPABASE_SECRET_KEY`.
3. Confirm the Paystack Dashboard **test-mode** webhook URL is the deployed storefront origin plus `/api/paystack/webhook`.
4. Verify the deployed Worker routes are serving the new API implementation.

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
