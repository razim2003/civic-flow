-- CF-12: the Officer resolution portion of Sprint 4, after processing operations.
begin;
create function public.resolve_complaint(p_id uuid,p_resolution_text text,p_expected_version bigint)
returns setof public.complaints language plpgsql security definer set search_path='' as $$
declare complaint public.complaints;
begin
  complaint:=private.lock_officer_complaint(p_id,p_expected_version);
  if complaint.assigned_officer_id is distinct from auth.uid() then raise exception 'not_assigned' using errcode='42501'; end if;
  if complaint.status<>'in_progress' then raise exception 'invalid_transition' using errcode='23514'; end if;
  if p_resolution_text is null or char_length(btrim(p_resolution_text)) not between 10 and 5000 then raise exception 'resolution_required' using errcode='22023'; end if;
  update public.complaints set status='resolved',resolution_text=btrim(p_resolution_text),resolved_at=now(),resolved_by=auth.uid(),version=version+1 where id=p_id returning * into complaint;
  perform private.record_officer_event(p_id,complaint.version,'resolved',null,jsonb_build_object('before',jsonb_build_object('status','in_progress'),'after',jsonb_build_object('status','resolved')));
  return next complaint;
end $$;
revoke all on function public.resolve_complaint(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.resolve_complaint(uuid,text,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
