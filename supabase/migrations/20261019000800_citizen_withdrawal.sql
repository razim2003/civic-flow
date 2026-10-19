-- CF-22: explicit user-approved extension; no existing records/files are removed.
begin;

alter table public.complaints
  add column withdrawal_reason text,
  add column withdrawn_at timestamptz,
  add column withdrawn_by uuid references public.profiles(id) on delete restrict,
  add constraint complaints_withdrawal_fields check (
    (status='withdrawn' and withdrawal_reason is not null
      and char_length(btrim(withdrawal_reason)) between 10 and 2000
      and withdrawn_at is not null and withdrawn_by=citizen_id and withdrawn_by is not null
      and assigned_officer_id is null)
    or (status<>'withdrawn' and withdrawal_reason is null and withdrawn_at is null and withdrawn_by is null)
  );

alter table public.complaint_events drop constraint complaint_events_event_type_check;
alter table public.complaint_events add constraint complaint_events_event_type_check check (
  event_type in ('submitted','reviewed','assigned','transferred','priority_changed','started','progress_added','resolved','evidence_added','withdrawn')
);
alter table public.complaint_events add constraint withdrawal_has_reason check (
  event_type<>'withdrawn' or (remark is not null and char_length(btrim(remark)) between 10 and 2000)
);

create function public.withdraw_complaint(p_complaint_id uuid,p_reason text,p_expected_version bigint)
returns setof public.complaints language plpgsql security definer set search_path = '' as $$
declare
  previous public.complaints;
  updated public.complaints;
  event_id uuid;
begin
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='citizen' for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into previous from public.complaints c where c.id=p_complaint_id and c.citizen_id=auth.uid() for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 2000
    or p_expected_version is null or p_expected_version not between 1 and 9007199254740991 then
    raise exception 'invalid_withdrawal' using errcode='22023';
  end if;
  -- Resume an identical request after a lost response without duplicating history.
  if previous.status='withdrawn' and previous.withdrawn_by=auth.uid()
    and previous.withdrawal_reason=btrim(p_reason) and previous.version=p_expected_version+1 then
    return next previous; return;
  end if;
  if previous.status not in ('submitted','under_review','in_progress') then
    raise exception 'withdrawal_closed' using errcode='23514';
  end if;
  if previous.version<>p_expected_version then raise exception 'stale_version' using errcode='40001'; end if;
  update public.complaints set status='withdrawn',withdrawal_reason=btrim(p_reason),withdrawn_at=now(),
    withdrawn_by=auth.uid(),assigned_officer_id=null,version=version+1 where id=previous.id returning * into updated;
  insert into public.complaint_events(complaint_id,complaint_version,actor_id,event_type,remark,changes)
    values(updated.id,updated.version,auth.uid(),'withdrawn',updated.withdrawal_reason,
      jsonb_build_object('before',jsonb_build_object('status',previous.status,'assigned_officer_id',previous.assigned_officer_id),
        'after',jsonb_build_object('status','withdrawn','assigned_officer_id',null))) returning id into event_id;
  insert into public.notifications(recipient_id,complaint_id,event_id,kind)
    values(auth.uid(),updated.id,event_id,'progress');
  return next updated;
end;
$$;
revoke all on function public.withdraw_complaint(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.withdraw_complaint(uuid,text,bigint) to authenticated;

notify pgrst,'reload schema';
commit;
