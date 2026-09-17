create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  promo_code text not null,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  discount_amount numeric(14,2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists promo_redemptions_promo_code_id_idx on public.promo_redemptions(promo_code_id);
create index if not exists promo_redemptions_created_at_idx on public.promo_redemptions(created_at desc);

alter table public.promo_redemptions enable row level security;

drop policy if exists "Admins can view promo redemptions" on public.promo_redemptions;
create policy "Admins can view promo redemptions"
  on public.promo_redemptions
  for select
  to authenticated
  using (public.is_admin());

insert into public.promo_redemptions (order_id, promo_code_id, promo_code, subtotal, discount_amount, created_at)
select o.id, pc.id, o.promo_code, o.subtotal, o.discount_amount, o.created_at
from public.orders o
left join public.promo_codes pc on pc.code = o.promo_code
where nullif(trim(o.promo_code), '') is not null
on conflict (order_id) do nothing;

create or replace function private.create_pending_order(
  cart_items jsonb,
  delivery_name text,
  delivery_phone text,
  delivery_address text,
  requested_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  uid uuid := auth.uid();
  item jsonb;
  product_row public.products%rowtype;
  item_product_id uuid;
  item_qty integer;
  reserved_qty integer;
  available_qty integer;
  subtotal numeric(14,2) := 0;
  discount numeric(14,2) := 0;
  delivery numeric(14,2) := 0;
  total numeric(14,2);
  order_id uuid;
  reservation_id uuid;
  order_no text;
  promo_code_clean text := nullif(upper(trim(requested_promo_code)), '');
  promo_code_id uuid;
  seen_ids uuid[] := '{}';
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(trim(delivery_name),'') is null or nullif(trim(delivery_phone),'') is null or nullif(trim(delivery_address),'') is null then raise exception 'DELIVERY_DETAILS_REQUIRED'; end if;
  if jsonb_typeof(cart_items) <> 'array' or jsonb_array_length(cart_items) = 0 then raise exception 'CART_EMPTY'; end if;

  for item in select * from jsonb_array_elements(cart_items) loop
    item_product_id := (item->>'productId')::uuid;
    item_qty := (item->>'quantity')::integer;
    if item_qty is null or item_qty <= 0 then raise exception 'INVALID_QUANTITY'; end if;
    if item_product_id = any(seen_ids) then raise exception 'DUPLICATE_PRODUCT'; end if;
    seen_ids := array_append(seen_ids, item_product_id);
  end loop;

  for product_row in
    select * from public.products where id = any(seen_ids) order by id for update
  loop
    null;
  end loop;

  for item in select * from jsonb_array_elements(cart_items) loop
    item_product_id := (item->>'productId')::uuid;
    item_qty := (item->>'quantity')::integer;
    select * into product_row from public.products where id = item_product_id;
    if not found or not product_row.is_active then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    select coalesce(sum(ri.quantity),0) into reserved_qty
      from public.reservation_items ri
      join public.reservations r on r.id = ri.reservation_id
      where ri.product_id = item_product_id and r.status = 'active' and r.expires_at > now();
    available_qty := product_row.stock_quantity - reserved_qty;
    if item_qty > available_qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    subtotal := subtotal + (product_row.price * item_qty);
  end loop;

  select coalesce(ds.delivery_fee,0) into delivery
  from public.delivery_settings ds where ds.is_active = true order by ds.updated_at desc limit 1;
  if not found then delivery := 0; end if;

  if promo_code_clean is not null then
    discount := public.validate_promo(promo_code_clean, subtotal);
    select id into promo_code_id from public.promo_codes where code = promo_code_clean;
  end if;
  total := subtotal - discount + delivery;

  insert into public.orders(customer_id, delivery_name, delivery_phone, delivery_address, subtotal, discount_amount, delivery_fee, total, promo_code, promo_discount)
  values (uid, trim(delivery_name), trim(delivery_phone), trim(delivery_address), subtotal, discount, delivery, total, promo_code_clean, nullif(discount,0))
  returning id, order_number into order_id, order_no;

  for item in select * from jsonb_array_elements(cart_items) loop
    item_product_id := (item->>'productId')::uuid;
    item_qty := (item->>'quantity')::integer;
    select name, price into product_row.name, product_row.price from public.products where id = item_product_id;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, line_total)
    values (order_id, item_product_id, product_row.name, product_row.price, item_qty, product_row.price * item_qty);
  end loop;

  insert into public.reservations(order_id, customer_id, status, expires_at)
  values (order_id, uid, 'active', now() + interval '15 minutes')
  returning id into reservation_id;

  for item in select * from jsonb_array_elements(cart_items) loop
    insert into public.reservation_items(reservation_id, product_id, quantity)
    values (reservation_id, (item->>'productId')::uuid, (item->>'quantity')::integer);
  end loop;

  if promo_code_clean is not null then
    insert into public.promo_redemptions(order_id, promo_code_id, promo_code, subtotal, discount_amount)
    values (order_id, promo_code_id, promo_code_clean, subtotal, discount);
    update public.promo_codes set usage_count = usage_count + 1 where code = promo_code_clean;
  end if;

  return jsonb_build_object('order_id',order_id,'reservation_id',reservation_id,'order_number',order_no,'subtotal',subtotal,'discount',discount,'discount_amount',discount,'delivery_fee',delivery,'delivery_enabled',delivery > 0,'total',total,'expires_at',(select expires_at from public.reservations where id=reservation_id));
end;
$function$;
