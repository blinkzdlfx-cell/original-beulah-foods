# Implementation Plan

## Phase 0 — documented foundation

- [x] Create clean repository.
- [x] Record architecture and source audit.
- [x] Record URL/secret contract.
- [x] Record localStorage-first cart contract.
- [x] Define frontend import scope.

## Phase 1 — frontend foundation

- [x] Import customer storefront HTML/CSS/vanilla JavaScript and required static assets.
- [x] Remove old deployment-specific canonical URLs and provider configuration.
- [x] Make frontend page/asset URLs relative to the canonical deployed origin.
- [x] Rebuild cart manager around localStorage-first state and change-driven updates.
- [x] Add Cloudflare static Worker configuration without payment mocks.
- [x] Review checkout/payment page modules against the new Cloudflare boundary.
- [x] Remove direct customer-side Paystack integration; checkout now calls the Worker boundary.
- [x] Rename browser Supabase credential terminology from legacy `anon` to `publishable`.

## Phase 2 — new Supabase

- [x] Create new Supabase project.
- [x] Apply clean migrations for auth/profile, catalogue, orders, order items, reservations, payments, promotions, and delivery settings.
- [x] Implement trusted pending-order creation.
- [x] Implement reservation expiry/release scheduler.
- [x] Implement idempotent payment finalization.
- [x] Verify RLS and privileged function grants.
- [x] Make payment-attempt creation idempotent for repeated initialization requests.
- [x] Preserve Paystack pending/ongoing/processing statuses instead of converting them prematurely to failed.
- [ ] Mirror the complete clean database migration history into the repository so GitHub can reproduce the current Supabase schema from scratch.

## Phase 3 — Cloudflare payment boundary

- [x] Establish static storefront Worker configuration.
- [x] Add `/api/paystack/initialize`.
- [x] Add `/api/paystack/verify`.
- [x] Add `/api/paystack/webhook`.
- [x] Replace legacy Supabase service-role secret usage with the current `SUPABASE_SECRET_KEY` backend secret model.
- [x] Authenticate customer requests at the Worker boundary with Supabase Auth.
- [x] Authenticate Worker-to-Supabase privileged requests with the Supabase secret key via `apikey`; never send the non-JWT secret as `Authorization: Bearer`.
- [x] Keep payment finalization authoritative in Supabase.
- [x] Validate Paystack webhook HMAC SHA-512 signatures over the raw request body before processing.
- [x] Convert authoritative NGN amounts to integer kobo exactly before Paystack initialization.
- [x] Convert Paystack integer kobo amounts back to exact two-decimal NGN before database finalization.
- [x] Keep callback verification and webhook finalization on the same idempotent DB finalizer.

## Phase 4 — integration

- [x] Connect the application to the new Supabase project.
- [x] Connect the Worker code to the repository and static assets.
- [x] Configure the callback route in the Worker implementation as `<request-origin>/payment-callback.html`.
- [ ] Configure the Paystack dashboard webhook URL to `https://<storefront-origin>/api/paystack/webhook`.
- [ ] Configure `PAYSTACK_SECRET_KEY` in the deployed Cloudflare Worker using the Paystack TEST key.
- [ ] Configure `SUPABASE_SECRET_KEY` in the deployed Cloudflare Worker using the new Supabase secret key.
- [ ] Verify deployed Worker routes from the public storefront origin.
- [ ] Verify every external URL and secret location before live money movement.

## Phase 5 — admin foundation

- [x] Admin authentication and `is_admin()` authorization.
- [x] Catalogue/category management.
- [x] Delivery settings management.
- [x] Promo-code management.
- [x] Admin orders page connected to Supabase.
- [x] Admin transactions page connected to Supabase.
- [ ] Provision and verify a real admin account.
- [ ] Run admin read/write acceptance tests.

## Phase 6 — acceptance testing

- [ ] Auth signup/login/session.
- [ ] Cart persistence across page loads and reloads.
- [ ] Catalogue/stock reconciliation.
- [ ] Reservation creation and expiry.
- [ ] Paystack initialization.
- [ ] Paystack callback verification.
- [ ] Paystack webhook finalization.
- [ ] Callback/webhook idempotency.
- [ ] Failed payment and cancellation.
- [ ] Late payment handling.
- [ ] Stock/reservation/order/payment invariants.
- [ ] Full customer checkout test with a Paystack test transaction.
- [ ] Full admin acceptance test.
- [ ] Easter test.

## Phase 7 — release gate

- [ ] Mirror/verify the complete database migration source of truth.
- [ ] Configure and verify all external Worker/Paystack secrets and URLs.
- [ ] All automated/static checks pass.
- [ ] All external integrations pass in the test environment.
- [ ] No unresolved database/repository contract inconsistencies remain.
- [ ] No production resources are changed until the release gate is explicitly approved.

No production resources are part of this rebuild until the complete test environment passes.
