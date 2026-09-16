# Source Audit — Previous Beulah Foods Repository

Source repository audited:

`blinkzdlfx-cell/Beulah-foods`

The previous repository contains a customer storefront, admin dashboard, Supabase migrations, tests, Cloudflare Worker code, and historical payment/reservation changes.

## Reusable customer frontend

The existing storefront is plain HTML/CSS/vanilla JavaScript with ES modules. The reusable customer-facing surface includes:

- storefront HTML pages for home, shop, product, cart, checkout, authentication, account, orders, reservations, and payment callback
- storefront CSS files
- storefront JavaScript components, page modules, services, and validation utilities
- static brand assets where needed by the visual design

## Backend code not copied as authority

The old Supabase migrations and payment Worker implementation contain accumulated historical changes and fixes. They are reference material for behavior and lessons learned, not a database schema to copy blindly.

The rebuild will define a new migration sequence and a new payment boundary.

## Relevant previous lessons

1. Browser payment success must not be treated as proof of payment.
2. Paystack secret credentials must remain server-side.
3. Order totals and stock must be authoritative on the server.
4. Reservation expiry requires an actual scheduler or equivalent execution mechanism.
5. Callback and webhook processing must be idempotent.
6. URL construction must use one canonical storefront origin; accidental `/storefront/` versus root routing must not occur.
7. Cart persistence must not create a second source of truth for product prices or stock.
8. Generic frontend payment errors can hide the actual provider/server failure; server and browser logs must preserve actionable diagnostics.

## Previous storefront structure observed

The old repository uses a `storefront/` directory with HTML pages, `css/`, `js/`, and `assets/`. The application is not a framework SPA.

The old repository also contains admin and Supabase directories, but those are deliberately excluded from the initial frontend-only copy into the new repository.
