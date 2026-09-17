# Groups A–C Implementation Record — 2026-09-17

Environment: clean TEST only.

## Group A — Brand assets

- Storefront uses the dedicated `storefront/assets/favicon.webp` and explicitly declares it on the homepage, including an Apple touch icon reference.
- Added `admin/assets/favicon.svg`.
- Added `admin/assets/beulah-admin-logo.svg`.
- Dashboard, Orders, Transactions, and How To admin pages use admin-local branding.
- Existing Paystack, checkout, reservation, stock, and payment-finalization logic was not changed.

## Group B — How To

Added four Supabase tables:

- `how_to_guides`
- `how_to_steps`
- `how_to_order`
- `how_to_order_steps`

RLS allows public reads of active published content and restricts management to authenticated admins. Added `SECURITY DEFINER` admin save functions so guide/step replacement is handled transactionally.

Added `/admin/how-to.html` for product guides and the separate How To Order guide. Admin can select a product, edit title/description, publish/unpublish, and add/remove/edit arbitrary ordered steps.

Added `/how-to.html` for customers. It loads active real content from Supabase and handles loading, empty, and error states. No mock instructional data was inserted.

## Group C — Legal pages

Added:

- `/privacy-policy.html`
- `/terms-of-service.html`
- `storefront/css/legal.css`
- `storefront/js/pages/legal.js`

The pages are owner-review drafts based on the implemented application behavior. They do not claim legal review or invent business/legal details requiring confirmation.

Added How To and legal links to the storefront homepage and How To footer.

## Verification

The clean TEST Supabase project contains the four new How To tables, and the two admin save routines are `SECURITY DEFINER` functions.

## Acceptance still required

1. Verify storefront and admin favicon/logo requests after deployment.
2. Create a real product guide in admin and verify it on `/how-to.html`.
3. Create/update the real How To Order guide and verify it on `/how-to.html`.
4. Review and edit Privacy Policy and Terms of Service business/legal wording before final publication.

Groups D, E, and F remain the next planned implementation groups. Production resources remain untouched.
