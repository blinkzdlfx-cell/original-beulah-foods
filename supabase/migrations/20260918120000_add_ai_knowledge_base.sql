create table if not exists public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'general' check (category in ('general','how_to','cooking','ordering','product','delivery','faq','policy')),
  content text not null,
  tags text[] not null default '{}'::text[],
  search_vector tsvector,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_knowledge_search_idx on public.ai_knowledge using gin (search_vector);
create index if not exists ai_knowledge_category_idx on public.ai_knowledge(category);
create index if not exists ai_knowledge_active_idx on public.ai_knowledge(is_active);

create or replace function public.ai_knowledge_set_search_vector()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.search_vector := to_tsvector(
    'simple',
    coalesce(new.title,'') || ' ' || coalesce(new.content,'') || ' ' || coalesce(array_to_string(new.tags,' '),'')
  );
  return new;
end;
$$;

alter table public.ai_knowledge enable row level security;

drop policy if exists "ai_knowledge_admin_all" on public.ai_knowledge;
create policy "ai_knowledge_admin_all"
on public.ai_knowledge for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

grant select, insert, update, delete on public.ai_knowledge to authenticated;

drop trigger if exists ai_knowledge_search_vector on public.ai_knowledge;
create trigger ai_knowledge_search_vector
before insert or update of title,content,tags on public.ai_knowledge
for each row execute function public.ai_knowledge_set_search_vector();

drop trigger if exists ai_knowledge_updated_at on public.ai_knowledge;
create trigger ai_knowledge_updated_at
before update on public.ai_knowledge
for each row execute function public.set_updated_at();

create or replace function public.search_ai_knowledge(p_query text, p_limit integer default 6)
returns table (
  id uuid,
  title text,
  category text,
  content text,
  tags text[],
  rank real
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select k.id,k.title,k.category,k.content,k.tags,
    ts_rank(k.search_vector, websearch_to_tsquery('simple', p_query)) as rank
  from public.ai_knowledge k
  where k.is_active = true
    and k.search_vector @@ websearch_to_tsquery('simple', p_query)
  order by rank desc, k.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 6), 10));
$$;

revoke all on function public.search_ai_knowledge(text,integer) from public, anon;
grant execute on function public.search_ai_knowledge(text,integer) to authenticated, service_role;
