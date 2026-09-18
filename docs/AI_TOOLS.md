# Beulah Foods AI Tool Contract

All tools are allowlisted in the Cloudflare Worker.

## Read tools

### get_categories
Returns active product categories.

### search_products
Arguments: `query`, `category_slug`, optional `limit` (1-8).

Returns active products with current NGN price and available stock after active reservations.

### get_product
Accepts a product UUID or slug. Returns current price and available stock.

### get_store_policies
Accepts `privacy` or `terms`. Reads the current storefront document through the Worker asset binding.

### get_my_cart
Reads the browser cart supplied with the request and enriches it with current catalogue data.

### get_my_orders
Authenticated only. Returns recent orders belonging to the authenticated user.

### get_my_order
Authenticated only. Accepts an order ID or order number and applies an explicit ownership filter.

## Action tools

### add_to_cart
Validates the active product and available stock, then returns a browser-cart action.

### update_cart
Validates the active product and available stock, then returns a browser-cart action.

### remove_from_cart
Returns a browser-cart remove action.

### create_order
Authenticated only. Uses the current browser cart and stored delivery profile and calls the existing `create_pending_order` RPC. It does not start payment.

### cancel_reservation
Authenticated only. Calls the existing `cancel_pending_order` RPC.

## Execution rules

- No arbitrary SQL tool.
- No arbitrary REST tool.
- Product reads require `is_active = true`.
- Order reads are scoped to the authenticated user's ID.
- Customer RPCs use the customer's access token.
- Worker secrets never enter model or browser messages.
