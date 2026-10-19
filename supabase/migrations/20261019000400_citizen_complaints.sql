begin;

alter table public.complaints add column submission_fingerprint text
  check (submission_fingerprint is null or char_length(submission_fingerprint)=32);

create function private.can_read_complaint(p_complaint_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.complaints c join public.profiles p on p.id=auth.uid() and p.is_active
    where c.id=p_complaint_id and (c.citizen_id=p.id or p.role='administrator' or (p.role='officer' and p.department_id=c.department_id))
  );
$$;
revoke all on function private.can_read_complaint(uuid) from public, anon, authenticated;
grant execute on function private.can_read_complaint(uuid) to authenticated;

grant select on public.complaints, public.complaint_events, public.complaint_evidence to authenticated;
create policy complaints_read on public.complaints for select to authenticated using (private.can_read_complaint(id));
create policy complaint_events_read on public.complaint_events for select to authenticated using (private.can_read_complaint(complaint_id));
create policy complaint_evidence_read on public.complaint_evidence for select to authenticated using (
  private.can_read_complaint(complaint_id) and (state='attached' or uploaded_by=auth.uid())
);

-- Referenced inactive lookup records remain readable on authorized complaints.
drop policy categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using (
  (select private.active_role()) is not null and (
    is_active or (select private.active_role())='administrator'
    or exists(select 1 from public.complaints c where c.category_id=categories.id and private.can_read_complaint(c.id))
  )
);
drop policy departments_read on public.departments;
create policy departments_read on public.departments for select to authenticated using (
  (select private.active_role()) is not null and (
    is_active or (select private.active_role())='administrator'
    or exists(select 1 from public.complaints c where c.department_id=departments.id and private.can_read_complaint(c.id))
  )
);

create function public.submit_complaint(
  p_category_id uuid, p_description text, p_location_text text,
  p_latitude double precision, p_longitude double precision, p_request_id uuid
) returns setof public.complaints language plpgsql security definer set search_path = '' as $$
declare
  complaint public.complaints;
  route_id uuid;
  event_id uuid;
  fingerprint text;
begin
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='citizen' for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_request_id is null or p_category_id is null or p_description is null
    or char_length(btrim(p_description)) not between 10 and 5000
    or p_location_text is null or char_length(btrim(p_location_text)) not between 1 and 300
    or p_latitude is null or not (p_latitude between -90 and 90)
    or p_longitude is null or not (p_longitude between -180 and 180) then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  fingerprint := md5(jsonb_build_object('category',p_category_id,'description',btrim(p_description),
    'location',btrim(p_location_text),'latitude',p_latitude,'longitude',p_longitude)::text);
  select * into complaint from public.complaints c where c.citizen_id=auth.uid() and c.submission_request_id=p_request_id;
  if found then
    if complaint.submission_fingerprint is distinct from fingerprint then
      raise exception 'request_reused' using errcode='22023';
    end if;
    return next complaint; return;
  end if;
  select d.id into route_id from public.categories c join public.departments d on d.id=c.department_id
    where c.id=p_category_id and c.is_active and d.is_active for share of c,d;
  if not found then raise exception 'category_unavailable' using errcode='22023'; end if;
  insert into public.complaints(citizen_id,submission_request_id,submission_fingerprint,category_id,description,location_text,
    latitude,longitude,department_id,status,priority)
    values(auth.uid(),p_request_id,fingerprint,p_category_id,btrim(p_description),btrim(p_location_text),
      p_latitude,p_longitude,route_id,'submitted','normal') returning * into complaint;
  insert into public.complaint_events(complaint_id,complaint_version,actor_id,event_type,changes)
    values(complaint.id,1,auth.uid(),'submitted',jsonb_build_object('status','submitted')) returning id into event_id;
  insert into public.notifications(recipient_id,complaint_id,event_id,kind)
    values(auth.uid(),complaint.id,event_id,'submission');
  return next complaint;
end;
$$;
revoke all on function public.submit_complaint(uuid,text,text,double precision,double precision,uuid) from public,anon,authenticated;
grant execute on function public.submit_complaint(uuid,text,text,double precision,double precision,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
