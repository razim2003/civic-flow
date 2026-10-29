-- CF-20: audited Administrator category maintenance. Categories are deactivated,
-- never deleted; a referenced category's routing department cannot change.
-- Installation creates one RPC; no existing category or complaint is changed.
begin;

create function public.admin_upsert_category(p_id uuid,p_name text,p_description text,p_department_id uuid,p_is_active boolean)
returns setof public.categories language plpgsql security definer set search_path='' as $$
declare
  previous public.categories;
  updated public.categories;
  clean_name text := btrim(p_name);
  clean_description text := nullif(btrim(p_description),'');
begin
  -- Shared administration lock serializes category, user and workflow changes.
  perform pg_catalog.pg_advisory_xact_lock(15,1761);
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='administrator' for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 100
    or char_length(coalesce(clean_description,''))>500 or p_department_id is null or p_is_active is null then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  -- An active category must route to an active department.
  perform 1 from public.departments d where d.id=p_department_id and (d.is_active or not p_is_active) for share;
  if not found then raise exception 'department_unavailable' using errcode='22023'; end if;
  if exists(select 1 from public.categories c where lower(c.name)=lower(clean_name) and c.id is distinct from p_id) then
    raise exception 'category_name_taken' using errcode='23505';
  end if;

  if p_id is null then
    insert into public.categories(name,description,department_id,is_active)
      values(clean_name,clean_description,p_department_id,p_is_active) returning * into updated;
    insert into private.admin_audit_events(actor_id,action,target_id,changes)
      values(auth.uid(),'category_created',updated.id,jsonb_build_object('after',jsonb_build_object(
        'name',updated.name,'description',updated.description,'department_id',updated.department_id,'is_active',updated.is_active)));
    return next updated; return;
  end if;

  select * into previous from public.categories c where c.id=p_id for update;
  if not found then raise exception 'invalid_input' using errcode='22023'; end if;
  if previous.department_id<>p_department_id and exists(select 1 from public.complaints c where c.category_id=p_id) then
    raise exception 'category_in_use' using errcode='23514';
  end if;
  if previous.name=clean_name and previous.description is not distinct from clean_description
    and previous.department_id=p_department_id and previous.is_active=p_is_active then
    return next previous; return;
  end if;
  update public.categories set name=clean_name,description=clean_description,department_id=p_department_id,is_active=p_is_active
    where id=p_id returning * into updated;
  insert into private.admin_audit_events(actor_id,action,target_id,changes)
    values(auth.uid(),'category_updated',p_id,jsonb_build_object(
      'before',jsonb_build_object('name',previous.name,'description',previous.description,'department_id',previous.department_id,'is_active',previous.is_active),
      'after',jsonb_build_object('name',updated.name,'description',updated.description,'department_id',updated.department_id,'is_active',updated.is_active)));
  return next updated;
end $$;
revoke all on function public.admin_upsert_category(uuid,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_upsert_category(uuid,text,text,uuid,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
