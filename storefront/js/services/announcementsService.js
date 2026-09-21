import { supabase } from "../lib/supabaseClient.js";

const PAGE_MAP = {
  home: "home",
  index: "home",
  shop: "shop",
  "how-to": "how-to",
  cart: "cart",
  checkout: "checkout",
  account: "account",
  login: "login",
  signup: "signup",
};

export async function loadAnnouncements(page) {
  const target = PAGE_MAP[page] || page;
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,short_description,image_path,target_page,sort_order,display_mode,display_type,cta_text,cta_url,dismissible,show_once,updated_at")
    .in("target_page", [target, "all"])
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export function announcementImage(path) {
  return path
    ? supabase.storage.from("announcement-images").getPublicUrl(path).data.publicUrl
    : "";
}
