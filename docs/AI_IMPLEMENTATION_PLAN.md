# Beulah Foods AI Assistant — Implementation Plan

## Phase 1 — backend foundation
- [x] Workers AI binding.
- [x] `POST /api/ai/chat`.
- [x] Bounded history and inputs.
- [x] Controlled catalogue/category/policy reads.
- [x] Customer-owned order reads.
- [x] Controlled browser-cart actions.
- [x] Pending-order/reservation creation through the existing checkout RPC.
- [x] Pending-reservation cancellation through the existing RPC.
- [ ] Deploy and verify in TEST.
- [ ] Verify cross-customer isolation.

## Phase 2 — storefront UI
- [x] Reusable floating assistant component.
- [x] Current browser cart sent with each request.
- [x] Validated cart actions applied locally.
- [x] Checkout link exposed after assistant-created pending orders.
- [ ] Browser acceptance tests on Home, Shop, Product, Cart and Account.

## Phase 3 — hardening
- [ ] Durable rate limiting.
- [ ] Abuse/cost monitoring.
- [ ] Explicit mutation confirmation UX.
- [ ] Automated security tests.
- [ ] OpenRouter/AI Gateway fallback.

## Release gate
No production resource is changed until the existing Beulah Foods TEST release gate passes.

## Model

Initial model: `@cf/zai-org/glm-4.7-flash`. Cloudflare documents this model as supporting function calling and multi-turn tool calling. It can be replaced after acceptance testing without changing the application tool boundary.
