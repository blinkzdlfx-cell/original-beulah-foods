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
