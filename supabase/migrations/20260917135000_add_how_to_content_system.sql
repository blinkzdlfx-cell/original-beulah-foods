create table if not exists public.how_to_guides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);
create table if not exists public.how_to_steps (
  id uuid primary key default gen_random_uuid(), guide_id uuid not null references public.how_to_guides(id) on delete cascade,
  step_number integer not null check (step_number > 0), title text, description text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (guide_id, step_number)
);
create table if not exists public.how_to_order (
  id uuid primary key default gen_random_uuid(), title text not null default 'How to Order', description text,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.how_to_order_steps (
  id uuid primary key default gen_random_uuid(), guide_id uuid not null references public.how_to_order(id) on delete cascade,
  step_number integer not null check (step_number > 0), title text, description text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (guide_id, step_number)
);
create unique index if not exists how_to_order_singleton_idx on public.how_to_order ((true));
alter table public.how_to_guides enable row level security;
alter table public.how_to_steps enable row level security;
alter table public.how_to_order enable row level security;
alter table public.how_to_order_steps enable row level security;
create policy "how_to_guides_public_read_active" on public.how_to_guides for select to anon, authenticated using (is_active = true);
create policy "how_to_guides_admin_all" on public.how_to_guides for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "how_to_steps_public_read" on public.how_to_steps for select to anon, authenticated using (exists (select 1 from public.how_to_guides g where g.id = guide_id and g.is_active = true));
create policy "how_to_steps_admin_all" on public.how_to_steps for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "how_to_order_public_read_active" on public.how_to_order for select to anon, authenticated using (is_active = true);
create policy "how_to_order_admin_all" on public.how_to_order for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "how_to_order_steps_public_read" on public.how_to_order_steps for select to anon, authenticated using (exists (select 1 from public.how_to_order h where h.id = guide_id and h.is_active = true));
create policy "how_to_order_steps_admin_all" on public.how_to_order_steps for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.how_to_guides, public.how_to_steps, public.how_to_order, public.how_to_order_steps to anon, authenticated;
grant insert, update, delete on public.how_to_guides, public.how_to_steps, public.how_to_order, public.how_to_order_steps to authenticated;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists how_to_guides_updated_at on public.how_to_guides; create trigger how_to_guides_updated_at before update on public.how_to_guides for each row execute function public.set_updated_at();
drop trigger if exists how_to_steps_updated_at on public.how_to_steps; create trigger how_to_steps_updated_at before update on public.how_to_steps for each row execute function public.set_updated_at();
drop trigger if exists how_to_order_updated_at on public.how_to_order; create trigger how_to_order_updated_at before update on public.how_to_order for each row execute function public.set_updated_at();
drop trigger if exists how_to_order_steps_updated_at on public.how_to_order_steps; create trigger how_to_order_steps_updated_at before update on public.how_to_order_steps for each row execute function public.set_updated_at();
