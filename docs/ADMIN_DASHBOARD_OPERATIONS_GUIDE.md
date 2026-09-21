# Beulah Foods Admin Dashboard — Operations Guide

## Purpose

This guide explains how an authorized Beulah Foods administrator should operate every area of the admin dashboard. It is written as an operating procedure: make a change, verify the result, and avoid changing data that belongs to another workflow.

## Access

1. Open the Beulah Foods admin area.
2. Sign in with an account provisioned for admin access.
3. Use **Log out** when finished on a shared device.
4. Do not share an admin password or expose secret keys in the dashboard.

## Navigation

On desktop, the dashboard uses a persistent left sidebar. The active page is highlighted.

On mobile, use the menu button to open the same navigation.

Available areas:

- Dashboard
- Orders
- Transactions
- How To
- AI Knowledge
- Announcements

## 1. Dashboard

The Dashboard is the main catalogue and store-settings workspace.

### Products

To create a product:

1. Enter the product name.
2. Select its category.
3. Enter the description.
4. Enter the NGN price.
5. Enter the physical stock quantity.
6. Upload a JPG, PNG, or WebP product image when needed.
7. Set the sort order.
8. Enable **Active** when the product should be available.
9. Enable **Show on homepage as featured** when appropriate.
10. Select **Save product**.
11. Confirm the product appears in the Products table.

To edit a product:

1. Select the product's edit action.
2. Review the existing values.
3. Change only the required fields.
4. Save.
5. Verify price, stock, status, and category in the table.

### Categories

1. Enter the category name.
2. Add a description if useful.
3. Set the display order.
4. Save.
5. Verify the category before assigning products to it.

### Delivery settings

1. Open Delivery settings.
2. Enable delivery when delivery should be offered.
3. Enter the delivery fee in NGN.
4. Make the configuration active.
5. Save.
6. Test the customer checkout flow before relying on a changed delivery configuration.

### Promo codes

1. Enter a unique code.
2. Choose Percentage or Fixed amount.
3. Enter the discount value.
4. Set the minimum order when required.
5. Optionally set maximum discount and usage limit.
6. Set start and expiry dates when required.
7. Activate the code.
8. Save.
9. Test the code against an eligible order.

## 2. Orders

Orders are the fulfilment workspace.

Use Orders to:

1. Review customer orders.
2. Check ordered items.
3. Review delivery information.
4. Review totals and promo usage.
5. Check payment status.
6. Update the order's fulfilment status where the workflow permits.
7. Confirm the resulting status and customer notification.

Do not manually treat a successful Paystack payment as successful just because a customer says they paid. Payment truth is established by the trusted verification/webhook path.

## 3. Transactions

Transactions are the payment-record workspace.

Use this page to:

1. Locate the payment record.
2. Check the provider and reference.
3. Compare the amount with the order.
4. Review payment status.
5. Review the linked order status.
6. Use the provider reference when investigating a payment issue.

Do not edit payment truth from the dashboard.

## 4. How To

The How To page has two workflows.

### Product guide

1. Select the product.
2. Enter the guide title.
3. Add the description.
4. Add preparation steps in order.
5. Publish the guide when it is ready.
6. Save.
7. Review the customer-facing result.

### How to Order

1. Set the customer-facing title.
2. Add the description.
3. Add the ordering steps in the exact sequence customers should follow.
4. Publish.
5. Save.
6. Verify the storefront instructions.

## 5. AI Knowledge

AI Knowledge controls approved information available to the customer AI.

To add knowledge:

1. Enter a precise title.
2. Select the correct category.
3. Add useful search tags.
4. Write the approved information in the Knowledge field.
5. Mark it active when it is ready.
6. Save.
7. Verify the entry appears in the knowledge table.

Recommended categories:

- General
- How To
- Cooking
- Ordering
- Product
- Delivery
- FAQ
- Policy

Only put verified business information here. Do not use this page as a scratchpad.

## 6. Announcements

Announcements communicate temporary or important storefront information.

### Create an announcement

1. Enter a short, clear title.
2. Select the target page.
3. Write the short description.
4. Choose a display style:
   - **Inline** — normal, non-interruptive information.
   - **Top banner** — short, high-visibility information.
   - **Featured** — larger visual content.
   - **Modal** — information that requires attention; use sparingly.
5. Set the display sequence. Lower numbers appear first.
6. Optionally set start and expiry times.
7. Add CTA text and a site path or HTTP(S) URL when needed.
8. Upload an image when useful.
9. Choose whether customers can dismiss it.
10. Choose **Show once per browser** only when appropriate.
11. Publish the announcement.
12. Verify it on the selected storefront page.

### Recommended announcement practice

Use:

- Banner for short operational notices.
- Featured for product launches or major promotions.
- Inline for ordinary information.
- Modal only for genuinely important notices.

Do not use multiple competing modals.

## 7. Standard operating procedure

For every important change:

1. Identify the correct admin page.
2. Change only the necessary record.
3. Save.
4. Verify the success message.
5. Re-read the resulting table or form value.
6. Check the customer-facing page when the change affects storefront behavior.
7. If the result is unexpected, stop rather than repeatedly changing the same record.

## Troubleshooting

### A product is not visible

Check:

- Product is Active.
- Stock quantity is correct.
- Category is correct.
- The customer page has refreshed.
- No scheduled or storefront-specific condition is hiding it.

### A payment looks wrong

Check:

- Order reference.
- Transaction reference.
- Amount.
- Payment status.
- Order status.

Do not manually manufacture a successful payment state.

### An announcement is not visible

Check:

- Active status.
- Target page.
- Start time.
- Expiry time.
- Display sequence.
- Browser dismissal/show-once state.
- The storefront page being tested.

### AI gives incorrect information

Check the AI Knowledge page first. Correct or deactivate the relevant knowledge entry, then retest the customer assistant.

## Security rules

- Never place Paystack, Supabase, Resend, Cloudflare, or other secret keys in an admin field.
- Never share administrator credentials.
- Do not change database records directly unless the change is part of an approved engineering procedure.
- Use the Transactions page for investigation and the Orders page for fulfilment.
- Keep customer information private.
