import { supabase } from "../lib/supabaseClient.js";

export async function getCustomerProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("customer_profiles")
    .select("id, full_name, phone, address, created_at, updated_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateCustomerProfile({ fullName, phone, address }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("You must be signed in to update your profile.");

  const { data, error } = await supabase
    .from("customer_profiles")
    .update({
      full_name: fullName,
      phone,
      address,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userData.user.id)
    .select("id, full_name, phone, address, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}
