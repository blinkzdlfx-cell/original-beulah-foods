# Implementation Plan

## Phase 0 — documented foundation

- [x] Create clean repository.
- [x] Record architecture and source audit.
- [x] Record URL/secret contract.
- [x] Record localStorage-first cart contract.
- [x] Define frontend import scope.

## Phase 1 — frontend foundation

- [ ] Import customer storefront HTML/CSS/vanilla JavaScript and required static assets.
- [ ] Remove old deployment-specific canonical URLs and provider configuration.
- [ ] Make all frontend URLs relative to the canonical deployed origin.
- [ ] Rebuild cart manager around localStorage-first state and authoritative catalogue reconciliation.
- [ ] Preserve customer-facing visual design while removing old backend/payment coupling.

## Phase 2 — new Supabase

- [ ] Create new Supabase project.
- [ ] Apply clean migrations for auth/profile, catalogue, orders, order items, reservations, payments, promotions, and delivery settings.
- [ ] Implement trusted pending-order creation.
- [ ] Implement reservation expiry/release scheduler.
- [ ] Implement idempotent payment finalization.
- [ ] Verify RLS and function grants.

## Phase 3 — Cloudflare payment boundary

- [ ] Create static storefront Worker configuration.
- [ ] Add `/api/paystack/initialize`.
- [ ] Add `/api/paystack/verify`.
- [ ] Add `/api/paystack/webhook`.
- [ ] Store Paystack secret only in Cloudflare Worker secrets.
- [ ] Authenticate Cloudflare-to-Supabase server requests.
- [ ] Keep payment finalization authoritative in Supabase.

## Phase 4 — integration

- [ ] Connect new Supabase project to the application.
- [ ] Connect Cloudflare project to this GitHub repository.
- [ ] Configure Paystack callback URL.
- [ ] Configure Paystack webhook URL.
- [ ] Verify every URL and secret location before testing money movement.

## Phase 5 — acceptance testing

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

No production resources are part of this rebuild until the complete test environment passes.
