begin;

-- Reads current database state instead of stale or editable JWT role metadata.
create function private.active_role() returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active;
$$;
revoke all on function private.active_role() from public, anon, authenticated;
grant execute on function private.active_role() to authenticated;
grant select on public.profiles, public.departments, public.categories to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (
  (id = (select auth.uid()) and is_active) or (select private.active_role()) = 'administrator'
);
create policy departments_read on public.departments for select to authenticated using (
  (select private.active_role()) is not null and (is_active or (select private.active_role()) = 'administrator')
);
create policy categories_read on public.categories for select to authenticated using (
  (select private.active_role()) is not null and (is_active or (select private.active_role()) = 'administrator')
);

create function public.update_my_profile(p_display_name text) returns setof public.profiles language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles p where p.id = auth.uid() and p.is_active for update;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 100 then raise exception 'invalid_input' using errcode = '22023'; end if;
  return query update public.profiles set display_name = btrim(p_display_name) where id = auth.uid() returning *;
end;
$$;

create function public.admin_update_user(
  p_target_id uuid, p_role public.app_role, p_department_id uuid,
  p_is_active boolean, p_display_name text
) returns setof public.profiles language plpgsql security definer set search_path = '' as $$
declare
  previous public.profiles;
  updated public.profiles;
begin
  -- All administration changes share this lock, including last-admin checks.
  perform pg_catalog.pg_advisory_xact_lock(15, 1761);
  perform 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role = 'administrator' for update;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into previous from public.profiles p where p.id = p_target_id for update;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_role is null or p_is_active is null or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 100 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_role = 'officer' then
    perform 1 from public.departments d where d.id = p_department_id and d.is_active for share;
    if not found then raise exception 'invalid_input' using errcode = '22023'; end if;
  elsif p_department_id is not null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if previous.role = 'administrator' and previous.is_active and (p_role <> 'administrator' or not p_is_active)
    and not exists(select 1 from public.profiles p where p.role = 'administrator' and p.is_active and p.id <> p_target_id) then
    raise exception 'last_administrator' using errcode = '23514';
  end if;
  if (not p_is_active or p_role <> 'officer' or p_department_id is distinct from previous.department_id)
    and exists(select 1 from public.complaints c where c.assigned_officer_id = p_target_id and c.status <> 'resolved') then
    raise exception 'unresolved_assignments' using errcode = '23514';
  end if;
  update public.profiles set display_name = btrim(p_display_name), role = p_role, department_id = p_department_id, is_active = p_is_active
    where id = p_target_id returning * into updated;
  insert into private.admin_audit_events(actor_id, action, target_id, changes)
    values(auth.uid(), 'user_updated', p_target_id, jsonb_build_object(
      'before', jsonb_build_object('display_name',previous.display_name,'role',previous.role,'department_id',previous.department_id,'is_active',previous.is_active),
      'after', jsonb_build_object('display_name',updated.display_name,'role',updated.role,'department_id',updated.department_id,'is_active',updated.is_active)
    ));
  return next updated;
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon, authenticated;
revoke all on function public.admin_update_user(uuid, public.app_role, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.admin_update_user(uuid, public.app_role, uuid, boolean, text) to authenticated;

commit;
