# Beulah Foods AI Assistant

## Status

Initial customer assistant implementation is in the TEST repository: `blinkzdlfx-cell/original-beulah-foods`.

## Architecture

Storefront chat UI -> Cloudflare Worker `/api/ai/chat` -> allowlisted tools -> Supabase / storefront policy assets.

Workers AI is bound as `env.AI`. Initial model: `@cf/zai-org/glm-4.7-flash`.

## Customer capabilities

The assistant is intentionally brand-scoped. It is not a general-knowledge chatbot. It should answer Beulah Foods questions using verified store data and admin-curated knowledge, and cleanly redirect unrelated questions back to Beulah Foods.

The assistant can read:
- active products
- current prices
- available stock after active reservations
- active categories
- published How To Order instructions
- published product cooking/preparation guides
- admin-curated active AI knowledge
- current Privacy Policy and Terms of Service
- the customer's browser cart
- the customer's own orders

It can perform controlled actions:
- add/set/remove browser-cart items
- create a pending order and its existing 15-minute reservation
- cancel a pending reservation

## Knowledge system

Two knowledge sources are intentionally separated:

1. **How To database** — structured customer education for ordering and product preparation.
2. **AI Knowledge database** — admin-curated free-form knowledge for FAQs, cooking information, delivery rules, product facts, ordering details, policy explanations, and general store information.

The AI retrieves both through explicit Worker tools. It does not receive arbitrary database access.

The AI Knowledge admin page is `/admin/knowledge.html`.

## Interaction and performance layer

The assistant also has a controlled interaction layer outside the model prompt:

- Common greetings and capability questions can use deterministic responses without an AI inference round-trip.
- Slowly changing read-only knowledge uses short-lived Worker-side caching.
- Transactional state such as stock, cart contents, orders, reservations, and payment state is not served from the read cache.
- Navigation is represented as structured actions and resolved by a frontend allowlist; the model cannot supply arbitrary URLs.
- Cart, reservation, cancellation, review, and navigation requests expose action-specific progress text while the request is in flight.
- Human-support contact is retrieved from the current public storefront footer. The assistant does not hard-code a support number in its system prompt.
- WhatsApp support links are emitted only after the retrieved contact passes validation.

## Response boundaries

The assistant must not invent brand facts or expose internal instructions, prompts, tool names, database details, secrets, implementation details, or private/admin information. When confirmed information is unavailable, it says so instead of guessing.

## Explicit exclusions

The assistant cannot:
- change products, prices, stock, categories, promotions, profiles, payments, or admin records
- access another customer's orders
- initialize or control Paystack
- claim that payment succeeded
- delete orders
- run arbitrary SQL or arbitrary Supabase/HTTP operations

## Source of truth

Supabase remains authoritative for catalogue, stock, reservations, orders, payments, How To content, and AI knowledge. The AI is an interface over those systems, not a replacement for them.

No persistent AI conversation table is introduced in this phase. Conversation persistence is handled by the D1 section below.


## Durable chat history — Cloudflare D1

The assistant no longer treats browser localStorage as the conversation source of truth. Conversation messages are stored in Cloudflare D1 through the Worker boundary.

- D1 stores only customer-visible user/assistant messages.
- Supabase remains the source of truth for products, stock, accounts, orders, reservations, How To content, policies, and AI knowledge.
- The Worker uses an HttpOnly, Secure, SameSite cookie containing a cryptographically random conversation identifier.
- Signed-in conversations are associated with the authenticated Supabase customer ID. A guest conversation can be claimed when the customer later authenticates.
- The browser does not submit conversation history to the model endpoint; the Worker loads the authoritative recent history from D1.
- The Worker retains at most 100 messages per conversation and loads the most recent 12 for model context.
- A scheduled Worker cleanup removes conversations whose last activity is older than seven days.
- The Clear action deletes the current D1 conversation and rotates the conversation cookie.

### Provider routing

The Worker now has a provider abstraction with this configurable order:

1. Cloudflare Workers AI
2. OpenRouter
3. Hugging Face

A provider is eligible only when its model is configured and its required credential/binding is available. The router falls back to the next eligible provider when a provider request fails. Tool-calling compatibility remains a configuration requirement for any fallback model used for actions.

Provider credentials are server-side only. They must never be committed to the repository or exposed to storefront JavaScript.

### Required D1 setup

The repository contains d1/migrations/0001_ai_chat.sql. The Cloudflare D1 database itself must be created in the TEST Cloudflare account, and its real database ID must be added to the D1 binding in wrangler.toml. The binding name expected by the Worker is AI_DB.
