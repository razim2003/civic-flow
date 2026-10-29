-- CF-19: one immutable post-resolution feedback record per complaint, owner only.
-- Installation creates a read policy and one RPC; no existing row is changed.
begin;

grant select on public.complaint_feedback to authenticated;
create policy complaint_feedback_read on public.complaint_feedback for select to authenticated
  using (private.can_read_complaint(complaint_id));

create function public.submit_feedback(p_complaint_id uuid,p_rating integer,p_comment text)
returns setof public.complaint_feedback language plpgsql security definer set search_path='' as $$
declare
  complaint public.complaints;
  feedback public.complaint_feedback;
  clean_comment text := nullif(btrim(p_comment),'');
begin
  -- Same lock order as withdrawal/uploads: Citizen profile, then owned complaint.
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='citizen' for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into complaint from public.complaints c where c.id=p_complaint_id and c.citizen_id=auth.uid() for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_rating is null or p_rating not between 1 and 5 or char_length(coalesce(clean_comment,''))>2000 then
    raise exception 'invalid_feedback' using errcode='22023';
  end if;
  if complaint.status<>'resolved' then raise exception 'feedback_closed' using errcode='23514'; end if;
  select * into feedback from public.complaint_feedback f where f.complaint_id=p_complaint_id;
  if found then
    -- An identical retry after a lost response returns the stored record.
    if feedback.rating=p_rating and feedback.comment is not distinct from clean_comment then return next feedback; return; end if;
    raise exception 'feedback_exists' using errcode='23505';
  end if;
  insert into public.complaint_feedback(complaint_id,citizen_id,rating,comment)
    values(p_complaint_id,auth.uid(),p_rating,clean_comment) returning * into feedback;
  return next feedback;
end $$;
revoke all on function public.submit_feedback(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.submit_feedback(uuid,integer,text) to authenticated;

notify pgrst,'reload schema';
commit;
