# Beulah Foods AI Security Contract

## Trust boundaries

1. Browser chat UI is untrusted.
2. Cloudflare Worker is the AI/security boundary.
3. Supabase is the application source of truth.
4. Workers AI is inference only.

## Knowledge security

- `ai_knowledge` is protected by RLS.
- Only authorized admin users can create, edit, activate/deactivate, or delete knowledge entries.
- Customer-facing AI retrieval returns only `is_active = true` entries.
- The Worker exposes knowledge through a named search tool; there is no generic table/query tool.
- How To content is likewise read through named tools and respects the existing active/public rules.

## Other controls

### Authentication
Customer-specific tools require a validated Supabase access token.

### Authorization
The model never supplies the customer identity. The Worker derives it from the validated session. Order queries include an explicit customer ownership filter.

### Tool allowlisting
Only declared functions can be selected. There is no generic SQL, HTTP, Supabase, or function-dispatch tool.

### Mutation boundaries
Allowed mutations are limited to browser cart actions, pending-order creation through the existing trusted checkout RPC, and pending-reservation cancellation through the existing trusted cancellation RPC.

### Payment boundary
Paystack remains outside the assistant. The assistant can reserve an order but cannot initialize or verify payment.

### Data minimization
Order tools return order state, totals, dates and item snapshots. Delivery phone/address are not returned to the model.

### Input limits
The endpoint bounds message length, history length, cart size, cart quantity, search result count, and tool recursion.

## Before production

- Add durable rate limiting for `/api/ai/chat`.
- Add abuse and inference-cost monitoring.
- Add explicit confirmation UX for order creation/cancellation.
- Add automated cross-customer authorization tests.
- Consider semantic/vector retrieval when the curated knowledge corpus becomes large enough to need it.
- Add the planned provider fallback only after the primary tool contract is stable.
