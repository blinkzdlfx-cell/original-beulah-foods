# Next Feature Plan — Beulah Foods

Status: Planning only. Groups A–C are documented here for the next implementation chunk. No feature in Groups A–C is implemented by this planning update.

Repository: `blinkzdlfx-cell/original-beulah-foods`

Environment: TEST only. Production resources remain out of scope.

## Working rule for this plan

Implementation will be done in wider, logically grouped chunks rather than one isolated micro-change at a time. Each group should touch only the files, database objects, and assets required for that group. Existing working Paystack, reservation, stock, checkout, and payment-finalization behavior must not be rewritten unnecessarily.

Before each implementation group, inspect the current source of truth and preserve existing working behavior.

---

# Group A — Brand assets, favicon, and admin asset separation

## Objective

Make Beulah Foods branding work professionally at favicon/small-icon sizes and keep the admin dashboard's brand assets independent from storefront asset paths.

## A1. Storefront favicon

- Derive a dedicated favicon asset from the existing Beulah Foods logo/brand mark.
- Prepare the asset specifically for small favicon dimensions so the important mark remains recognizable.
- Keep the existing full logo asset for normal branding; do not use the full-size logo as a favicon merely by shrinking it in HTML.
- Add the appropriate favicon/head declarations to the customer-facing pages that need them.
- Consider the appropriate browser/mobile icon declarations without introducing unnecessary asset formats or tooling.

## A2. Admin branding assets

- Give the admin dashboard its own brand-asset location.
- Keep admin HTML/CSS/JS from depending on `/storefront/assets/...` for its logo or favicon.
- Reuse the same Beulah Foods brand source where appropriate, but expose it through admin-local asset paths.
- Verify the Cloudflare static-asset routing continues to serve both applications correctly.

## A3. Acceptance criteria

- Storefront favicon displays correctly at small size.
- Admin favicon displays correctly.
- Admin logo/branding loads from admin-owned assets rather than storefront paths.
- No unrelated storefront/admin functionality is changed.
- No broken asset requests appear in browser Network/Console checks.

---

# Group B — How To content system

## Objective

Create a real, admin-controlled How To system for product preparation/use instructions and a separate How To Order guide. Customer pages must read real content from the database rather than hard-coded/mock instructional content.

## B1. Product How To content

Each product may have a How To guide containing:

- product association
- guide title
- short description/introduction
- ordered instructional steps
- active/inactive state as appropriate

The number of steps must not be fixed to four. Admin should be able to add, remove, edit, and reorder steps.

The product relationship must use the real product record so a guide remains associated with the actual catalogue product.

## B2. How To Order content

Create a separate customer-facing guide for placing an order.

The guide should support ordered steps such as:

1. Browse products.
2. Add products to cart.
3. Review the cart.
4. Enter/review delivery information.
5. Check/apply a promo code where applicable.
6. Confirm and reserve the order.
7. Continue to Paystack.
8. Complete payment.
9. Track the order.

The wording must be editable by the admin rather than permanently embedded in the storefront.

## B3. Admin controls

Admin should be able to:

- create product How To content
- select the product
- enter/edit title and description
- add instructional steps
- reorder steps
- edit steps
- remove steps
- activate/deactivate applicable guides
- create/edit the How To Order guide
- add/reorder/edit/remove How To Order steps

## B4. Data design direction

Use normalized database content rather than storing an arbitrary block of HTML as the primary representation.

A possible structure is:

- `how_to_guides`
- `how_to_steps`
- `how_to_order`
- `how_to_order_steps`

The final schema must be checked against the current clean Supabase schema and existing RLS/admin authorization patterns before implementation. Do not fabricate schema columns without verifying the current database.

## B5. Customer-facing How To page

The storefront How To page should:

- load active real guides from Supabase
- present product-specific preparation/use instructions clearly
- present the separate How To Order guide
- handle empty/loading/error states professionally
- remain consistent with the existing storefront visual language

## B6. Acceptance criteria

- Admin can create and manage a product guide.
- Admin can manage any number of ordered steps.
- A customer can see the correct guide for the relevant product.
- Admin can manage the How To Order guide.
- Customer How To Order content is loaded from the database.
- No mock instructional records are introduced as a substitute for real backend support.
- RLS/authorization prevents unauthorized content management.

---

# Group C — Privacy Policy and Terms of Service

## Objective

Create customer-facing Privacy Policy and Terms of Service pages that reflect the actual Beulah Foods application's business and technical behavior.

## C1. Privacy Policy

Draft a clear privacy policy covering, as applicable to the actual implementation:

- customer account information
- customer profile information
- delivery/contact information needed to fulfill orders
- order and order-item information
- payment processing through Paystack
- authentication/session handling
- browser storage used by the application, including the local cart where applicable
- transactional communications where applicable
- relevant infrastructure/providers used by the application
- data use, retention, security, and customer rights sections appropriate to the final business/legal review

The page must not claim legal review or certification that has not occurred.

## C2. Terms of Service

Draft terms reflecting the actual e-commerce workflow, including:

- product purchases
- catalogue/pricing presentation
- cart and checkout
- promo-code rules
- temporary stock reservation
- payment through Paystack
- payment verification
- order confirmation
- cancellation/failed/expired payment behavior where applicable
- delivery terms
- customer responsibilities
- contact/support information placeholders where business details are still pending

The wording should follow the application's actual behavior rather than generic e-commerce assumptions.

## C3. Review requirement

These pages are a first business draft for owner review. Any business-specific wording, contact information, retention periods, jurisdiction, refund policy, delivery policy, or other legal details that require confirmation should remain clearly identifiable for review rather than being silently invented.

## C4. Navigation

Add the pages to the appropriate storefront footer/navigation locations without disrupting existing primary navigation.

## C5. Acceptance criteria

- Privacy Policy page loads from the canonical storefront route.
- Terms of Service page loads from the canonical storefront route.
- Both are responsive and visually consistent with Beulah Foods.
- Content reflects the actual implemented application architecture and checkout/payment behavior.
- No fabricated legal/business details are presented as confirmed facts.

---

# Reserved follow-up groups

The following remain planned but are intentionally not implemented by this document update.

## Group D — Admin loading states

- Orders loading state.
- Transactions loading state.
- Consistent loading/empty/error presentation where required.
- Avoid leaving tables visually static while data is being fetched.

## Group E — Admin announcements

- Admin announcement records.
- Announcement image handling.
- Short supporting description/instructions.
- Page targeting, initially including Homepage, Login, and Signup.
- Display sequence/order.
- Display mode/presentation configuration.
- Customer-facing rendering only on selected pages.
- Keep announcement content separate from authoritative promo-code/checkout logic.

## Group F — Documentation and final context pass

- Update `docs/WORKLOG.md` with completed Groups D/E work and the current state.
- Update implementation/feature documentation where required.
- Record the AI-assistant documentation investigation and the confirmed existing architecture.
- Preserve the existing test/release-gate requirements.

## AI assistant note

The production and older TEST repositories were checked for dedicated AI-assistant/chatbot documentation. No dedicated AI-assistant document was found through the repository searches performed during planning. The existing production architecture documents the storefront, admin, Supabase, and Cloudflare Worker boundaries but does not provide a confirmed chatbot implementation specification. Therefore the AI assistant remains a future implementation item and must not be invented or implemented as part of Groups A–C.

## Safety boundary

All work covered by this plan is for the clean TEST project. Production Supabase, production GitHub, and production Worker/payment configuration must not be changed as part of these tasks.
