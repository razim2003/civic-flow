-- Read-only post-rollout verification; does not disclose account details.
begin read only;
select set_config('civicflow.rollout_verification', jsonb_build_object(
  'auth_user_count', (select count(*) from auth.users),
  'verified_auth_user_count', (select count(*) from auth.users where email_confirmed_at is not null),
  'profile_count', (select count(*) from public.profiles),
  'missing_nonanonymous_profiles', (select count(*) from auth.users u where not coalesce(u.is_anonymous,false) and not exists(select 1 from public.profiles p where p.id=u.id)),
  'citizen_profile_count', (select count(*) from public.profiles where role='citizen' and is_active),
  'application_tables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'),
  'tables_with_rls', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relrowsecurity),
  'anonymous_profile_read_granted', has_table_privilege('anon','public.profiles','select'),
  'authenticated_profile_update_granted', has_table_privilege('authenticated','public.profiles','update'),
  'signup_trigger_installed', exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_created'),
  'applied_migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
)::text, true) is not null as verification_summary_saved;

-- Model the verified account's JWT subject under the actual authenticated role.
-- This proves the deployed profile policy without asking for the user's password.
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where email_confirmed_at is not null and not coalesce(is_anonymous,false) order by created_at limit 1), true) is not null as verification_subject_set;
set local role authenticated;
select current_setting('civicflow.rollout_verification')::jsonb as rollout_verification,
  count(*) as own_profile_rows, bool_and(id=auth.uid() and is_active) as only_active_own_profile from public.profiles;
commit;
