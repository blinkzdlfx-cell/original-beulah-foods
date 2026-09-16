// Customer authentication service.
//
// This is the only file that should call supabase.auth.* for customer
// accounts. Pages import functions from here instead of touching the
// Supabase client directly (see ARCHITECTURE.md).
//
// No UI here — these functions are the foundation that a signup/login
// page will call once that page exists.

import { supabase } from "../lib/supabaseClient.js";

export async function signUpCustomer({ fullName, email, password }) {
  const verificationRedirect = new URL("verification-success.html", `${window.location.origin}/`)
    .href;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: verificationRedirect,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInCustomer({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOutCustomer() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}

export async function requestPasswordReset(email, redirectTo) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}
