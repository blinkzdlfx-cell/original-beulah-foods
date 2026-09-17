# URL and Secret Contract

This document is the source of truth for URL construction and secret placement during the rebuild.

## Storefront URLs

The deployed storefront has one canonical public origin. All callback and frontend-relative URLs must be derived from that origin rather than hard-coded staging/production paths.

Expected routes:

```text
/
/shop.html
/cart.html
/checkout.html
/payment-callback.html
/login.html
/signup.html
/forgot-password.html
/reset-password.html
/verification-success.html
/orders.html
/order.html
/account.html
```

The exact deployment hostname is configured after the new Cloudflare project is created.

## Cloudflare payment endpoints

```text
POST /api/paystack/initialize
POST /api/paystack/verify
POST /api/paystack/webhook
```

These are Worker endpoints. They are not Supabase browser endpoints.

## Supabase

The new project supplies one canonical URL:

```text
https://wzrqlquspbipvrzidcxe.supabase.co
```

Supabase Edge Functions are not the primary Paystack boundary in this rebuild. Any server-to-server Supabase endpoint used by Cloudflare must be explicitly documented and authenticated.

## Paystack callback

Paystack receives a callback URL pointing to the static storefront payment callback page:

```text
https://<storefront-origin>/payment-callback.html
```

The callback URL contains no secret.

## Secrets

### Browser

Allowed:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Not allowed:

- `PAYSTACK_SECRET_KEY`
- `SUPABASE_SECRET_KEY`
- Cloudflare internal secrets

### Cloudflare Worker secrets

Expected server-only configuration:

- `PAYSTACK_SECRET_KEY` — Paystack TEST Mode secret for the test environment
- `SUPABASE_SECRET_KEY` — Supabase secret key for the new project

`SUPABASE_URL` is non-secret Worker configuration. The Supabase secret key is sent as the `apikey` header for privileged backend requests. It must never be placed in browser code or sent as `Authorization: Bearer <secret-key>` because the new secret key is not a JWT.

Secrets are configured in Cloudflare, not committed to Git.

## URL construction rules

1. Use the deployed storefront origin for Paystack callback URLs.
2. Use explicit `/api/paystack/...` Worker routes for payment operations.
3. Do not construct callback URLs from `/storefront/` unless the deployed site actually uses that path as canonical.
4. Do not expose secrets through query parameters, HTML, JavaScript, CSS, localStorage, or public environment files.
5. Keep test and production hostnames/configuration separate.
