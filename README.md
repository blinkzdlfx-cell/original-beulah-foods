# Beulah Foods — E-commerce Website

Beulah Foods is an e-commerce website for browsing food products, managing a shopping cart, placing orders, reserving stock, and paying online. It includes a customer storefront, an administrator dashboard, and a Cloudflare Worker that connects the site to Supabase, Paystack, email services, and the Beulah AI assistant.

**Repository:** [blinkzdlfx-cell/original-beulah-foods](https://github.com/blinkzdlfx-cell/original-beulah-foods)  
**Website:** [https://beulahfoods.com](https://beulahfoods.com)  
**Business tagline:** *Eat Healthy, Live Healthy.*

> **Important status note:** This repository contains substantial application code and integrations, but a feature being present in code does not by itself prove that the live production configuration and end-to-end workflow have passed acceptance testing. See [Production and release checks](#production-and-release-checks).

## Contents

- [Features](#features)
- [Technology and architecture](#technology-and-architecture)
- [Repository structure](#repository-structure)
- [Customer storefront](#customer-storefront)
- [Admin dashboard](#admin-dashboard)
- [Beulah AI assistant](#beulah-ai-assistant)
- [Orders, reservations, and payments](#orders-reservations-and-payments)
- [Services and configuration](#services-and-configuration)
- [Run locally](#run-locally)
- [Deploy to Cloudflare](#deploy-to-cloudflare)
- [Database setup and migrations](#database-setup-and-migrations)
- [Tests](#tests)
- [Security guidance](#security-guidance)
- [Production and release checks](#production-and-release-checks)
- [Additional documentation](#additional-documentation)

## Features

### Customer-facing website

- Responsive storefront and product catalogue.
- Product categories, product details, featured products, and stock-aware catalogue data.
- Shopping cart with quantity controls and browser persistence.
- Customer registration, login, email verification, password recovery, and account pages through Supabase Auth.
- Checkout review, order creation, and inventory reservation.
- Customer order history and order details.
- Reservation status, cancellation, expiry handling, and a reservation countdown where applicable.
- Paystack checkout initialization, payment verification, and webhook processing through the server-side Worker.
- Customer-facing How To content and ordering guidance.
- Product and order-related transactional email code.
- Store announcements and offline/service-worker handling.
- Privacy Policy and Terms of Service pages.

### Administrator dashboard

The dashboard is available at /admin/ and provides tools for authorized staff to manage:

- Products, categories, product images, stock, and featured-product settings.
- Delivery configuration and fees.
- Promotional codes and their conditions.
- Orders and fulfilment status.
- Payment transactions and payment references.
- Product preparation guides and customer ordering instructions.
- Approved knowledge used by Beulah AI.
- Store announcements and their display rules.

The detailed operating procedures are in [docs/ADMIN_DASHBOARD_OPERATIONS_GUIDE.md](docs/ADMIN_DASHBOARD_OPERATIONS_GUIDE.md).

### Beulah AI

The website includes an AI assistant that can use approved business information and selected application tools to help customers with product discovery, How To content, store policies, cart actions, and customer-specific order information.

- Cloudflare Workers AI is the configured primary provider.
- OpenRouter and Hugging Face are optional fallbacks when valid credentials and compatible models are configured.
- Supabase remains the source of truth for catalogue and business data.
- Cloudflare D1 stores conversational history; inactive conversations are scheduled for deletion after seven days.
- Chat and mutation rate-limit bindings are configured in Wrangler.
- Mutations use a restricted tool contract and confirmation flow.
- The assistant is not allowed to initialize Paystack or declare a payment successful.

See [docs/AI_SETUP.md](docs/AI_SETUP.md), [docs/AI_SECURITY.md](docs/AI_SECURITY.md), and [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md).

## Technology and architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Customer interface | HTML, CSS, browser JavaScript | Storefront pages and customer interactions |
| Admin interface | HTML, CSS, browser JavaScript | Store management and operations |
| Server/API boundary | Cloudflare Workers, entry point worker.js | API routing, trusted operations, payment integration, AI orchestration, and clean public URLs |
| Static hosting | Cloudflare Workers Static Assets | Serves storefront, admin, images, CSS, JavaScript, and other static files |
| Business database | Supabase / PostgreSQL | Catalogue, accounts, orders, reservations, payments, promos, How To content, announcements, and AI knowledge |
| Authentication | Supabase Auth | Customer sign-up, sign-in, and account recovery |
| AI inference | Cloudflare Workers AI | Primary AI model provider |
| Optional AI providers | OpenRouter, Hugging Face | Configurable fallback providers |
| AI history | Cloudflare D1 | Conversation persistence and retention cleanup |
| Payment provider | Paystack | Transaction initialization and provider-side verification |
| Email | Resend integration | Application transactional email; Supabase Auth email delivery requires SMTP setup to be verified separately |

**Source of truth:** Supabase holds the business records. D1 is used for AI conversation history, not as a replacement for the e-commerce database.

**Request flow:** The browser calls Supabase using the public publishable key for permitted client operations. Privileged operations and Paystack secret-key calls run through the Cloudflare Worker. Secret keys must never be included in browser JavaScript.

## Repository structure

~~~text
.
├── admin/                  # Administrator pages, styles, and scripts
├── storefront/             # Customer-facing pages, styles, scripts, and images
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── *.html
├── worker.js               # Cloudflare Worker entry point and API routing
├── worker/
│   └── emailService.js     # Transactional email helpers
├── wrangler.toml           # Worker, assets, bindings, routes, and cron configuration
├── supabase/
│   └── migrations/         # Migration files currently mirrored in this repository
├── d1/
│   └── migrations/         # Cloudflare D1 AI-history schema migrations
├── tests/                  # Automated tests
├── docs/                   # Technical contracts, setup guides, and operations documentation
├── sw.js                   # Service worker
├── offline.html             # Offline fallback page
├── 404.html                 # Not-found page
└── .env.example             # Configuration reference; not a substitute for Worker secrets
~~~

The public site uses clean URLs such as /shop, /cart, /checkout, and /account, while the underlying HTML files are stored in the storefront directory.

## Customer storefront

Common routes include:

| URL | Purpose |
|---|---|
| / | Homepage |
| /shop | Product catalogue |
| /product | Product detail route/page |
| /cart | Shopping cart |
| /checkout | Review order and start the reservation workflow |
| /account | Customer account |
| /orders | Customer order history |
| /order | Order details |
| /reservations | Reservation status and actions |
| /how-to | Product and ordering guidance |
| /login and /signup | Authentication |
| /forgot-password and /reset-password | Password recovery |
| /callback | Payment callback handling |
| /privacy-policy and /terms-of-service | Legal information |

Some routes use query parameters to identify a product or order. Check the relevant page script before changing URL handling.

## Admin dashboard

Open /admin/ on the deployed website, then sign in with an administrator account provisioned through the intended authentication setup.

Operational guidance:

1. Make changes only in the relevant dashboard section.
2. Save the change and confirm the dashboard reports success.
3. Re-check the saved value in the table or form.
4. Check the customer-facing website if the change affects customers.
5. Do not manually mark a payment as successful. Use the Transactions and Orders pages to investigate status; payment status must be established by the trusted verification flow.

The admin pages use the same public Supabase project URL and publishable key as the storefront. Authorization must be enforced by Supabase policies and trusted server-side functions—not by hiding dashboard links.

## Beulah AI assistant

The Worker exposes these AI-related endpoints:

- GET /api/ai/history — retrieve the current conversation history.
- DELETE /api/ai/history — clear the current conversation.
- POST /api/ai/chat — send a message to the assistant.
- POST /api/ai/confirm — confirm a supported assistant action.

The Worker also includes scheduled cleanup for inactive AI conversations. The schedule is configured in wrangler.toml.

Do not put private prompts, secrets, service-role credentials, payment credentials, or sensitive customer data into the AI knowledge base. Add only approved and verified business information.

## Orders, reservations, and payments

The intended checkout flow separates order reservation from payment:

1. The customer reviews the cart and checkout details.
2. The customer explicitly confirms the order and reserves available stock.
3. The system creates a pending-payment order and an active reservation when the request is valid.
4. The customer must explicitly choose **Continue to payment** to initialize Paystack.
5. The Worker verifies the transaction with Paystack and processes provider webhooks.
6. Database finalization controls the resulting payment/order/reservation state.

The relevant Worker endpoints are:

- POST /api/paystack/initialize
- GET or POST /api/paystack/verify
- POST /api/paystack/webhook
- POST /api/admin/orders/status

The server derives the payable amount from trusted database records; it must not trust a price supplied by browser code. Callback-page visits alone are not proof of successful payment.

**Payment and email integrations still require live end-to-end verification.** Repository inspection confirms implementation code, not that the currently deployed Paystack account, webhook, email provider, and secrets are correctly configured.

## Services and configuration

### Cloudflare Worker configuration

Deployment configuration is in [wrangler.toml](wrangler.toml). It defines:

- Worker name and entry point (worker.js).
- Static asset directory and ASSETS binding.
- Workers AI binding (AI).
- D1 binding (AI_DB) and database identifier.
- AI chat and mutation rate-limit bindings.
- Scheduled daily AI-history cleanup.
- Custom domain routes for beulahfoods.com and www.beulahfoods.com.
- Required server-side secret names.

### Required Worker secrets

Configure secret values in the correct Cloudflare environment. Do not commit them to Git.

| Secret | Purpose |
|---|---|
| SUPABASE_SECRET_KEY | Server-side privileged Supabase access |
| PAYSTACK_SECRET_KEY | Server-side Paystack API operations |
| RESEND_API_KEY | Resend API email integration |

Optional AI fallback secrets:

- OPENROUTER_API_KEY
- HUGGINGFACE_API_KEY

Set secrets interactively from the repository root with Wrangler:

~~~bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put PAYSTACK_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
~~~

Only configure optional AI-provider secrets if those providers are being enabled. Never paste actual secret values into README files, issues, source files, or public logs.

### Public Supabase configuration

The storefront's browser-safe Supabase URL and publishable key are currently defined in [storefront/js/config.js](storefront/js/config.js). A publishable key is designed for browser use, but it is safe only when database Row Level Security (RLS), grants, and storage policies are correctly configured. Never place a Supabase secret key or Paystack secret key in that file.

The root .env.example is a configuration reference. The current storefront imports its public Supabase configuration from storefront/js/config.js; do not assume that creating a root .env file automatically injects values into the static website.

## Run locally

### Prerequisites

- Git
- Node.js with a supported npm/npx installation
- Access to the correct Cloudflare account and the project's configured external services for integration testing

This repository is a static HTML/CSS/JavaScript project with a Cloudflare Worker. There is currently no root package.json build script; use Wrangler directly.

### 1. Clone the repository

~~~bash
git clone https://github.com/blinkzdlfx-cell/original-beulah-foods.git
cd original-beulah-foods
~~~

### 2. Authenticate Wrangler

~~~bash
npx wrangler login
~~~

Make sure the authenticated Cloudflare account is the account that owns the intended Worker and D1 database. Do not deploy from an unintended account or environment.

### 3. Start the local Worker

~~~bash
npx wrangler dev
~~~

Open the local address printed by Wrangler. Static pages can be inspected locally, but authentication, database, AI, payment, email, cron, and webhook behavior depends on the relevant bindings, secrets, and external service configuration. Use a dedicated TEST environment for checkout/payment testing.

## Deploy to Cloudflare

Review wrangler.toml, confirm the target account and environment, and ensure the required secrets and bindings are configured before deploying.

~~~bash
npx wrangler deploy
~~~

After deployment, verify the homepage, clean storefront routes, admin sign-in, customer authentication, catalogue data, AI assistant, and relevant API flows on the actual deployed hostname. A successful deployment command alone does not prove the complete application is production-ready.

The repository configuration includes custom-domain routes for both beulahfoods.com and www.beulahfoods.com. Confirm the domain, DNS, secrets, database bindings, authentication redirect URLs, and Paystack webhook destination in the Cloudflare, Supabase, and Paystack dashboards before treating a deployment as production.

## Database setup and migrations

### Supabase

Supabase is the authoritative database for catalogue, customer, order, reservation, payment, promotion, How To, announcement, and AI knowledge records. Migration files currently present in supabase/migrations/ cover several later additions, including Paystack idempotency/status handling, product image storage, admin display name, promo validation/redemptions, How To content, announcements, and AI knowledge.

**Migration reproducibility is a known handover item:** [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) records that the original SQL files for the first eight baseline migrations were applied to the clean project but are not yet mirrored in this repository. Do not assume a brand-new Supabase project can be recreated from the checked-in migration directory alone. Preserve the existing project and recover/verify the missing baseline migration source before attempting a fresh database setup.

### Cloudflare D1

D1 is used only for AI chat history. The repository contains:

- d1/migrations/0001_ai_chat.sql
- d1/migrations/0002_ai_confirmations.sql

Before creating or migrating a D1 database, verify the intended environment and the database ID in wrangler.toml. Follow [docs/AI_SETUP.md](docs/AI_SETUP.md) and do not replace a live database with a newly created empty database.

## Tests

The repository includes a Node.js built-in test file for the AI security/tool contract:

~~~bash
node --test tests/ai-security.test.mjs
~~~

The test file checks the AI tool allowlist, rejects arbitrary execution tools, checks customer-ownership filters, verifies mutation-confirmation hooks, checks AI rate-limit enforcement, and ensures Paystack is outside the AI tool contract.

This is not a full end-to-end test suite. Use [docs/TESTING_RUNBOOK.md](docs/TESTING_RUNBOOK.md) for the controlled checkout/payment test plan. Record test outcomes as PASS, FAIL, or BLOCKED; do not report a release gate as complete without actual environment evidence.

## Security guidance

- Keep SUPABASE_SECRET_KEY, PAYSTACK_SECRET_KEY, RESEND_API_KEY, and optional AI-provider keys in Cloudflare secrets or the appropriate secret manager.
- Use only the Supabase publishable key in browser code.
- Keep Supabase RLS, grants, authentication checks, and storage policies enabled and reviewed.
- Never treat a payment callback or customer claim as proof of payment.
- Do not bypass the reservation/payment state machine or manually manufacture successful payment records.
- Do not commit customer data, private credentials, production logs, or secret values.
- Use TEST credentials and a separate TEST environment for payment acceptance tests.
- Give administrator accounts only to authorized staff and sign out on shared devices.

## Production and release checks

Before calling the site fully production-ready, verify and record the following:

- [ ] Cloudflare Worker and custom-domain routing work on the intended production hostname.
- [ ] Required Worker secrets are configured in the correct environment.
- [ ] Supabase Auth site URL, redirect allowlist, email confirmation, and password recovery work on the deployed hostname.
- [ ] Resend sender/domain and Supabase Auth SMTP settings are verified; signup and password-reset emails pass end-to-end tests.
- [ ] Paystack uses the correct TEST or LIVE secret for the target environment.
- [ ] Paystack webhook points to the correct deployed endpoint and signature verification is tested.
- [ ] Checkout, reservation, expiry, cancellation, stock, payment verification, webhook retries, and duplicate events pass the controlled test runbook.
- [ ] Successful payment emails are tested end-to-end.
- [ ] Supabase RLS, storage policies, admin permissions, and cross-customer isolation are reviewed.
- [ ] Missing baseline Supabase migration SQL is recovered or otherwise documented with a reproducible setup procedure.
- [ ] Automated and manual test results are recorded in the work log.

The repository's production-readiness documents describe outstanding configuration and acceptance gates. Review them before promoting changes or changing live service settings.

## Additional documentation

- [docs/ADMIN_DASHBOARD_OPERATIONS_GUIDE.md](docs/ADMIN_DASHBOARD_OPERATIONS_GUIDE.md) — instructions for staff using the admin dashboard.
- [docs/REBUILD_ARCHITECTURE.md](docs/REBUILD_ARCHITECTURE.md) — architecture overview.
- [docs/BUSINESS_LOGIC_CONTRACT.md](docs/BUSINESS_LOGIC_CONTRACT.md) — important business rules and state transitions.
- [docs/CART_CONTRACT.md](docs/CART_CONTRACT.md) — cart behavior.
- [docs/CHECKOUT_PAYMENT_FLOW.md](docs/CHECKOUT_PAYMENT_FLOW.md) — checkout and payment flow.
- [docs/PAYSTACK_CONTRACT.md](docs/PAYSTACK_CONTRACT.md) — Paystack integration boundary.
- [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) — migration history and reproducibility caveat.
- [docs/AI_SETUP.md](docs/AI_SETUP.md) — AI and D1 setup.
- [docs/AI_SECURITY.md](docs/AI_SECURITY.md) — AI security boundaries.
- [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md) — AI assistant behavior and implementation.
- [docs/TESTING_RUNBOOK.md](docs/TESTING_RUNBOOK.md) — controlled checkout/payment test procedure.
- [docs/PRODUCTION_READINESS_PHASE1.md](docs/PRODUCTION_READINESS_PHASE1.md) — production readiness audit and release gates.
- [docs/PRODUCTION_READINESS_PHASE2_AUTH_RESEND.md](docs/PRODUCTION_READINESS_PHASE2_AUTH_RESEND.md) — authentication email and Resend setup gates.

---

**Handover note:** Keep this README as the entry point for the codebase. Use the linked technical documents for detailed implementation contracts and operating procedures, and keep all credentials out of the repository.
