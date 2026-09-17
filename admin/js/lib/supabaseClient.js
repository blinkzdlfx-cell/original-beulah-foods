// Admin Supabase client for the isolated original Beulah Foods environment.
// Only the browser-safe publishable key is used here. Never place a secret key in this file.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../../storefront/js/config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: "beulah-admin-auth",
  },
});
