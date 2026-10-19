-- Read-only preflight; never return credentials or user personal details.
begin read only;
select jsonb_build_object(
  'application_tables', coalesce((select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p')), '[]'::jsonb),
  'auth_user_count', (select count(*) from auth.users),
  'email_verified_user_count', (select count(*) from auth.users where email_confirmed_at is not null),
  'migration_history_table', to_regclass('supabase_migrations.schema_migrations'),
  'civicflow_enum_names', coalesce((select jsonb_agg(t.typname order by t.typname) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname in ('app_role','complaint_status','complaint_priority')), '[]'::jsonb),
  'auth_application_triggers', coalesce((select jsonb_agg(t.tgname order by t.tgname) from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal), '[]'::jsonb)
) as preflight;
commit;
