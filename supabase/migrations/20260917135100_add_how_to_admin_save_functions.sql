create or replace function public.admin_save_how_to_guide(p_product_id uuid, p_title text, p_description text, p_is_active boolean, p_steps jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid; v_step jsonb; v_number integer := 0;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_product_id is null or coalesce(trim(p_title),'') = '' then raise exception 'GUIDE_REQUIRED'; end if;
  insert into public.how_to_guides(product_id,title,description,is_active) values(p_product_id,trim(p_title),nullif(trim(coalesce(p_description,'')),''),coalesce(p_is_active,true))
  on conflict(product_id) do update set title=excluded.title, description=excluded.description, is_active=excluded.is_active returning id into v_id;
  delete from public.how_to_steps where guide_id=v_id;
  for v_step in select value from jsonb_array_elements(coalesce(p_steps,'[]'::jsonb)) loop
    if coalesce(trim(v_step->>'description'),'') <> '' then
      v_number := v_number + 1;
      insert into public.how_to_steps(guide_id,step_number,title,description) values(v_id,v_number,nullif(trim(coalesce(v_step->>'title','')),''),trim(v_step->>'description'));
    end if;
  end loop;
  return v_id;
end; $$;
create or replace function public.admin_save_how_to_order(p_title text, p_description text, p_is_active boolean, p_steps jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid; v_step jsonb; v_number integer := 0;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if coalesce(trim(p_title),'') = '' then raise exception 'ORDER_GUIDE_REQUIRED'; end if;
  select id into v_id from public.how_to_order limit 1;
  if v_id is null then insert into public.how_to_order(title,description,is_active) values(trim(p_title),nullif(trim(coalesce(p_description,'')),''),coalesce(p_is_active,true)) returning id into v_id;
  else update public.how_to_order set title=trim(p_title), description=nullif(trim(coalesce(p_description,'')),''), is_active=coalesce(p_is_active,true) where id=v_id; end if;
  delete from public.how_to_order_steps where guide_id=v_id;
  for v_step in select value from jsonb_array_elements(coalesce(p_steps,'[]'::jsonb)) loop
    if coalesce(trim(v_step->>'description'),'') <> '' then
      v_number := v_number + 1;
      insert into public.how_to_order_steps(guide_id,step_number,title,description) values(v_id,v_number,nullif(trim(coalesce(v_step->>'title','')),''),trim(v_step->>'description'));
    end if;
  end loop;
  return v_id;
end; $$;
revoke all on function public.admin_save_how_to_guide(uuid,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_how_to_guide(uuid,text,text,boolean,jsonb) to authenticated, service_role;
revoke all on function public.admin_save_how_to_order(text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_how_to_order(text,text,boolean,jsonb) to authenticated, service_role;
