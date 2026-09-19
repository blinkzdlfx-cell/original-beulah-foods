# Production Readiness Phase 1

## Objective

Prepare the Beulah Foods storefront for promotion from the current TEST deployment to the production hostname:

- `https://www.beulahfoods.com/`
- `/shop`
- `/cart`
- `/checkout`
- `/account`
- `/orders`
- `/how-to`

This phase is an audit and release-gate phase. It must not modify the working Beulah AI behavior unnecessarily.

## Production service separation

### Storefront / Worker

Current repository:

`blinkzdlfx-cell/original-beulah-foods`

Current Worker configuration still contains TEST-oriented comments and bindings. The repository must be audited before the production hostname is attached.

### Supabase

Current authoritative clean project:

`wzrqlquspbipvrzidcxe`

Project status at Phase 1 audit: ACTIVE_HEALTHY.

The Worker currently uses:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` as a server-side secret

The browser must use only the publishable Supabase key.

### Paystack

Payment processing must remain server-side through the Worker boundary.

The Worker requires:

`PAYSTACK_SECRET_KEY`

Production promotion must verify that the deployed production secret is the production Paystack secret and that the Paystack Dashboard webhook points to the production origin:

`https://www.beulahfoods.com/api/paystack/webhook`

No payment success may be inferred from a browser redirect alone.

### Resend

Resend is the planned transactional/authentication email provider.

Supabase Auth should use the verified Resend SMTP configuration for:

- signup confirmation
- password reset
- email-change confirmation
- other authentication email flows enabled by the project

This must be verified before production release.

### Brevo

Brevo is intentionally deferred.

It will be used for marketing only after the production storefront, authentication, checkout, payment, webhook, and transactional email paths have passed their release gates.

Brevo is not part of the authentication path.

## Phase 1 audit results

### Repository configuration

Verified on `main`:

- Worker entrypoint: `worker.js`
- Cloudflare Assets binding: `ASSETS`
- D1 binding: `AI_DB`
- Workers AI binding: `AI`
- AI rate limiters are configured
- Worker requires `PAYSTACK_SECRET_KEY`
- Worker requires `SUPABASE_SECRET_KEY`
- Supabase URL is currently configured as `https://wzrqlquspbipvrzidcxe.supabase.co`

The current `wrangler.toml` still describes the D1 database and AI resources as TEST-oriented. These labels/documentation must be reviewed before the production Worker is promoted.

### Database

The current Supabase project reports healthy status.

Applied migrations currently include the clean catalogue, checkout state machine, reservation expiry, RLS/security tightening, Paystack idempotency/status handling, admin authorization, product-image storage, promo validation/redemptions, How To content, and announcements systems.

Production promotion must not assume that a healthy database alone proves the complete customer flow. Behavioral acceptance remains required.

### Payment implementation

The Worker currently contains:

- `POST /api/paystack/initialize`
- `POST /api/paystack/verify`
- `POST /api/paystack/webhook`

The payment boundary uses the authoritative order/payment amount from Supabase and performs server-side Paystack verification and webhook signature verification.

The release gate still requires an actual production-mode configuration review and a final controlled payment test before public launch.

### AI

Beulah AI is currently working and is intentionally excluded from redesign during Phase 1.

The current AI architecture remains:

- Cloudflare Workers AI first
- OpenRouter/Hugging Face fallback when configured
- D1 conversation history
- Supabase as business-data source of truth
- controlled cart/order/reservation tools
- offline handling
- background history loading with a visible loading state

No AI feature change is required for domain promotion.

### Clean URL requirement

The production public URL contract is:

`/` -> homepage

`/shop` -> shop

`/cart` -> cart

`/checkout` -> checkout

`/account` -> account

`/orders` -> orders

`/how-to` -> How To

Existing `.html` assets may remain implementation files, but they should not be the canonical public URLs.

Before implementing the clean URL layer, every hardcoded navigation, redirect, service-worker cache entry, AI navigation target, authentication callback, payment callback, and canonical/SEO URL must be audited.

### Email separation

Target production architecture:

```
Supabase Auth -> Resend -> authentication/transactional email

Beulah Foods marketing -> Brevo -> marketing email
```

Brevo remains deferred until after the core production release gate.

## Phase 1 release checklist

### A. Repository and deployment

- [x] Main repository identified.
- [x] Worker entrypoint verified.
- [x] Required server secrets identified.
- [ ] Cloudflare production Worker/domain routing verified.
- [ ] Production deployment branch/build configuration verified.
- [ ] Production secrets verified without exposing values.
- [ ] TEST-only comments/configuration separated from production configuration.
- [ ] No development/diagnostic routes remain reachable.
- [ ] No mock payment or mock business data remains in production paths.

### B. Supabase

- [x] Production candidate project identified.
- [x] Project health checked.
- [x] Migration history checked.
- [ ] Auth email/SMTP configuration verified.
- [ ] Production redirect/site URL verified.
- [ ] Publishable-key browser configuration verified.
- [ ] Server secret configuration verified.
- [ ] Storage/public-read and admin-write boundaries rechecked.
- [ ] RLS/admin isolation final review completed.

### C. Paystack

- [x] Server-side initialize/verify/webhook boundary identified.
- [x] Webhook signature verification present.
- [x] Payment finalization is database-authoritative.
- [ ] Production secret verified in Cloudflare.
- [ ] Production webhook URL configured.
- [ ] Production callback URL configured.
- [ ] Production-mode payment test completed last.

### D. Resend

- [ ] Sending domain verified.
- [ ] SMTP credentials/configuration verified in Supabase Auth.
- [ ] Sender identity verified.
- [ ] Signup confirmation tested.
- [ ] Password reset tested.
- [ ] Email-change flow tested where enabled.

### E. Storefront URLs

- [ ] Clean route mapping implemented.
- [ ] Canonical URLs updated.
- [ ] Internal links updated.
- [ ] AI navigation targets updated.
- [ ] Authentication redirects updated.
- [ ] Payment callback paths updated.
- [ ] Service-worker shell/cache URLs updated.
- [ ] Legacy `.html` URLs redirect to clean URLs where appropriate.

### F. Production smoke test

- [ ] Homepage
- [ ] Shop/catalogue
- [ ] Product data
- [ ] Cart
- [ ] Account/authentication
- [ ] Orders
- [ ] Checkout
- [ ] Reservation expiry
- [ ] Paystack initialization
- [ ] Paystack callback verification
- [ ] Paystack webhook finalization
- [ ] Payment idempotency
- [ ] Email delivery
- [ ] AI
- [ ] Offline shell
- [ ] Mobile layout

## Phase 1 rule

Do not switch public production traffic until all release-gate items that affect payment, authentication, data integrity, security, and domain routing have been verified.

Do not change Beulah AI behavior as part of the domain promotion unless a production audit identifies a concrete production-blocking issue.

## Next implementation step

The next implementation task is the **clean URL and production routing audit**. Before modifying routes, inspect the current Worker asset routing, all storefront navigation/redirect references, service-worker URLs, AI navigation targets, authentication redirects, and payment callback paths.

After that audit, implement clean URLs as a separate controlled change and verify them before changing the production hostname.


## Phase 1 implementation — clean public URLs

Implemented on `main`.

### Public URL contract

The Worker now serves these canonical storefront paths:

- `/`
- `/shop`
- `/cart`
- `/checkout`
- `/account`
- `/orders`
- `/how-to`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/verification-success`
- `/payment-callback`

The underlying implementation files remain under `/storefront/*.html`.

### Legacy URL handling

Root-level legacy HTML URLs now issue permanent redirects to the clean public paths. Examples:

`/shop.html` -> `/shop`

`/checkout.html` -> `/checkout`

`/account.html` -> `/account`

`/payment-callback.html` -> `/payment-callback`

The query string is preserved by the URL redirect, so checkout/order parameters continue to work.

### Internal navigation

Updated the main storefront/authentication pages so public navigation uses clean URLs instead of `.html` URLs.

Updated AI structured navigation targets to:

- `/shop`
- `/cart`
- `/checkout`
- `/account`
- `/orders`
- `/how-to`

Updated cart checkout navigation and checkout retry navigation to use `/checkout`.

Updated the Worker Paystack callback URL to use `/payment-callback`.

### Offline shell

The service worker shell now caches the clean public paths instead of the old `.html` paths.

The shell cache was bumped from `beulah-shell-v1` to `beulah-shell-v2` so existing browsers discard the previous route cache.

### Verification performed

Source-level verification was performed against the current `main` branch after the changes:

- Worker contains the clean-route mapping.
- Worker contains legacy `.html` redirects.
- Paystack callback uses `/payment-callback`.
- AI navigation targets use clean paths.
- Cart checkout navigation uses `/checkout`.
- Checkout retry navigation uses `/checkout`.
- Service-worker shell uses clean paths and cache version `v2`.
- Updated storefront/authentication HTML files contain clean public navigation links.

A local JavaScript parser check was attempted, but the execution environment could not resolve `raw.githubusercontent.com`, so a fresh local `node --check` against downloaded repository files could not be completed here. The repository source itself was re-read from GitHub after the edits; no source-fetch or API write errors occurred.

### Production status

The clean URL implementation is committed to `main`, but this does **not** mean `www.beulahfoods.com` has been promoted yet.

The following remain separate release gates:

- Cloudflare custom-domain/Worker attachment verification.
- Production secret verification.
- Supabase Auth + Resend verification.
- Paystack production configuration and final controlled payment test.
- Final production smoke test.

Brevo remains deferred to the marketing phase.
