create or replace function private.create_paystack_payment_attempt(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, auth
as $function$
declare
  uid uuid := auth.uid();
  o public.orders%rowtype;
  existing public.payments%rowtype;
  ref text;
  payment_id uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into o
  from public.orders
  where id = target_order_id and customer_id = uid
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status <> 'pending_payment' or o.payment_status <> 'pending' then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if not exists (
    select 1 from public.reservations
    where order_id = o.id and status = 'active' and expires_at > now()
  ) then raise exception 'ORDER_RESERVATION_EXPIRED'; end if;

  select * into existing
  from public.payments
  where order_id = o.id and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'payment_id', existing.id,
      'reference', existing.reference,
      'amount', existing.amount,
      'currency', existing.currency,
      'order_id', existing.order_id,
      'reused', true
    );
  end if;

  ref := 'BEULAH-' || o.order_number || '-' || replace(gen_random_uuid()::text,'-','');
  insert into public.payments(order_id, reference, amount, currency, status)
  values(o.id, ref, o.total, 'NGN', 'pending')
  returning id into payment_id;

  return jsonb_build_object(
    'payment_id', payment_id,
    'reference', ref,
    'amount', o.total,
    'currency', 'NGN',
    'order_id', o.id,
    'reused', false
  );
end;
$function$;
