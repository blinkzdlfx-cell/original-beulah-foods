import { supabase } from "../lib/supabaseClient.js";

export async function getAdminSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id, display_name")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data ? { session, admin: data } : null;
}

export async function signInAdmin({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id, display_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) {
    await supabase.auth.signOut();
    throw adminError;
  }
  if (!admin) {
    await supabase.auth.signOut();
    throw new Error("This account is not authorized for the Beulah Foods admin area.");
  }
  return { session: data.session, admin };
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
