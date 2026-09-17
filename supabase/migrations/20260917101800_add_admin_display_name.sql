alter table public.admin_users
  add column if not exists display_name text;

update public.admin_users au
set display_name = coalesce(nullif(split_part(u.email, '@', 1), ''), 'Administrator')
from auth.users u
where u.id = au.user_id
  and au.display_name is null;

comment on column public.admin_users.display_name is
  'Optional administrator display name shown by the admin UI';
