-- Announcement display v2
-- Keeps existing data intact while introducing a structured presentation/behavior model.

alter table public.announcements
  add column if not exists display_type text not null default 'inline',
  add column if not exists cta_text text,
  add column if not exists cta_url text,
  add column if not exists dismissible boolean not null default true,
  add column if not exists show_once boolean not null default false;

update public.announcements
set display_type = case
  when display_mode = 'banner' then 'banner'
  else 'inline'
end
where display_type = 'inline';

alter table public.announcements
  drop constraint if exists announcements_display_type_check;

alter table public.announcements
  add constraint announcements_display_type_check
  check (display_type in ('inline','banner','featured','modal'));

alter table public.announcements
  drop constraint if exists announcements_target_page_check;

alter table public.announcements
  add constraint announcements_target_page_check
  check (target_page in ('home','shop','how-to','cart','checkout','account','login','signup','all'));

alter table public.announcements
  drop constraint if exists announcements_cta_url_check;

alter table public.announcements
  add constraint announcements_cta_url_check
  check (
    cta_url is null
    or cta_url = ''
    or cta_url like '/%'
    or cta_url ~* '^https?://'
  );
