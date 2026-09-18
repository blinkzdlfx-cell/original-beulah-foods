# Beulah Foods AI Assistant

## Status

Initial customer assistant implementation is in the TEST repository: `blinkzdlfx-cell/original-beulah-foods`.

## Architecture

Storefront chat UI -> Cloudflare Worker `/api/ai/chat` -> allowlisted tools -> Supabase / storefront policy assets.

Workers AI is bound as `env.AI`. Initial model: `@cf/zai-org/glm-4.7-flash`.

## Customer capabilities

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

No persistent AI conversation table is introduced in this phase.
