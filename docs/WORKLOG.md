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

## 2026-09-17 — Clean storefront, admin, checkout RPC, and promo validation corrections

### Storefront asset routing

- Root-level storefront HTML routes were intentionally preserved.
- Fixed the Cloudflare Worker asset fallback so root-relative storefront CSS, JavaScript, images, and SVG requests map back to `/storefront/...` in the static asset bundle.
- Live Beulah Foods homepage verification confirmed the affected CSS, JavaScript, hero image, and SVG asset requests return successfully with no observed 404s.
- Production resources were not modified.

### Product image storage and admin schema alignment

- Created the public `product-images` Supabase Storage bucket with a 5 MB limit and JPEG/PNG/WebP MIME restrictions.
- Restricted object writes to authenticated admins while allowing public reads for storefront product images.
- Updated clean admin product handling from the obsolete `image_url` field to authoritative `image_path` storage paths.
- Removed obsolete `reserved_quantity` product reads from the clean admin inventory flow and calculate available stock from active, unexpired reservation items instead.
- Added the missing `admin_users.display_name` field required by the clean admin interface.
- Removed temporary migration/adaptation workflows after their changes completed.

### Checkout 403 root cause and correction

The customer checkout page was sending the authenticated Supabase RPC request correctly, but the public `create_pending_order` wrapper was not itself `SECURITY DEFINER` even though the underlying private function was. The authenticated browser therefore received HTTP 403 when calling `/rest/v1/rpc/create_pending_order`.

Corrected the customer-facing checkout wrappers so they execute the intended private `SECURITY DEFINER` functions while retaining the intended execution boundary:

- anonymous users: no execute
- authenticated customers: execute
- service role: execute

The corrected wrappers include `create_pending_order`, `create_paystack_payment_attempt`, `cancel_pending_order`, `expire_customer_reservation`, and `retry_expired_pending_order`.

The authenticated pending-order path was then tested successfully. The test produced an authoritative order total, reservation ID, order number, and 15-minute expiration; the verification test was rolled back so it did not leave an unwanted test order/reservation behind.

### Current checkout acceptance state

The browser has now successfully created a real pending order and active 15-minute reservation through the clean TEST database. The checkout UI changes to the payment continuation state and maintains the reservation countdown.

The next payment acceptance checkpoint is Paystack test-mode initialization. Paystack must not be treated as successful until server-side initialization, provider response, callback verification, webhook finalization, and idempotency are all verified.

### Promo-code validation correction

Added an authenticated `public.validate_promo(p_code text, p_subtotal numeric)` wrapper around the existing private authoritative promo validation function.

Security boundary:

- anonymous users: no execute
- authenticated customers: execute
- service role: execute
- the private validator remains the authoritative implementation
- validation does not increment promo usage

The checkout page now has a **Check promo code** button. It validates the entered code against the authoritative database rules before order creation, including active state, start/end time, usage limit, minimum order amount, percentage/fixed discount calculation, maximum discount, and subtotal cap. A valid result updates the displayed discount and total locally for review; the actual `create_pending_order` call still re-validates the promo server-side, so the button is only a pre-check and never becomes the source of truth.

The clean TEST database currently contains `WELCOME1`, an active percentage promo with a 5% discount and no minimum order amount or maximum discount configured.

### Admin transactions and promo redemption tracking

- Fixed the clean admin Transactions page schema mismatch that caused HTTP 400 by replacing the obsolete `provider_reference` field with the authoritative payment `reference` field and using the actual payment/order relationships.
- Added promo visibility to admin Orders and Transactions records.
- Added `promo_redemptions` tracking tied to the order and promo code, including the promo code, order subtotal, discount amount, and timestamp.
- Updated trusted order creation so a valid promo application records a redemption and increments the promo usage count as part of the same transaction.
- Existing applicable promo usage was backfilled into the new redemption tracking table.

Production resources remain out of scope.

## 2026-09-17 — Next feature plan documented

Created `docs/NEXT_FEATURE_PLAN.md` as the persistent context for the next wider implementation chunks.

### Group A — Brand assets

Planned, not yet implemented:

- Create a favicon derived from the existing Beulah Foods logo/brand mark and prepare it for small-size readability.
- Add correct storefront favicon/browser/mobile icon references.
- Separate admin brand assets from storefront asset paths.
- Ensure admin logo/favicon references are local to the admin application.
- Verify there are no broken asset requests and no unnecessary storefront dependency from admin.

### Group B — How To system

Planned, not yet implemented:

- Build an admin-controlled product How To content system.
- Associate each guide with a real catalogue product.
- Support editable title and description.
- Support any number of ordered instructional steps, including add/edit/remove/reorder.
- Build a separate admin-controlled How To Order guide with editable ordered steps.
- Render customer-facing How To content from real database records.
- Apply appropriate RLS/admin authorization and loading/error/empty states.
- Do not introduce mock instructional data.

The exact database schema will be verified against the current clean Supabase schema before implementation.

### Group C — Legal pages

Planned, not yet implemented:

- Create a customer-facing Privacy Policy page based on the actual Beulah Foods application's data and infrastructure behavior.
- Create a customer-facing Terms of Service page based on the actual ordering, reservation, promo, payment, verification, and delivery behavior.
- Keep business/legal details that require owner confirmation clearly identifiable instead of silently inventing them.
- Add both pages to appropriate storefront footer/navigation locations.

### Reserved future groups

- Group D: Admin loading states for Orders, Transactions, and related data-fetching states.
- Group E: Admin-controlled announcements with image, short description, page targeting, display sequence, and display mode.
- Group F: Final documentation/context pass, including worklog/feature documentation and AI-assistant documentation status.

No implementation was performed for Groups A–C by this documentation update. Production resources remain out of scope.

## Phase D–F completion — 2026-09-18

### Phase D — admin loading states
- Added explicit loading rows to the Orders and Transactions data tables so an empty table is not mistaken for an empty database while the request is in flight.
- Existing save buttons already expose busy states for supported admin forms; How To save actions use Saving… states.

### Phase E — announcements
- Added the authoritative public `announcements` table with page targeting, display sequence, display mode, optional image, scheduling window, and active state.
- Added RLS: public users can read only currently active/in-window announcements; authenticated administrators can manage records.
- Added the `announcement-images` public-read storage bucket with 5 MB JPG/PNG/WebP limits and admin-only writes.
- Added Admin Announcements page with create/edit/publish/unpublish, image upload, target page, display mode, scheduling, and sequence controls.
- Added storefront announcement service/component and enabled it on Home, Shop, How To, Cart, Checkout, and My Account. No mock announcement records were inserted.

### Phase F — documentation/context
- Recorded this D–F implementation in this worklog.
- Kept the release gate and external Paystack configuration explicitly pending; no production resources were changed.

## 2026-09-18 — Pending-item audit and release-gate status

- Rechecked the clean TEST Supabase migration ledger: 20 migrations are applied in the database.
- The repository contains source for the later migration work, but the earliest core migration sources and some intermediate security migrations are not present under the same filenames as the applied ledger. These were not fabricated or guessed.
- The current database schema was inspected directly as the authoritative runtime state. Exact historical SQL source remains the only migration-mirror gap; a fabricated replacement would violate the source-of-truth requirement.
- Confirmed the previously reported Admin How To card expansion fix remains in admin/css/how-to.css: the two editors use independent content-height sizing and the action buttons remain content-sized.
- Verified the public TEST Worker: storefront root responds successfully; payment initialize/webhook reject incorrect GET requests with 405 and verify rejects unauthenticated access with 401, confirming the routes are deployed and protected at the public boundary.
- Confirmed the two admin accounts are already provisioned in the clean TEST project; remaining admin work is acceptance testing rather than provisioning.
- Remaining release-gate actions requiring owner/external-dashboard access: configure the Paystack TEST webhook URL, configure the Cloudflare Worker PAYSTACK_SECRET_KEY and SUPABASE_SECRET_KEY, then execute the real Paystack TEST transaction and full callback/webhook/idempotency acceptance suite.
- Production resources remain untouched.

## 2026-09-18 — AI assistant implementation started

### Architecture confirmed

- The authoritative implementation repository remains `blinkzdlfx-cell/original-beulah-foods`.
- The earlier AI-assistant design is now recorded in `docs/AI_ASSISTANT.md`, `docs/AI_TOOLS.md`, `docs/AI_SECURITY.md`, and `docs/AI_IMPLEMENTATION_PLAN.md`.
- Cloudflare Worker remains the AI/security boundary.
- Supabase remains the source of truth.
- Paystack remains outside the assistant boundary.

### Backend implemented

- Added Workers AI binding in `wrangler.toml`.
- Added `POST /api/ai/chat`.
- Initial model: `@cf/zai-org/glm-4.7-flash`.
- Added allowlisted product/category/policy read tools.
- Added customer-owned order read tools.
- Added browser-cart action tools.
- Added pending-order creation through the existing authenticated `create_pending_order` RPC.
- Added pending-reservation cancellation through the existing authenticated `cancel_pending_order` RPC.
- Added bounded message/history/cart/tool-call limits.
- No new database tables or payment logic were introduced.

### Storefront implemented

- Added reusable floating `Beulah Assistant` component.
- Initialized it from the existing storefront navbar component, keeping admin untouched.
- Browser cart state is sent with each assistant request.
- Validated cart actions are applied through the existing cart service.
- Assistant-created pending orders expose the normal checkout URL.

### Verification

- Worker JavaScript syntax checked successfully after implementation.
- Assistant component JavaScript syntax checked successfully after removing module imports for parser validation.
- Supabase TEST database verified to contain the existing public `create_pending_order` and `cancel_pending_order` wrappers required by the assistant.

### Remaining AI acceptance work

- Deploy the repository changes to the TEST Worker.
- Verify Workers AI inference.
- Verify product/stock tool results against live TEST data.
- Verify cart actions in the browser.
- Verify customer order isolation with two TEST customer accounts.
- Verify pending-order creation and reservation behavior.
- Add durable rate limiting, abuse/cost monitoring, explicit mutation confirmation, automated security tests, and the planned OpenRouter/AI Gateway fallback before production consideration.

Production resources remain untouched.

## 2026-09-18 — AI knowledge base and How To retrieval

- Confirmed the existing How To database is the source of truth for customer ordering instructions and product preparation guides.
- Added the controlled `get_how_to` AI tool for How To Order and cooking/preparation content.
- Added TEST Supabase `ai_knowledge` table with title, category, content, tags, active status, timestamps, and PostgreSQL full-text search support.
- Added admin-only RLS to the AI knowledge table.
- Added `search_ai_knowledge` RPC for controlled active-entry retrieval.
- Added `/admin/knowledge.html` and its admin JavaScript for creating, editing, activating/deactivating, and deleting AI knowledge.
- Added AI Knowledge to the admin navigation.
- Updated AI architecture, tool contract, security contract, and implementation plan documentation.
- The current retrieval layer is PostgreSQL full-text search. Semantic/vector retrieval is deliberately deferred until the knowledge corpus justifies the additional indexing/embedding infrastructure.
- Production remains untouched.


### AI assistant scope and UX hardening
- Restricted the assistant to Beulah Foods domain knowledge and documented clean redirects for unrelated questions.
- Added stronger rules against hallucinated brand facts and disclosure of internal instructions/data.
- Improved floating AI discoverability with pulse/ring animation and an "Ask Beulah AI" hint.
- Added animated Thinking indicator while requests are in flight and reduced-motion support.


## 2026-09-18 — AI D1 history and provider routing implementation

- Replaced browser-local chat message persistence with Cloudflare D1 as the server-side conversation store.
- Added D1 schema at d1/migrations/0001_ai_chat.sql with conversations, visible messages, indexes, and no seed/mock data.
- Added secure conversation cookie handling and authenticated conversation ownership/guest isolation.
- Added GET /api/ai/history and DELETE /api/ai/history.
- POST /api/ai/chat now loads recent history from D1 and persists only customer-visible user/assistant messages.
- Added a 100-message per-conversation cap and seven-day inactivity cleanup through a scheduled Worker handler.
- Added configurable AI provider routing: Cloudflare Workers AI, OpenRouter, and Hugging Face.
- Provider credentials remain optional Worker-side secrets; providers are skipped unless both credentials/bindings and model configuration are present.
- Added provider-specific tool-call normalization for OpenAI-compatible providers.
- Updated storefront AI UI to load and clear history through the Worker rather than localStorage.
- Documented D1 retention, security, provider routing, and external setup requirements.
- Production resources remain untouched.

### External setup required before AI can run

1. Create the TEST Cloudflare D1 database named original-beulah-ai.
2. Apply d1/migrations/0001_ai_chat.sql to that TEST database.
3. Add the real D1 database ID to wrangler.toml as the AI_DB binding; the repository intentionally does not contain a fake ID.
4. Deploy the Worker after the binding is configured.
5. Confirm the existing Cloudflare Workers AI binding is available.
6. Optionally add OPENROUTER_API_KEY and HUGGINGFACE_API_KEY as Cloudflare Worker secrets and configure tool-capable model names.
7. Run the AI acceptance tests: history persistence, refresh/resume, clear, seven-day cleanup, provider fallback, tool calls, cart actions, customer order isolation, pending-order creation, and payment-boundary checks.


## 2026-09-18 — Phase 5 AI hardening implementation

Implemented the first Phase 5 hardening layer in TEST code:

- Added Cloudflare Rate Limiting bindings for /api/ai/chat and /api/ai/confirm.
- Added fail-closed behavior when the rate-limit bindings are missing.
- Added structured Worker Observability events for AI completion, rate limiting, and mutation failures without logging customer message content or secrets.
- Added D1 migration 0002_ai_confirmations.sql for one-time, two-minute mutation confirmations.
- Changed AI order creation and reservation cancellation to require explicit frontend confirmation before the trusted Supabase RPC executes.
- Added customer/action/expiry checks and one-time claim semantics for confirmation records.
- Added cart-state binding to order confirmations.
- Added tests/ai-security.test.mjs for static AI security-contract checks.
- Added docs/AI_PHASE5_TEST_CHECKLIST.md as the owner-run acceptance specification.

External TEST actions still required: apply the D1 migration, deploy the Worker, verify the rate-limit bindings, and execute the checklist. Production remains untouched.

## 2026-09-19 — AI UX and storefront offline foundation

### AI conversation UX
- Added a clean welcome state when Beulah AI opens instead of immediately rendering D1 history.
- D1 history is prefetched and becomes visible when the customer starts a new message in the current interaction.
- Added time-aware randomized greeting/readiness copy.
- Added session-scoped assistant-open persistence for refreshes; explicit close clears the state.
- Changed latest-message navigation so the down-arrow centers the newest message in the transcript.
- Preserved non-jumping behavior when a customer is reading older messages.

### Storefront offline foundation
- Added a shared offline state manager initialized with the storefront navbar.
- Added a global offline/restored connection banner.
- Added a root service worker with versioned shell caching, network-first navigation, static asset caching, and an offline fallback page.
- API requests are intentionally excluded from service-worker interception.
- Beulah AI blocks new requests while offline and provides an explicit reconnect message.
- Documented the design and acceptance checklist in `docs/OFFLINE_HANDLING.md`.

No offline payment/order success is simulated and no production resources were changed.
