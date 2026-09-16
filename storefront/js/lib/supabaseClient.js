// Storefront Supabase client.
//
// The storefront and admin dashboard use the same Supabase project, but
// deliberately use different Auth storage keys so an admin session cannot
// become the storefront customer session (and vice versa).
//
// The anon/public key is safe to use in browser code. NEVER put the
// service_role key here or anywhere else in /storefront.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../components/navActive.js";

const SUPABASE_URL = "https://wcyztayuulzxchkljdoo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjeXp0YXl1dWx6eGNoa2xqZG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjY3NjEsImV4cCI6MjEwNDY0Mjc2MX0.ALaX08krMhTTAR01YRBYdI_KME3CdkeSYtbHcC2e5NY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: "beulah-storefront-auth",
  },
});
