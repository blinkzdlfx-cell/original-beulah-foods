create or replace function private.finalize_paystack_payment(p_reference text, p_provider_transaction_id text default null, p_amount_ngn numeric default null, p_currency text default 'NGN', p_provider_status text default 'success', p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, auth
as $function$
declare
  pay public.payments%rowtype;
  o public.orders%rowtype;
  r public.reservations%rowtype;
  ri record;
  p public.products%rowtype;
  provider_status text := lower(coalesce(p_provider_status,''));
  next_status text;
begin
  select * into pay from public.payments where reference=p_reference for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  select * into o from public.orders where id=pay.order_id for update;

  if pay.status='successful' then
    return jsonb_build_object('status','successful','order_id',o.id,'reference',pay.reference,'idempotent',true);
  end if;

  if upper(coalesce(p_currency,'')) <> 'NGN' or o.currency <> 'NGN' then
    raise exception 'PAYMENT_CURRENCY_MISMATCH';
  end if;

  if p_amount_ngn is null or round(p_amount_ngn,2) <> round(pay.amount,2) or round(p_amount_ngn,2) <> round(o.total,2) then
    raise exception 'PAYMENT_AMOUNT_MISMATCH';
  end if;

  if provider_status <> 'success' then
    next_status := case
      when provider_status = 'abandoned' then 'abandoned'
      when provider_status in ('pending','ongoing','processing') then 'pending'
      else 'failed'
    end;

    update public.payments
    set status=next_status,
        provider_transaction_id=coalesce(p_provider_transaction_id,provider_transaction_id),
        provider_metadata=coalesce(p_metadata,'{}'::jsonb),
        updated_at=now()
    where id=pay.id;

    update public.orders
    set payment_status=next_status,
        updated_at=now()
    where id=o.id and payment_status='pending';

    return jsonb_build_object('status',next_status,'order_id',o.id,'reference',pay.reference);
  end if;

  select * into r
  from public.reservations
  where order_id=o.id and status='active'
  order by created_at desc
  limit 1
  for update;

  if not found or r.expires_at <= now() then
    update public.payments
    set status='late_payment',
        provider_transaction_id=coalesce(p_provider_transaction_id,provider_transaction_id),
        provider_metadata=coalesce(p_metadata,'{}'::jsonb),
        updated_at=now()
    where id=pay.id;

    update public.orders set payment_status='late_payment',updated_at=now() where id=o.id;
    if found then
      update public.reservations set status='expired',released_at=now() where id=r.id and status='active';
    end if;

    return jsonb_build_object('status','late_payment','order_id',o.id,'reference',pay.reference,'manual_resolution_required',true);
  end if;

  for ri in select * from public.reservation_items where reservation_id=r.id loop
    select * into p from public.products where id=ri.product_id for update;
    if p.stock_quantity < ri.quantity then
      update public.payments
      set status='manual_resolution_required',
          provider_transaction_id=coalesce(p_provider_transaction_id,provider_transaction_id),
          provider_metadata=coalesce(p_metadata,'{}'::jsonb),
          updated_at=now()
      where id=pay.id;

      update public.orders set payment_status='manual_resolution_required',updated_at=now() where id=o.id;
      return jsonb_build_object('status','manual_resolution_required','order_id',o.id,'reference',pay.reference);
    end if;
  end loop;

  for ri in select * from public.reservation_items where reservation_id=r.id loop
    update public.products set stock_quantity=stock_quantity-ri.quantity where id=ri.product_id;
  end loop;

  update public.payments
  set status='successful',
      provider_transaction_id=coalesce(p_provider_transaction_id,provider_transaction_id),
      provider_metadata=coalesce(p_metadata,'{}'::jsonb),
      completed_at=now(),
      updated_at=now()
  where id=pay.id;

  update public.orders
  set status='paid',payment_status='successful',paid_at=now(),updated_at=now()
  where id=o.id;

  update public.reservations set status='completed',completed_at=now() where id=r.id;

  return jsonb_build_object('status','successful','order_id',o.id,'reference',pay.reference,'idempotent',false);
end;
$function$;
