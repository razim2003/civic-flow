-- Removes the fictional Sri Lankan demonstration data created by sri-lanka-demo.sql.
-- DESTRUCTIVE: run only with explicit approval for the target database.
--
-- Deletes demo complaints (owned by demo Citizens) with their history, notifications
-- and feedback, then the demo profiles and their login-less Auth users. Everything
-- else is kept. The script stops without deleting anything when real data depends
-- on a demo person (for example a real complaint assigned to a demo Officer);
-- reassign that work first, then run it again.
do $remove$
declare
  demo uuid[];
  demo_complaints uuid[];
begin
  select coalesce(array_agg(p.id), '{}') into demo from public.profiles p
    where p.id::text like '5e1a0000-0000-4000-8000-000000000%';
  if cardinality(demo) = 0 then
    raise notice 'No CivicFlow demo data found; nothing changed.';
    return;
  end if;
  select coalesce(array_agg(c.id), '{}') into demo_complaints from public.complaints c where c.citizen_id = any(demo);

  if exists(select 1 from public.complaints c where not (c.id = any(demo_complaints))
      and (c.assigned_officer_id = any(demo) or c.resolved_by = any(demo) or c.withdrawn_by = any(demo)))
    or exists(select 1 from public.complaint_events ev where not (ev.complaint_id = any(demo_complaints)) and ev.actor_id = any(demo))
    or exists(select 1 from public.complaint_evidence ev where ev.complaint_id = any(demo_complaints) or ev.uploaded_by = any(demo))
    or exists(select 1 from private.admin_audit_events a where a.actor_id = any(demo)) then
    raise exception 'demo_data_in_use: real records reference a demo person; reassign them first';
  end if;

  delete from public.notifications n where n.complaint_id = any(demo_complaints) or n.recipient_id = any(demo);
  delete from public.complaint_feedback f where f.complaint_id = any(demo_complaints);
  delete from public.complaint_events ev where ev.complaint_id = any(demo_complaints);
  delete from public.complaints c where c.id = any(demo_complaints);
  delete from public.profiles p where p.id = any(demo);
  delete from auth.users u where u.id = any(demo);
  raise notice 'Removed % demo people and % demo complaints.', cardinality(demo), cardinality(demo_complaints);
end
$remove$;
