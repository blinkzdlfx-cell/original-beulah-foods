# Beulah Foods AI Assistant

## Status

Initial implementation in the TEST repository: `blinkzdlfx-cell/original-beulah-foods`.

The assistant is a controlled customer-facing AI layer. It is not a general database agent and it is not an admin assistant.

## Architecture

Storefront chat UI -> Cloudflare Worker `/api/ai/chat` -> allowlisted tools -> Supabase / storefront policy assets.

Workers AI is bound as `env.AI`. The initial model is `@cf/zai-org/glm-4.7-flash`, which Cloudflare documents as supporting function calling and multi-turn tool calling.

## Customer capabilities

Read:
- active products
- current prices
- available stock after active reservations
- active categories
- current Privacy Policy and Terms of Service
- the customer's browser cart
- the customer's own orders

Actions:
- add/set/remove browser-cart items
- create a pending order and its existing 15-minute reservation
- cancel a pending reservation

## Explicit exclusions

The assistant cannot:
- change products, prices, stock, categories, promotions, profiles, payments, or admin records
- access another customer's orders
- initialize or control Paystack
- claim that payment succeeded
- delete orders
- run arbitrary SQL or arbitrary Supabase/HTTP operations

## Source of truth

Supabase remains authoritative for catalogue, stock, reservations, orders and payments. The AI is an interface over those systems, not a replacement for them.

The browser cart remains localStorage-first. Cart mutations are therefore validated by the Worker and returned as explicit client actions.

No persistent AI conversation table is introduced in this phase.
