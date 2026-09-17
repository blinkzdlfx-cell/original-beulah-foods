# Admin provisioning and auth UI

## Scope

This pass applies only to the clean `original-beulah-foods` TEST environment and repository.

## Admin accounts provisioned

The two existing Supabase Auth users were verified by email and provisioned in `public.admin_users` with:

- role: `admin`
- is_active: `true`

Provisioned accounts:

- `beulahfoods2025@gmail.com`
- `brilinadev@gmail.com`

No production Supabase project or production repository was modified.

## Authorization model

The admin UI continues to require a signed-in Supabase user and a positive `is_admin()` authorization check. Being an Auth user alone does not grant admin access.

## UI consistency pass

Substantive changes only:

- Admin login, dashboard, orders, and transactions use the Beulah Foods visual language and green accent already established by the storefront.
- The canonical `beulah-logo.webp` and `favicon.webp` are used instead of a separate `BF`/`B` text mark where applicable.
- Admin login received a simple branded identity block without adding another dashboard framework or decorative layer.
- Customer login/signup now use the canonical logo and favicon.
- Removed decorative floating symbols, animated background elements, and the hover underline from the customer authentication visual layer. These were not required for authentication or navigation.
- Kept the admin dashboard operational structure intact: catalogue, categories, delivery settings, promo codes, orders, and transactions. No mock data or unnecessary feature area was added.
- Responsive navigation and reduced-motion handling remain supported.

## Verification

The admin records were re-queried after provisioning and both requested emails returned `role=admin` and `is_active=true`.

The UI changes are committed directly to the repository's `main` branch. External Cloudflare deployment remains a separate release/acceptance step and is not claimed as completed by this document.
