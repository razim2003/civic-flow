-- Accounts registered before the signup trigger also need an application profile.
-- Existing profiles, activation state and privileged roles are never changed.
begin;

insert into public.profiles(id, display_name, role, is_active, department_id)
select
  u.id,
  left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), 'Citizen'), 100),
  'citizen'::public.app_role,
  true,
  null
from auth.users u
where not coalesce(u.is_anonymous, false)
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Refresh PostgREST metadata after the initial schema rollout.
notify pgrst, 'reload schema';

commit;
