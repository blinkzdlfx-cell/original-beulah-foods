# Next Feature Plan — Beulah Foods

Status: Groups A–C implemented in TEST. Groups D–F remain planned.

Repository: `blinkzdlfx-cell/original-beulah-foods`

Environment: TEST only. Production resources remain out of scope.

## Working rule

Implementation is done in wider, logically grouped chunks rather than one isolated micro-change at a time. Each group should touch only the files, database objects, and assets required for that group. Existing working Paystack, reservation, stock, checkout, and payment-finalization behavior must not be rewritten unnecessarily.

---

# Group A — Brand assets, favicon, and admin asset separation

**Status: Implemented.**

- Storefront continues using the dedicated `storefront/assets/favicon.webp` favicon and now declares it explicitly, including an Apple touch icon declaration.
- Added admin-owned `admin/assets/favicon.svg` for the dashboard and admin pages.
- Added admin-owned `admin/assets/beulah-admin-logo.svg` and switched dashboard, Orders, Transactions, and How To admin branding to that asset location.
- Admin pages no longer need the storefront asset path for their visible brand logo/favicon.
- No Paystack, checkout, reservation, stock, or payment-finalization logic was changed for this group.

Acceptance checkpoint: deploy and verify favicon/logo requests in browser Network/Console on both storefront and admin.

---

# Group B — How To content system

**Status: Implemented in TEST.**

## Database

Added:

- `how_to_guides` — one guide per product, title/description/active state.
- `how_to_steps` — ordered steps for product guides.
- `how_to_order` — singleton ordering guide.
- `how_to_order_steps` — ordered ordering-guide steps.

All four tables have RLS. Public/anonymous and authenticated customers can read only active published content. Admin-authenticated users can manage content through admin authorization. Dedicated `SECURITY DEFINER` admin save functions keep guide + step replacement transactional.

## Admin

Added `/admin/how-to.html` with controls to:

- select a product
- create/edit its guide title and description
- publish/unpublish the guide
- add/remove any number of steps
- edit step titles/descriptions
- save the guide
- create/edit the How To Order guide
- publish/unpublish the ordering guide
- add/remove/edit any number of ordering steps

## Storefront

Added `/how-to.html`.

The page reads active real content from Supabase and displays product-specific preparation/use guides, ordered instructional steps, and the separate How To Order guide with loading/empty/error handling.

No mock instructional records were inserted.

Acceptance checkpoint: create one real product guide and one real ordering guide in admin, then verify they appear on the storefront.

---

# Group C — Privacy Policy and Terms of Service

**Status: Implemented as owner-review drafts.**

Added:

- `/privacy-policy.html`
- `/terms-of-service.html`
- shared legal styling/behavior.

The drafts reflect the implemented account, profile, cart, order, reservation, promo, Paystack, Supabase, and Cloudflare behavior. They deliberately do not claim legal review/certification or invent business details that still require owner confirmation.

Added links to How To and legal pages in the storefront home footer and How To footer.

Owner review remains required for business/legal specifics such as contact details, retention periods, refund policy, delivery policy, governing jurisdiction, and other legal details requiring explicit confirmation.

Acceptance checkpoint: review both drafts before treating them as final legal copy.

---

# Reserved follow-up groups

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

- Update `docs/WORKLOG.md` with completed Groups D/E work and current state.
- Update implementation/feature documentation where required.
- Record the AI-assistant documentation investigation and confirmed architecture.
- Preserve existing test/release-gate requirements.

## AI assistant note

The production and older TEST repositories were checked for dedicated AI-assistant/chatbot documentation. No dedicated AI-assistant document was found through the repository searches performed during planning. The existing production architecture documents the storefront, admin, Supabase, and Cloudflare Worker boundaries but does not provide a confirmed chatbot implementation specification. Therefore the AI assistant remains a future implementation item and must not be invented or implemented as part of Groups A–C.

## Safety boundary

All work covered by this plan is for the clean TEST project. Production Supabase, production GitHub, and production Worker/payment configuration must not be changed as part of these tasks.
