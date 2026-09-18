# Beulah Foods AI Assistant — Implementation Plan

## Phase 1 — backend foundation
- [x] Workers AI binding.
- [x] `POST /api/ai/chat`.
- [x] Bounded history and inputs.
- [x] Controlled catalogue/category/policy reads.
- [x] Customer-owned order reads.
- [x] Existing How To Order and product cooking-guide retrieval.
- [x] Admin-managed AI knowledge database and full-text search.
- [x] Controlled browser-cart actions.
- [x] Pending-order/reservation creation through existing checkout logic.
- [x] Pending-reservation cancellation through existing checkout logic.
- [ ] Deploy and verify in TEST.

## Phase 2 — admin knowledge management
- [x] AI Knowledge admin page.
- [x] Create/edit knowledge.
- [x] Category and tags.
- [x] Activate/deactivate knowledge.
- [x] Delete knowledge.
- [x] RLS restricted to admins.
- [ ] Browser acceptance test with a real TEST admin account.

## Phase 3 — storefront UI
- [x] Reusable floating assistant component.
- [x] Current browser cart sent with each request.
- [x] Validated cart actions applied locally.
- [x] Checkout link exposed after assistant-created pending orders.
- [ ] Browser acceptance tests on Home, Shop, Product, Cart and Account.

## Phase 4 — hardening
- [ ] Durable rate limiting.
- [ ] Abuse/cost monitoring.
- [ ] Explicit mutation confirmation UX.
- [ ] Automated security tests.
- [ ] Semantic/vector retrieval if the knowledge corpus requires it.
- [ ] OpenRouter/AI Gateway fallback.

## Release gate

No production resource is changed until the existing Beulah Foods TEST release gate passes.

The assistant remains outside Paystack control and outside arbitrary database access.


## UX hardening

- Brand-scoped response rules documented and enforced in the Worker system prompt.
- Floating assistant now has a noticeable discoverability pulse/ring and temporary "Ask Beulah AI" hint.
- Message submission shows an animated Thinking state until the response arrives.
- Reduced-motion users receive a non-animated fallback.


## Implemented — D1 history and multi-provider routing

- Added Cloudflare D1 schema under d1/migrations/0001_ai_chat.sql.
- Added Worker D1 conversation/message helpers and ownership checks.
- Added GET /api/ai/history and DELETE /api/ai/history.
- Changed POST /api/ai/chat to load history from D1 and persist user/assistant messages there.
- Removed browser-supplied chat history from the AI request contract.
- Added seven-day scheduled cleanup and a per-conversation message cap.
- Added provider routing for Cloudflare Workers AI, OpenRouter, and Hugging Face with configurable order and optional provider credentials.
- Normalized OpenAI-compatible tool-call messages for OpenRouter/Hugging Face while retaining the existing Cloudflare tool contract.
- Updated the storefront assistant to load/clear server-side history rather than storing message bodies in localStorage.

### External setup still required

The repository cannot create or bind a Cloudflare D1 database from GitHub alone. Create the TEST D1 database, apply d1/migrations/0001_ai_chat.sql, and put the returned database ID in wrangler.toml under the AI_DB binding. Then deploy the Worker.

Cloudflare Workers AI can run without an external provider key when the existing AI binding is available. OpenRouter and Hugging Face are optional fallbacks; each needs a server-side API key and a tool-capable model configured in Worker environment variables.
