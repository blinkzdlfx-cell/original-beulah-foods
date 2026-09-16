# Beulah Foods — Clean Rebuild

This repository is a clean rebuild of the Beulah Foods storefront and backend integration.

## Rebuild principles

- Preserve the existing customer-facing visual experience where practical.
- Rebuild backend state and payment integration from a clean Supabase project.
- Keep Supabase as the business-data source of truth.
- Use Cloudflare Workers for the static storefront and the privileged Paystack server boundary.
- Never expose Paystack secret keys or Supabase service-role keys to browser code.
- Keep final order totals, stock, reservations, and payment state authoritative on the server.
- Use localStorage as the customer cart source for browser persistence; fetch authoritative product data from Supabase when rendering.
- Build and verify each subsystem before end-to-end checkout testing.

## Current status

The repository was created empty and is being populated deliberately. Infrastructure credentials/configuration will be connected after the code and contracts are established.

## Source audit

The previous application was audited from `blinkzdlfx-cell/Beulah-foods`. The old repository contains storefront HTML/CSS/JavaScript, admin code, Supabase migrations, tests, Cloudflare Worker code, and historical checkout/payment changes. Only reusable customer-facing frontend assets are being carried forward; backend/payment code is being rebuilt rather than copied wholesale.
