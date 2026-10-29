-- CF-13: recipients read their own durable notifications and mark them read.
-- Notifications are already written atomically by complaint RPCs; no existing row is changed.
begin;

grant select on public.notifications to authenticated;
create policy notifications_read on public.notifications for select to authenticated
  using (recipient_id=(select auth.uid()) and (select private.active_role()) is not null);

-- Only read_at changes, only for the caller's own unread rows. p_all marks every
-- unread notification; otherwise 1-100 explicit IDs are required.
create function public.mark_notifications_read(p_notification_ids uuid[],p_all boolean)
returns setof public.notifications language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles p where p.id=auth.uid() and p.is_active;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_all is null or (not p_all and (p_notification_ids is null or cardinality(p_notification_ids) not between 1 and 100)) then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  return query update public.notifications n set read_at=now()
    where n.recipient_id=auth.uid() and n.read_at is null and (p_all or n.id=any(p_notification_ids))
    returning n.*;
end $$;
revoke all on function public.mark_notifications_read(uuid[],boolean) from public,anon,authenticated;
grant execute on function public.mark_notifications_read(uuid[],boolean) to authenticated;

notify pgrst,'reload schema';
commit;
