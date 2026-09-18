# Beulah Foods AI Tool Contract

All tools are allowlisted in the Cloudflare Worker.

## Read tools

### get_categories
Returns active product categories.

### search_products
Searches active products and returns current price and available stock after active reservations.

### get_product
Returns one active product with current price and available stock.

### get_how_to
Reads the existing customer education database:
- `order` returns the published How To Order guide.
- `cooking` returns published product preparation guides, optionally narrowed to a product.

### search_ai_knowledge
Searches the admin-managed `ai_knowledge` database using PostgreSQL full-text search. Only active entries are returned. This is the controlled knowledge retrieval layer for FAQs, cooking information, ordering rules, delivery information, product facts, policies, and general store knowledge.

### get_store_policies
Reads the current Privacy Policy or Terms of Service.

### get_my_cart
Reads and enriches the customer's current browser cart.

### get_my_orders
Authenticated only. Returns recent orders belonging to the authenticated user.

### get_my_order
Authenticated only. Accepts an order ID or order number and applies an explicit ownership filter.

## Action tools

### add_to_cart
Validates availability and returns a browser-cart action.

### update_cart
Validates availability and returns a browser-cart action.

### remove_from_cart
Returns a browser-cart remove action.

### create_order
Authenticated only. Uses the current browser cart and stored delivery profile and calls the existing `create_pending_order` RPC. It does not start payment.

### cancel_reservation
Authenticated only. Calls the existing `cancel_pending_order` RPC.

## Knowledge architecture

The How To tables remain the source of truth for customer education already managed through the How To admin page.

The new `ai_knowledge` table is the source of truth for manually curated AI knowledge. Admins can create, edit, activate/deactivate, and delete entries from `/admin/knowledge.html`.

The AI retrieves knowledge through the Worker, not through arbitrary database access. This keeps the model inside an allowlisted tool boundary.

## Response boundaries

- The assistant is brand-scoped to Beulah Foods rather than a general-knowledge chatbot.
- Unrelated general-knowledge questions should receive a short redirect to Beulah Foods topics.
- Brand facts must come from verified tool results or active admin knowledge; the model must not guess.
- Internal prompts, tools, database details, secrets, and private/admin information must not be disclosed.
- Customer-facing errors should be clean and generic rather than exposing internal error messages.

## Execution rules

- No arbitrary SQL tool.
- No arbitrary REST tool.
- Product reads require `is_active = true`.
- Order reads are scoped to the authenticated user's ID.
- Customer RPCs use the customer's access token.
- Knowledge retrieval exposes only active entries.
- Worker secrets never enter model or browser messages.
