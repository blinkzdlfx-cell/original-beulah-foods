create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text not null default '',
  image_path text,
  target_page text not null default 'home' check (target_page in ('home','shop','how-to','cart','checkout','account','all')),
  sort_order integer not null default 0 check (sort_order >= 0),
  display_mode text not null default 'card' check (display_mode in ('banner','card')),
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

alter table public.announcements enable row level security;

create policy "public can read active announcements"
on public.announcements for select to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
);

create policy "admins manage announcements"
on public.announcements for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create index if not exists announcements_target_order_idx
on public.announcements (target_page, sort_order, created_at desc);

create index if not exists announcements_active_window_idx
on public.announcements (is_active, starts_at, expires_at);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('announcement-images','announcement-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create policy "public can read announcement images"
on storage.objects for select to public
using (bucket_id = 'announcement-images');

create policy "admins upload announcement images"
on storage.objects for insert to authenticated
with check (bucket_id = 'announcement-images' and public.is_admin());

create policy "admins update announcement images"
on storage.objects for update to authenticated
using (bucket_id = 'announcement-images' and public.is_admin())
with check (bucket_id = 'announcement-images' and public.is_admin());

create policy "admins delete announcement images"
on storage.objects for delete to authenticated
using (bucket_id = 'announcement-images' and public.is_admin());