-- Sprint 5 / CR-006: every complaint must reach a responsible Officer.
-- 1) Submission auto-assigns the least-loaded active Officer of the routed department.
-- 2) Assigned Officers receive an in-system notification.
-- 3) Administrators can dispatch (route/assign) complaints stuck in unstaffed departments.
-- 4) Read-only analytics for Administrators and aggregate community impact for signed-in users.
-- Installation replaces/creates functions only; no existing complaint, account or history row is changed.
begin;

-- Service-level targets by priority (hours). Mirrored in src/shared/sla.ts.
create function private.sla_hours(p_priority public.complaint_priority) returns integer
language sql immutable set search_path='' as $$
  select case p_priority when 'urgent' then 24 when 'high' then 72 when 'normal' then 168 else 336 end
$$;
revoke all on function private.sla_hours(public.complaint_priority) from public,anon,authenticated;

-- Least-loaded active Officer in an active department; ties go to the longest-serving Officer.
-- Callers must hold the administration advisory lock so staffing cannot change concurrently.
create function private.pick_officer(p_department_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select p.id from public.profiles p join public.departments d on d.id=p.department_id and d.is_active
  where p.role='officer' and p.is_active and p.department_id=p_department_id
  order by (select count(*) from public.complaints c where c.assigned_officer_id=p.id and c.status in ('submitted','under_review','in_progress')), p.created_at, p.id
  limit 1
$$;
revoke all on function private.pick_officer(uuid) from public,anon,authenticated;

create or replace function public.submit_complaint(
  p_category_id uuid, p_description text, p_location_text text,
  p_latitude double precision, p_longitude double precision, p_request_id uuid
) returns setof public.complaints language plpgsql security definer set search_path = '' as $$
declare
  complaint public.complaints;
  route_id uuid;
  assignee uuid;
  event_id uuid;
  fingerprint text;
begin
  -- Taken before any row lock, matching the Officer workflow lock order.
  perform pg_catalog.pg_advisory_xact_lock(15,1761);
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
  assignee := private.pick_officer(route_id);
  insert into public.complaints(citizen_id,submission_request_id,submission_fingerprint,category_id,description,location_text,
    latitude,longitude,department_id,assigned_officer_id,status,priority)
    values(auth.uid(),p_request_id,fingerprint,p_category_id,btrim(p_description),btrim(p_location_text),
      p_latitude,p_longitude,route_id,assignee,'submitted','normal') returning * into complaint;
  insert into public.complaint_events(complaint_id,complaint_version,actor_id,event_type,changes)
    values(complaint.id,1,auth.uid(),'submitted',jsonb_build_object('status','submitted','assigned_officer_id',assignee,'auto_assigned',assignee is not null))
    returning id into event_id;
  insert into public.notifications(recipient_id,complaint_id,event_id,kind) values(auth.uid(),complaint.id,event_id,'submission');
  if assignee is not null then
    insert into public.notifications(recipient_id,complaint_id,event_id,kind) values(assignee,complaint.id,event_id,'submission');
  end if;
  return next complaint;
end;
$$;
revoke all on function public.submit_complaint(uuid,text,text,double precision,double precision,uuid) from public,anon,authenticated;
grant execute on function public.submit_complaint(uuid,text,text,double precision,double precision,uuid) to authenticated;

-- Workflow events also notify a newly assigned Officer (unless they assigned themselves).
create or replace function private.record_officer_event(p_id uuid,p_version bigint,p_type text,p_remark text,p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare event_id uuid; assignee uuid;
begin
  if p_remark is not null and char_length(btrim(p_remark))>2000 then raise exception 'invalid_input' using errcode='22023'; end if;
  insert into public.complaint_events(complaint_id,complaint_version,actor_id,event_type,remark,changes)
    values(p_id,p_version,auth.uid(),p_type,nullif(btrim(p_remark),''),p_changes) returning id into event_id;
  insert into public.notifications(recipient_id,complaint_id,event_id,kind)
    select c.citizen_id,c.id,event_id,case when p_type='resolved' then 'resolution' else 'progress' end
    from public.complaints c where c.id=p_id;
  if p_type in ('assigned','transferred') then
    select c.assigned_officer_id into assignee from public.complaints c where c.id=p_id;
    if assignee is not null and assignee<>auth.uid() then
      insert into public.notifications(recipient_id,complaint_id,event_id,kind) values(assignee,p_id,event_id,'progress');
    end if;
  end if;
end $$;
revoke all on function private.record_officer_event(uuid,bigint,text,text,jsonb) from public,anon,authenticated;

-- Administrator dispatch: route an open complaint to a department/category and/or assign an Officer.
create function public.admin_dispatch_complaint(p_id uuid,p_department_id uuid,p_category_id uuid,p_officer_id uuid,p_expected_version bigint,p_reason text)
returns setof public.complaints language plpgsql security definer set search_path='' as $$
declare complaint public.complaints; moved boolean; reassigned boolean;
  previous_department uuid; previous_category uuid; previous_officer uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(15,1761);
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='administrator' for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into complaint from public.complaints c where c.id=p_id;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  perform 1 from public.profiles p where p.id=complaint.citizen_id for key share;
  select * into complaint from public.complaints c where c.id=p_id for update;
  if p_expected_version is null or p_expected_version not between 1 and 9007199254740991
    or p_department_id is null or p_category_id is null then raise exception 'invalid_input' using errcode='22023'; end if;
  if complaint.status not in ('submitted','under_review','in_progress') then raise exception 'complaint_closed' using errcode='23514'; end if;
  if complaint.version<>p_expected_version then raise exception 'stale_version' using errcode='PT409'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 2000 then raise exception 'reason_required' using errcode='22023'; end if;
  perform 1 from public.categories c join public.departments d on d.id=c.department_id and d.is_active
    where c.id=p_category_id and c.is_active and c.department_id=p_department_id for share of c,d;
  if not found then raise exception 'category_unavailable' using errcode='22023'; end if;
  if p_officer_id is not null then
    perform 1 from public.profiles p where p.id=p_officer_id and p.is_active and p.role='officer' and p.department_id=p_department_id for update;
    if not found then raise exception 'invalid_assignee' using errcode='22023'; end if;
  end if;
  moved := p_department_id<>complaint.department_id or p_category_id<>complaint.category_id;
  reassigned := p_officer_id is distinct from complaint.assigned_officer_id;
  if not moved and not reassigned then return next complaint; return; end if;
  -- Work in progress keeps its department and always has an assignee.
  if complaint.status='in_progress' and (moved or p_officer_id is null) then raise exception 'invalid_transition' using errcode='23514'; end if;
  previous_department:=complaint.department_id; previous_category:=complaint.category_id; previous_officer:=complaint.assigned_officer_id;
  update public.complaints set department_id=p_department_id,category_id=p_category_id,assigned_officer_id=p_officer_id,version=version+1
    where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,case when moved then 'transferred' else 'assigned' end,p_reason,jsonb_build_object(
    'before',jsonb_build_object('department_id',previous_department,'category_id',previous_category,'assigned_officer_id',previous_officer),
    'after',jsonb_build_object('department_id',p_department_id,'category_id',p_category_id,'assigned_officer_id',p_officer_id),
    'dispatched_by','administrator'));
  return next complaint;
end $$;
revoke all on function public.admin_dispatch_complaint(uuid,uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.admin_dispatch_complaint(uuid,uuid,uuid,uuid,bigint,text) to authenticated;

-- Read-only operational analytics for active Administrators.
create function public.admin_analytics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare open_states public.complaint_status[] := array['submitted','under_review','in_progress']::public.complaint_status[];
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='administrator') then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'status', coalesce((select jsonb_object_agg(s.status, s.n) from (select c.status, count(*) n from public.complaints c group by c.status) s), '{}'::jsonb),
    'priority', coalesce((select jsonb_object_agg(s.priority, s.n) from (select c.priority, count(*) n from public.complaints c where c.status=any(open_states) group by c.priority) s), '{}'::jsonb),
    'overdue', (select count(*) from public.complaints c where c.status=any(open_states) and now() > c.created_at + make_interval(hours => private.sla_hours(c.priority))),
    'categories', coalesce((select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object('id',k.id,'name',k.name,'is_active',k.is_active,
        'total',count(c.id),'open',count(c.id) filter (where c.status=any(open_states)),'resolved',count(c.id) filter (where c.status='resolved')) x
      from public.categories k left join public.complaints c on c.category_id=k.id group by k.id) q), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object('id',d.id,'name',d.name,'is_active',d.is_active,
        'officers',(select count(*) from public.profiles p where p.department_id=d.id and p.role='officer' and p.is_active),
        'open',(select count(*) from public.complaints c where c.department_id=d.id and c.status=any(open_states)),
        'unassigned',(select count(*) from public.complaints c where c.department_id=d.id and c.status=any(open_states) and c.assigned_officer_id is null),
        'overdue',(select count(*) from public.complaints c where c.department_id=d.id and c.status=any(open_states) and now() > c.created_at + make_interval(hours => private.sla_hours(c.priority)))) x
      from public.departments d) q), '[]'::jsonb),
    'officers', coalesce((select jsonb_agg(x order by (x->>'open')::int desc, x->>'display_name') from (
      select jsonb_build_object('id',p.id,'display_name',p.display_name,'department_id',p.department_id,
        'open',(select count(*) from public.complaints c where c.assigned_officer_id=p.id and c.status=any(open_states)),
        'resolved',(select count(*) from public.complaints c where c.resolved_by=p.id)) x
      from public.profiles p where p.role='officer' and p.is_active) q), '[]'::jsonb),
    'resolution', (select jsonb_build_object('count',count(*),
        'avg_hours',round((avg(extract(epoch from c.resolved_at-c.created_at))/3600)::numeric,1),
        'within_target',count(*) filter (where c.resolved_at <= c.created_at + make_interval(hours => private.sla_hours(c.priority)))) from public.complaints c where c.status='resolved'),
    'satisfaction', (select jsonb_build_object('count',count(*),'average',round(avg(f.rating)::numeric,2),
        'distribution',jsonb_build_object('1',count(*) filter (where f.rating=1),'2',count(*) filter (where f.rating=2),'3',count(*) filter (where f.rating=3),'4',count(*) filter (where f.rating=4),'5',count(*) filter (where f.rating=5))) from public.complaint_feedback f),
    'trend', (select jsonb_agg(jsonb_build_object('month',to_char(m,'YYYY-MM'),
        'submitted',(select count(*) from public.complaints c where date_trunc('month',c.created_at)=m),
        'resolved',(select count(*) from public.complaints c where c.resolved_at is not null and date_trunc('month',c.resolved_at)=m)) order by m)
      from generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') m)
  );
end $$;
revoke all on function public.admin_analytics() from public,anon,authenticated;
grant execute on function public.admin_analytics() to authenticated;

-- Aggregate, non-identifying community impact for any active signed-in user.
create function public.community_impact() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  return (select jsonb_build_object(
    'total',count(*),
    'resolved',count(*) filter (where c.status='resolved'),
    'in_progress',count(*) filter (where c.status in ('under_review','in_progress')),
    'resolved_last_30_days',count(*) filter (where c.resolved_at >= now()-interval '30 days'),
    'avg_resolution_days',round((avg(extract(epoch from c.resolved_at-c.created_at)) filter (where c.status='resolved')/86400)::numeric,1),
    'satisfaction',(select round(avg(f.rating)::numeric,1) from public.complaint_feedback f))
    from public.complaints c);
end $$;
revoke all on function public.community_impact() from public,anon,authenticated;
grant execute on function public.community_impact() to authenticated;

notify pgrst,'reload schema';
commit;
