// Storefront Supabase browser client.
//
// Only the public project URL and anon key belong in browser code.
// Never put a service-role key or payment secret in this file.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../components/navActive.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

export { SUPABASE_URL, SUPABASE_ANON_KEY };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: "beulah-storefront-auth",
  },
});
