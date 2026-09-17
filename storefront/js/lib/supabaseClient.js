// Storefront Supabase browser client.
// Only the public project URL and publishable key belong in browser code.
// Never put a secret key or payment secret in this file.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../components/navActive.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../config.js";

export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: "beulah-storefront-auth",
  },
});
