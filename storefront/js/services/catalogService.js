import { supabase } from "../lib/supabaseClient.js";

const PRODUCT_IMAGE_BUCKET = "product-images";
const CACHE_PREFIX = "beulah-catalog-v1:";
const CACHE_TTL_MS = 60 * 1000;

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.data || !Number.isFinite(entry.cachedAt)) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // Storage is optional; Supabase remains the source of truth.
  }
}

async function getOrRefresh(key, fetcher) {
  const cached = readCache(key);
  if (cached) {
    if (Date.now() - cached.cachedAt >= CACHE_TTL_MS) {
      fetcher().then((data) => writeCache(key, data)).catch(() => {});
    }
    return cached.data;
  }
  const data = await fetcher();
  writeCache(key, data);
  return data;
}

function getProductImageUrl(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

async function getReservedQuantities(productIds) {
  const ids = [...new Set(productIds.map(String).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("reservation_items")
    .select("product_id, quantity, reservations!inner(status, expires_at)")
    .in("product_id", ids)
    .eq("reservations.status", "active")
    .gt("reservations.expires_at", new Date().toISOString());

  if (error) throw error;

  const reserved = new Map();
  for (const row of data ?? []) {
    reserved.set(row.product_id, (reserved.get(row.product_id) ?? 0) + Number(row.quantity || 0));
  }
  return reserved;
}

function withAvailableStock(product, reservedMap) {
  const physicalStock = Math.max(0, Number(product.stock_quantity) || 0);
  const reservedStock = Math.max(0, Number(reservedMap.get(product.id) || 0));
  return {
    ...product,
    reserved_quantity: reservedStock,
    stock_quantity: Math.max(0, physicalStock - reservedStock),
    image_src: getProductImageUrl(product.image_path),
  };
}

export async function getCategories() {
  return getOrRefresh("categories", async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export async function getFeaturedProducts({ limit = 4 } = {}) {
  const safeLimit = Math.min(12, Math.max(1, Number.parseInt(limit, 10) || 4));
  return (async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, category_id, name, slug, description, price, image_path, stock_quantity, is_featured, categories(name, slug)")
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(safeLimit);
    if (error) throw error;
    const rows = data ?? [];
    const reserved = await getReservedQuantities(rows.map((row) => row.id));
    return rows.map((product) => withAvailableStock(product, reserved));
  })();
}

export async function getHomepageCategories({ limit = 6 } = {}) {
  const safeLimit = Math.min(12, Math.max(1, Number.parseInt(limit, 10) || 6));
  return (async () => {
    const { data: categories, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, slug, description, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (categoryError) throw categoryError;

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("category_id")
      .eq("is_active", true)
      .not("category_id", "is", null);
    if (productError) throw productError;

    const counts = new Map();
    for (const product of products ?? []) {
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }

    return (categories ?? [])
      .map((category) => ({ ...category, product_count: counts.get(category.id) ?? 0 }))
      .filter((category) => category.product_count > 0)
      .slice(0, safeLimit);
  })();
}

export async function getProducts({ categorySlug = "", page = 1, pageSize = 12 } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 12));

  return (async () => {
    let query = supabase
      .from("products")
      .select("id, category_id, name, slug, description, price, image_path, stock_quantity, is_featured", { count: "exact" })
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (categorySlug) {
      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .eq("is_active", true)
        .maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) return { products: [], count: 0, page: safePage, pageSize: safePageSize, totalPages: 0 };
      query = query.eq("category_id", category.id);
    }

    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    const rows = data ?? [];
    const reserved = await getReservedQuantities(rows.map((row) => row.id));
    return {
      products: rows.map((product) => withAvailableStock(product, reserved)),
      count: count ?? 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil((count ?? 0) / safePageSize),
    };
  })();
}

export async function getProductsByIds(ids = []) {
  const productIds = [...new Set(ids.map(String).filter(Boolean))].sort();
  if (!productIds.length) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, category_id, name, slug, description, price, image_path, stock_quantity, is_featured")
    .in("id", productIds)
    .eq("is_active", true);
  if (error) throw error;
  const rows = data ?? [];
  const reserved = await getReservedQuantities(rows.map((row) => row.id));
  return rows.map((product) => withAvailableStock(product, reserved));
}

export async function getProductBySlug(slug) {
  const { data, error } = await supabase
    .from("products")
    .select("id, category_id, name, slug, description, price, image_path, stock_quantity, is_featured, categories(name, slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const reserved = await getReservedQuantities([data.id]);
  return withAvailableStock(data, reserved);
}
