# Frontend Import

The `feature/frontend-foundation` branch imports the previous customer storefront from `blinkzdlfx-cell/Beulah-foods` as the visual and interaction foundation.

Imported scope:

- storefront HTML pages
- storefront CSS
- storefront vanilla JavaScript
- storefront static assets required by those pages

Excluded from the import:

- previous Supabase migrations
- previous payment Worker implementation
- previous database state
- previous admin application
- provider secrets/configuration

The imported frontend is a starting point. Authentication, cart behavior, checkout, Paystack integration, and backend calls will be reviewed and rebuilt against the new contracts before deployment.
