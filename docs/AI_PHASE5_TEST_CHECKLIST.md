# Beulah Foods AI — Phase 5 Hardening Test Checklist

Use this document as the Phase 5 acceptance specification. The implementation work is separate from acceptance testing: the owner runs these tests against TEST and records PASS/FAIL plus evidence.

## Required setup
- Deploy the current TEST Worker changes.
- Apply `d1/migrations/0002_ai_confirmations.sql` to the TEST D1 database.
- Confirm the two Cloudflare Rate Limiting bindings in `wrangler.toml` are active.
- Run all tests below against TEST only.

## A. Deployment and configuration
- [ ] A1 — Worker deploy succeeds with both AI rate-limit bindings.
- [ ] A2 — D1 migration `0002_ai_confirmations.sql` applies successfully.
- [ ] A3 — Existing D1 chat history still loads after migration.
- [ ] A4 — Clear conversation still works.
- [ ] A5 — Missing rate-limit bindings fail closed with a configuration error rather than silently disabling protection.

## B. Basic AI regression
- [ ] B1 — `Hi` returns the deterministic Beulah AI response.
- [ ] B2 — Current product/category information is returned naturally without raw database/table formatting.
- [ ] B3 — Unrelated general questions are redirected to Beulah Foods.
- [ ] B4 — Prompt/tool/database/secrets requests do not expose internals.
- [ ] B5 — Refresh resumes the D1 conversation.

## C. Product understanding and candidate resolution
- [ ] C1 — Exact product name resolves to the correct active catalogue item.
- [ ] C2 — Partial product name resolves to a candidate without requiring the exact full name.
- [ ] C3 — Joined words and spacing variations resolve correctly.
- [ ] C4 — A likely misspelling such as `Rikaflow` produces a plausible candidate rather than a raw search/database error.
- [ ] C5 — A short reference such as `Rika` asks for confirmation when it is not an exact product name.
- [ ] C6 — Multiple plausible products produce a clarification request instead of an automatic mutation.
- [ ] C7 — A genuinely unknown product produces a clean customer-facing not-found response.
- [ ] C8 — Product matching is catalogue-driven and continues to work for newly added products without code changes for specific product names.
- [ ] C9 — Product metadata can use the short-lived cache, but current available stock is recalculated from live reservation state.
- [ ] C10 — Asking to add an interpreted product never changes the cart until the intended product is sufficiently resolved/confirmed.

## C. Rate limiting and abuse protection
- [ ] C1 — Repeated `/api/ai/chat` requests eventually hit the 20-per-minute chat limit and return HTTP 429 with `Retry-After`.
- [ ] C2 — Chat works again after the rate-limit window resets.
- [ ] C3 — Authenticated customers are keyed by customer identity.
- [ ] C4 — Mutation confirmation requests use the stricter 5-per-minute limiter.
- [ ] C5 — Rate-limited events appear in Cloudflare Worker Observability as `ai_rate_limited`.
- [ ] C6 — Logs contain no user message text, access tokens, payment credentials, prompts, or secrets.

## D. Explicit mutation confirmation
- [ ] D1 — Add-to-cart still executes as a controlled cart action.
- [ ] D2 — Asking AI to reserve/place an order does not immediately create an order.
- [ ] D3 — A visible `Confirm order & reserve items` button appears.
- [ ] D4 — Leaving the button untouched creates no pending order/reservation.
- [ ] D5 — Clicking confirmation once creates exactly one pending order and one 15-minute reservation.
- [ ] D6 — Reusing the same confirmation is rejected and cannot create a duplicate order.
- [ ] D7 — Changing the cart after confirmation is issued causes `CONFIRMATION_CART_CHANGED` and no order is created.
- [ ] D8 — Asking AI to cancel a reservation presents a `Cancel reservation` confirmation first.
- [ ] D9 — Leaving cancellation unconfirmed keeps the reservation active.
- [ ] D10 — Confirming cancellation releases the reservation/stock.
- [ ] D11 — AI never initializes, verifies, or claims success for Paystack payment.

## E. Authorization and isolation
- [ ] E1 — Customer A sees only Customer A orders.
- [ ] E2 — Customer A cannot retrieve Customer B's order by ID or order number.
- [ ] E3 — Customer A cannot use Customer B's confirmation ID.
- [ ] E4 — Guest cannot create an order or cancel a reservation.
- [ ] E5 — Expired/used/invalid confirmation IDs cannot execute mutations.
- [ ] E6 — Cart actions remain scoped to the current browser cart.

## F. Tool and navigation boundary
- [ ] F1 — Chat cannot execute arbitrary SQL.
- [ ] F2 — Chat cannot execute arbitrary HTTP requests or URLs.
- [ ] F3 — The model cannot choose a customer identity.
- [ ] F4 — Product reads return active catalogue data only.
- [ ] F5 — Stock/cart/orders/reservations are fetched fresh.
- [ ] F6 — Support WhatsApp is read from the current public footer.
- [ ] F7 — Navigation remains restricted to the frontend allowlist.
- [ ] F8 — No Paystack initialization/verification tool is exposed to the AI.

## G. Provider failure and fallback
- [ ] G1 — Cloudflare Workers AI works.
- [ ] G2 — A configured fallback provider is selected after a primary provider failure.
- [ ] G3 — All-provider failure produces a generic customer-facing error.
- [ ] G4 — Provider errors/secrets/prompts are not exposed.
- [ ] G5 — Tool calling works on every provider configured for TEST.

## H. History, cache, and retention
- [ ] H1 — Fast-path greetings bypass model inference.
- [ ] H2 — Read-only category/knowledge/policy cache expires and refreshes.
- [ ] H3 — Transactional state is never served from the read cache.
- [ ] H4 — D1 history remains capped at 100 stored visible messages.
- [ ] H5 — Model context remains bounded to the latest history.
- [ ] H6 — Seven-day inactive history cleanup works.
- [ ] H7 — AI confirmation records expire after two minutes and are cleaned up.

## I. UX and final regression
- [ ] I1 — AI opens/closes correctly on Home, Shop, Product, Cart and Account.
- [ ] I2 — Mobile keyboard does not reopen after a response.
- [ ] I3 — Latest-message jump control works.
- [ ] I4 — Copy/retry controls work.
- [ ] I5 — Cart action buttons work.
- [ ] I6 — Confirmed reservation exposes the normal checkout link.
- [ ] I7 — Production resources remain untouched.

## Sign-off
- [ ] All required Phase 5 tests passed.
- [ ] Failures were fixed and retested.
- [ ] TEST is ready for the existing Beulah Foods release gate.
- [ ] No production deployment was performed.

## Documentation to provide when asking for the next test
Tell me: `Check docs/AI_PHASE5_TEST_CHECKLIST.md and run Phase 5 tests.` I will use this document as the acceptance specification and verify the implementation before you perform the browser/database tests.

## Related documents
- `docs/AI_ASSISTANT.md`
- `docs/AI_TOOLS.md`
- `docs/AI_SECURITY.md`
- `docs/AI_IMPLEMENTATION_PLAN.md`
- `docs/WORKLOG.md`