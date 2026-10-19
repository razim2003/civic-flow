begin;

alter table public.complaint_evidence add column upload_request_id uuid not null default gen_random_uuid();
alter table public.complaint_evidence add constraint evidence_upload_request_unique unique(complaint_id,uploaded_by,upload_request_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('complaint-evidence','complaint-evidence',false,5242880,array['image/jpeg','image/png','application/pdf']);

create function private.can_upload_evidence(p_path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.complaint_evidence e join public.complaints c on c.id=e.complaint_id
      join public.profiles p on p.id=auth.uid() and p.is_active and p.role='citizen'
    where e.object_path=p_path and e.uploaded_by=p.id and c.citizen_id=p.id
      and e.state='pending' and e.expires_at>now() and c.status='submitted'
  );
$$;
create function private.can_read_evidence(p_path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.complaint_evidence e where e.object_path=p_path
    and private.can_read_complaint(e.complaint_id)
    and (e.state='attached' or e.uploaded_by=auth.uid()));
$$;
revoke all on function private.can_upload_evidence(text),private.can_read_evidence(text) from public,anon,authenticated;
grant execute on function private.can_upload_evidence(text),private.can_read_evidence(text) to authenticated;

create policy civicflow_evidence_insert on storage.objects for insert to authenticated
  with check(bucket_id='complaint-evidence' and owner_id=auth.uid()::text and private.can_upload_evidence(name));
create policy civicflow_evidence_read on storage.objects for select to authenticated
  using(bucket_id='complaint-evidence' and private.can_read_evidence(name));
-- No UPDATE, upsert, or DELETE policy. Attached evidence is immutable to clients.

create function public.reserve_evidence(
  p_complaint_id uuid,p_filename text,p_content_type text,p_size bigint,p_request_id uuid
) returns setof public.complaint_evidence language plpgsql security definer set search_path = '' as $$
declare
  complaint public.complaints;
  evidence public.complaint_evidence;
  new_id uuid;
  extension text;
begin
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='citizen' for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into complaint from public.complaints c where c.id=p_complaint_id and c.citizen_id=auth.uid() for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_request_id is null or p_filename is null or char_length(btrim(p_filename)) not between 1 and 200
    or p_content_type is null or p_content_type not in ('image/jpeg','image/png','application/pdf')
    or p_size is null or p_size not between 1 and 5242880 then
    raise exception 'invalid_evidence' using errcode='22023';
  end if;
  select * into evidence from public.complaint_evidence e
    where e.complaint_id=p_complaint_id and e.uploaded_by=auth.uid() and e.upload_request_id=p_request_id;
  if found then
    if evidence.original_filename<>btrim(p_filename) or evidence.declared_content_type<>p_content_type or evidence.declared_size_bytes<>p_size then
      raise exception 'request_reused' using errcode='22023';
    end if;
    if evidence.state='attached' then return next evidence; return; end if;
    if evidence.expires_at<=now() then raise exception 'reservation_expired' using errcode='22023'; end if;
    if complaint.status<>'submitted' then raise exception 'evidence_closed' using errcode='22023'; end if;
    return next evidence; return;
  end if;
  if complaint.status<>'submitted' then raise exception 'evidence_closed' using errcode='22023'; end if;
  if (select count(*) from public.complaint_evidence e where e.complaint_id=p_complaint_id and (e.state='attached' or e.expires_at>now()))>=5 then
    raise exception 'evidence_limit' using errcode='22023';
  end if;
  extension := case p_content_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'pdf' end;
  new_id := gen_random_uuid();
  insert into public.complaint_evidence(id,complaint_id,uploaded_by,object_path,original_filename,declared_content_type,declared_size_bytes,upload_request_id)
    values(new_id,p_complaint_id,auth.uid(),auth.uid()::text||'/'||p_complaint_id::text||'/'||new_id::text||'.'||extension,
      btrim(p_filename),p_content_type,p_size,p_request_id) returning * into evidence;
  return next evidence;
end;
$$;

create function public.finalize_evidence(p_evidence_id uuid) returns setof public.complaint_evidence
language plpgsql security definer set search_path = '' as $$
declare
  complaint public.complaints;
  evidence public.complaint_evidence;
  meta jsonb;
  next_version bigint;
  event_id uuid;
begin
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='citizen' for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into evidence from public.complaint_evidence e where e.id=p_evidence_id and e.uploaded_by=auth.uid();
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into complaint from public.complaints c where c.id=evidence.complaint_id and c.citizen_id=auth.uid() for update;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  select * into evidence from public.complaint_evidence e where e.id=p_evidence_id for update;
  if evidence.state='attached' then return next evidence; return; end if;
  if complaint.status<>'submitted' then raise exception 'evidence_closed' using errcode='22023'; end if;
  if evidence.expires_at<=now() then raise exception 'reservation_expired' using errcode='22023'; end if;
  select o.metadata into meta from storage.objects o where o.bucket_id='complaint-evidence'
    and o.name=evidence.object_path and o.owner_id=auth.uid()::text for share;
  if not found then raise exception 'upload_missing' using errcode='22023'; end if;
  if (meta->>'size') is null or (meta->>'size') !~ '^[0-9]{1,8}$'
    or (meta->>'mimetype') is distinct from evidence.declared_content_type then
    raise exception 'invalid_evidence' using errcode='22023';
  end if;
  if (meta->>'size')::bigint<>evidence.declared_size_bytes then raise exception 'invalid_evidence' using errcode='22023'; end if;
  update public.complaint_evidence set state='attached',attached_at=now() where id=evidence.id returning * into evidence;
  update public.complaints set version=version+1 where id=complaint.id returning version into next_version;
  insert into public.complaint_events(complaint_id,complaint_version,actor_id,event_type,changes)
    values(complaint.id,next_version,auth.uid(),'evidence_added',jsonb_build_object('evidence_id',evidence.id)) returning id into event_id;
  insert into public.notifications(recipient_id,complaint_id,event_id,kind) values(auth.uid(),complaint.id,event_id,'progress');
  return next evidence;
end;
$$;
revoke all on function public.reserve_evidence(uuid,text,text,bigint,uuid),public.finalize_evidence(uuid) from public,anon,authenticated;
grant execute on function public.reserve_evidence(uuid,text,text,bigint,uuid),public.finalize_evidence(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
