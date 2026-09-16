# Admin Dashboard Contract

## Source of truth for this rebuild

The TEST repository (`blinkzdlfx-cell/test-beulah-foods`) is being used as the reference for the admin dashboard's existing UI structure and business behavior. Its JavaScript is reference material only; it will not be copied into the new rebuild because it is coupled to the old Supabase project and schema.

## How the TEST admin UI communicates with JavaScript

The TEST dashboard is DOM-driven. HTML defines stable element IDs and table/form containers, while page JavaScript imports Supabase and admin-auth services and binds event handlers to those elements.

Examples:

- `admin/index.html` provides `admin-login`, `admin-app`, `product-form`, `category-form`, `product-rows`, `category-rows`, `delivery-form`, `promo-form`, and metric elements. `admin.js` queries those IDs and owns dashboard loading and mutations.
- `admin/orders.html` provides `rows`, `status`, and `order-pagination`; `orders.js` loads orders and attaches status-change handlers to generated selects.
- `admin/transactions.html` provides `rows`, `status`, and `transaction-pagination`; `transactions.js` loads payment records and linked order state.
- `adminAuthService.js` checks the Supabase session and then checks `admin_users` for authorization. A signed-in customer without an `admin_users` record is rejected.

This DOM contract is intentionally preserved in the new UI where it matters so a regenerated JS layer can be attached without redesigning the backend around presentation details.

## TEST business capabilities to preserve

### Authentication and authorization

1. Get the current Supabase session.
2. Require an authenticated user.
3. Confirm that the user's ID exists in the admin authorization table.
4. Display the admin application only after authorization succeeds.
5. Sign-out terminates the Supabase session.

### Catalogue

The TEST dashboard manages:

- categories
- products
- price
- physical stock quantity
- active/inactive state
- featured state
- sort order
- product image upload/removal

Products are server-paginated. The UI displays physical stock separately from reserved inventory.

### Delivery

The TEST dashboard exposes delivery enablement, delivery fee and active settings. The rebuild must make the new database model authoritative before these controls become active.

### Promotions

The TEST dashboard supports V1 promo codes with discount type/value, minimum order, optional maximum discount, usage limit, start/end dates and active state. Enforcement belongs in the database/business layer, not only in the browser.

### Orders

The TEST orders page reads order records with:

- order number
- customer/delivery identity
- line items
- delivery address
- subtotal
- delivery fee
- discount
- total
- payment status
- order status
- creation time

The visible order-status values in TEST are `pending_payment`, `paid`, `processing`, `completed`, and `cancelled`. Status changes go through an admin RPC (`admin_update_order_status`) rather than a direct browser update.

### Transactions

The TEST transactions page reads payment records with the linked order:

- payment ID
- order ID/number
- provider
- provider reference
- amount
- payment status
- linked order status
- creation time

Payment status is displayed separately from fulfilment/order status.

## Rebuild boundary

The new dashboard is currently UI-only. Database reads, writes, authentication, storage, and admin RPCs are deliberately disabled until the new Supabase schema and security model are approved.

No fake products, orders, transactions, metrics or payment states are inserted to make the dashboard appear populated.

## Database implementation order

1. Define tables and relationships.
2. Define RLS and admin authorization.
3. Define storage policy for product images.
4. Define admin RPCs for business-sensitive mutations.
5. Connect regenerated admin services to Supabase.
6. Test each admin capability against the real database.
7. Connect customer checkout/payment state to the same authoritative records.
