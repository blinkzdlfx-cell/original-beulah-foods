# 2026-09-17 — Storefront consistency refinements

## Completed in this pass

- Storefront favicon references now use the existing Beulah Foods storefront logo asset: `/assets/beulah-logo.webp`.
- My Account, Shop, Checkout, How To, Privacy Policy, and Terms of Service use the same storefront logo asset for favicon/mobile icon references.
- The homepage footer markup was kept as the source and copied exactly into My Account, Shop, Checkout, How To, Privacy Policy, and Terms of Service.
- How To, Privacy Policy, and Terms of Service use the same `checkout-back` visual treatment as Cart/Checkout.
- Back controls use browser history and fall back to the storefront home on direct visits.
- Admin How To editor cards now size to their own content instead of visually expanding with the sibling editor when additional steps are added.
- Admin How To action buttons remain content-sized instead of stretching across the editor.
- Product guides remain associated with real products; selecting another product loads that product's guide, allowing one guide per product.

## Testing checkpoint

After deployment, verify:

1. The Beulah Foods storefront logo appears as the favicon.
2. My Account, Shop, Checkout, How To, Privacy Policy, and Terms of Service have the exact homepage footer.
3. Back controls on How To and legal pages return to the originating page.
4. Adding many How To steps does not expand the sibling How To Order card or make its save button unnecessarily wide.
5. Selecting another product in Admin How To loads that product's existing guide or a blank guide for creation.

Production resources remain out of scope.
