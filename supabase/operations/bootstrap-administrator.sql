-- Operator-only account setup, NOT a migration or browser RPC.
-- Set civicflow.bootstrap_user_id to the specifically authorized account UUID
-- in this session before executing. Never choose an arbitrary first signup.
begin;
do $$
declare target public.profiles; target_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(15,1761);
  target_id := nullif(current_setting('civicflow.bootstrap_user_id',true),'')::uuid;
  if target_id is null then raise exception 'explicit_account_required'; end if;
  perform 1 from auth.users u where u.id=target_id and not u.is_anonymous and u.email_confirmed_at is not null for update;
  if not found then raise exception 'verified_account_required'; end if;
  select * into target from public.profiles p where p.id=target_id and p.is_active for update;
  if not found then raise exception 'active_profile_required'; end if;
  if target.role='administrator' then return; end if;
  if target.role<>'citizen' or exists(select 1 from public.profiles p where p.role='administrator' and p.is_active) then
    raise exception 'first_administrator_only';
  end if;
  update public.profiles set role='administrator',department_id=null where id=target_id;
  -- No previous application Administrator exists. Record the designated
  -- account as actor and explicitly identify the authorized operator source.
  insert into private.admin_audit_events(actor_id,action,target_id,changes)
    values(target_id,'user_updated',target_id,jsonb_build_object(
      'source','user_authorized_operator_bootstrap',
      'before',jsonb_build_object('role',target.role,'department_id',target.department_id,'is_active',target.is_active),
      'after',jsonb_build_object('role','administrator','department_id',null,'is_active',true)));
end $$;
commit;
