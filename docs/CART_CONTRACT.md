# Cart Contract

## Authority

The customer cart is localStorage-first. The browser persists the user's selected product IDs and quantities.

Supabase remains authoritative for product metadata, price, availability, and stock.

## Local representation

```json
[
  { "productId": "<uuid>", "quantity": 2 }
]
```

Do not treat browser-stored product names, prices, stock, or totals as authoritative.

## Page-load behavior

Every page that displays cart state uses the same cart service/manager.

```text
Page load
  -> read localStorage immediately
  -> render known cart selection
  -> fetch authoritative product data once for the current cart
  -> reconcile product availability/current metadata
  -> update state only when the resulting cart signature actually changes
```

There must be no polling loop and no recursive refresh loop.

## Change propagation

Cart mutations dispatch one browser-level cart change event. Other components subscribe to that event instead of independently re-fetching the cart.

A stable cart signature based on product ID + quantity is used to avoid unnecessary writes/renders when nothing changed.

## Authentication

Cart persistence must not require login. Login may later associate the local cart with the authenticated customer if the application needs durable cross-device persistence, but localStorage remains the immediate browser cart source.

Logout must not unexpectedly erase the anonymous local cart.

## Checkout

Checkout revalidates the cart against Supabase before creating the pending order. The server calculates prices, stock, delivery fees, promotions, and final total. The browser cannot choose the authoritative payment amount.

## Failure behavior

Network/catalogue failures must not invent prices, quantities, stock, or payment state. Existing local selection remains available until authoritative data can be reconciled.
