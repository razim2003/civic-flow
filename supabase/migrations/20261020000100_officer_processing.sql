-- Sprint 3: CF-08/09/10/11. No existing complaint is changed by installation.
begin;

-- Shared lock with audited user administration serializes staffing/workflow
-- changes in this small prototype. Lock the citizen before the complaint so
-- event/notification FK checks cannot deadlock with citizen withdrawal/uploads.
create function private.lock_officer_complaint(p_id uuid,p_version bigint)
returns public.complaints language plpgsql security definer set search_path='' as $$
declare actor public.profiles; complaint public.complaints;
begin
  perform pg_catalog.pg_advisory_xact_lock(15,1761);
  select p.* into actor from public.profiles p join public.departments d on d.id=p.department_id and d.is_active
    where p.id=auth.uid() and p.is_active and p.role='officer' for update of p for share of d;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into complaint from public.complaints c where c.id=p_id and c.department_id=actor.department_id;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  perform 1 from public.profiles p where p.id=complaint.citizen_id for key share;
  select * into complaint from public.complaints c where c.id=p_id and c.department_id=actor.department_id for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_version is null or p_version not between 1 and 9007199254740991 then raise exception 'invalid_input' using errcode='22023'; end if;
  if complaint.status not in ('submitted','under_review','in_progress') then raise exception 'complaint_closed' using errcode='23514'; end if;
  if complaint.version<>p_version then raise exception 'stale_version' using errcode='PT409'; end if;
  return complaint;
end $$;

create function private.record_officer_event(p_id uuid,p_version bigint,p_type text,p_remark text,p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare event_id uuid;
begin
  if p_remark is not null and char_length(btrim(p_remark))>2000 then raise exception 'invalid_input' using errcode='22023'; end if;
  insert into public.complaint_events(complaint_id,complaint_version,actor_id,event_type,remark,changes)
    values(p_id,p_version,auth.uid(),p_type,nullif(btrim(p_remark),''),p_changes) returning id into event_id;
  insert into public.notifications(recipient_id,complaint_id,event_id,kind)
    select c.citizen_id,c.id,event_id,case when p_type='resolved' then 'resolution' else 'progress' end
    from public.complaints c where c.id=p_id;
end $$;
revoke all on function private.lock_officer_complaint(uuid,bigint),private.record_officer_event(uuid,bigint,text,text,jsonb) from public,anon,authenticated;

create function public.list_assignable_officers(p_department_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active
    and (p.role='administrator' or (p.role='officer' and p.department_id=p_department_id))) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name) order by p.display_name,p.id)
    from public.profiles p join public.departments d on d.id=p.department_id and d.is_active
    where p.role='officer' and p.is_active and p.department_id=p_department_id),'[]'::jsonb);
end $$;

create function public.review_complaint(p_id uuid,p_expected_version bigint,p_remark text) returns setof public.complaints
language plpgsql security definer set search_path='' as $$
declare complaint public.complaints;
begin
  complaint:=private.lock_officer_complaint(p_id,p_expected_version);
  if complaint.status<>'submitted' then raise exception 'invalid_transition' using errcode='23514'; end if;
  update public.complaints set status='under_review',version=version+1 where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,'reviewed',p_remark,jsonb_build_object('before',jsonb_build_object('status','submitted'),'after',jsonb_build_object('status','under_review')));
  return next complaint;
end $$;

create function public.assign_complaint(p_id uuid,p_officer_id uuid,p_expected_version bigint,p_reason text) returns setof public.complaints
language plpgsql security definer set search_path='' as $$
declare complaint public.complaints; previous_id uuid;
begin
  complaint:=private.lock_officer_complaint(p_id,p_expected_version);
  if p_officer_id is null then raise exception 'invalid_assignee' using errcode='22023'; end if;
  perform 1 from public.profiles p where p.id=p_officer_id and p.is_active and p.role='officer' and p.department_id=complaint.department_id for update;
  if not found then raise exception 'invalid_assignee' using errcode='22023'; end if;
  if complaint.assigned_officer_id=p_officer_id then return next complaint; return; end if;
  if complaint.status='in_progress' and (p_reason is null or char_length(btrim(p_reason)) not between 10 and 2000) then
    raise exception 'reason_required' using errcode='22023';
  end if;
  previous_id:=complaint.assigned_officer_id;
  update public.complaints set assigned_officer_id=p_officer_id,version=version+1 where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,'assigned',p_reason,jsonb_build_object('before',jsonb_build_object('assigned_officer_id',previous_id),'after',jsonb_build_object('assigned_officer_id',p_officer_id)));
  return next complaint;
end $$;

create function public.set_complaint_priority(p_id uuid,p_priority public.complaint_priority,p_expected_version bigint,p_reason text) returns setof public.complaints
language plpgsql security definer set search_path='' as $$
declare complaint public.complaints; previous_priority public.complaint_priority;
begin
  complaint:=private.lock_officer_complaint(p_id,p_expected_version);
  if p_priority is null then raise exception 'invalid_input' using errcode='22023'; end if;
  if complaint.priority=p_priority then return next complaint; return; end if;
  previous_priority:=complaint.priority;
  update public.complaints set priority=p_priority,version=version+1 where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,'priority_changed',p_reason,jsonb_build_object('before',jsonb_build_object('priority',previous_priority),'after',jsonb_build_object('priority',p_priority)));
  return next complaint;
end $$;

create function public.start_complaint(p_id uuid,p_expected_version bigint,p_remark text) returns setof public.complaints
language plpgsql security definer set search_path='' as $$
declare complaint public.complaints;
begin
  complaint:=private.lock_officer_complaint(p_id,p_expected_version);
  if complaint.assigned_officer_id is distinct from auth.uid() then raise exception 'not_assigned' using errcode='42501'; end if;
  if complaint.status<>'under_review' then raise exception 'invalid_transition' using errcode='23514'; end if;
  update public.complaints set status='in_progress',version=version+1 where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,'started',p_remark,jsonb_build_object('before',jsonb_build_object('status','under_review'),'after',jsonb_build_object('status','in_progress')));
  return next complaint;
end $$;

create function public.add_progress(p_id uuid,p_remark text,p_expected_version bigint) returns setof public.complaints
language plpgsql security definer set search_path='' as $$
declare complaint public.complaints;
begin
  complaint:=private.lock_officer_complaint(p_id,p_expected_version);
  if complaint.assigned_officer_id is distinct from auth.uid() then raise exception 'not_assigned' using errcode='42501'; end if;
  if complaint.status<>'in_progress' then raise exception 'invalid_transition' using errcode='23514'; end if;
  if p_remark is null or char_length(btrim(p_remark)) not between 1 and 2000 then raise exception 'progress_required' using errcode='22023'; end if;
  update public.complaints set version=version+1 where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,'progress_added',p_remark,'{}'::jsonb);
  return next complaint;
end $$;

create function public.transfer_complaint(p_id uuid,p_department_id uuid,p_category_id uuid,p_expected_version bigint,p_reason text)
returns setof public.complaints language plpgsql security definer set search_path='' as $$
declare complaint public.complaints; previous_department uuid; previous_category uuid; previous_officer uuid;
begin
  complaint:=private.lock_officer_complaint(p_id,p_expected_version);
  if complaint.status not in ('submitted','under_review') then raise exception 'invalid_transition' using errcode='23514'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 2000 then raise exception 'reason_required' using errcode='22023'; end if;
  perform 1 from public.categories c join public.departments d on d.id=c.department_id and d.is_active
    where c.id=p_category_id and c.is_active and c.department_id=p_department_id for share of c,d;
  if not found then raise exception 'category_unavailable' using errcode='22023'; end if;
  if p_department_id=complaint.department_id and p_category_id=complaint.category_id then return next complaint; return; end if;
  previous_department:=complaint.department_id; previous_category:=complaint.category_id; previous_officer:=complaint.assigned_officer_id;
  update public.complaints set department_id=p_department_id,category_id=p_category_id,assigned_officer_id=null,version=version+1 where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,'transferred',p_reason,jsonb_build_object(
    'before',jsonb_build_object('department_id',previous_department,'category_id',previous_category,'assigned_officer_id',previous_officer),
    'after',jsonb_build_object('department_id',p_department_id,'category_id',p_category_id,'assigned_officer_id',null)));
  return next complaint;
end $$;

revoke all on function public.list_assignable_officers(uuid),public.review_complaint(uuid,bigint,text),public.assign_complaint(uuid,uuid,bigint,text),public.set_complaint_priority(uuid,public.complaint_priority,bigint,text),public.start_complaint(uuid,bigint,text),public.add_progress(uuid,text,bigint),public.transfer_complaint(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.list_assignable_officers(uuid),public.review_complaint(uuid,bigint,text),public.assign_complaint(uuid,uuid,bigint,text),public.set_complaint_priority(uuid,public.complaint_priority,bigint,text),public.start_complaint(uuid,bigint,text),public.add_progress(uuid,text,bigint),public.transfer_complaint(uuid,uuid,uuid,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
