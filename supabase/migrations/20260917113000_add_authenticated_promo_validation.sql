create or replace function public.validate_promo(p_code text, p_subtotal numeric)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  return private.validate_promo(p_code, p_subtotal);
end;
$$;

revoke all on function public.validate_promo(text, numeric) from public;
revoke execute on function public.validate_promo(text, numeric) from anon;
grant execute on function public.validate_promo(text, numeric) to authenticated;
grant execute on function public.validate_promo(text, numeric) to service_role;

notify pgrst, 'reload schema';
