# Beulah Foods AI Security Contract

## Trust boundaries

1. Browser chat UI is untrusted.
2. Cloudflare Worker is the AI and privileged-request boundary.
3. Supabase is the application source of truth.
4. Workers AI is inference only.

## Controls

### Authentication
Customer-specific tools require a validated Supabase access token.

### Authorization
The model never supplies the customer identity. The Worker derives it from the validated session. Order queries include an explicit customer ownership filter.

### Tool allowlisting
Only the functions declared in `AI_TOOLS` can be selected. There is no generic SQL, HTTP, Supabase, or function-dispatch tool.

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
- Add automated cross-customer authorization tests.
- Add explicit confirmation UX for order creation/cancellation.
- Add the planned provider fallback only after the primary tool contract is stable.
