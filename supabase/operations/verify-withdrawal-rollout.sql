-- Read-only deployment checks. Do not withdraw any real complaint as a fixture.
begin transaction read only;
select jsonb_build_object(
  'applied_migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'status_values',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='complaint_status'),
  'rpc_security',(select jsonb_build_object('definer',p.prosecdef,'settings',p.proconfig,
    'anonymous_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))
    from pg_proc p where p.oid='public.withdraw_complaint(uuid,text,bigint)'::regprocedure),
  'withdrawal_constraints',(select jsonb_agg(jsonb_build_object('name',conname,'validated',convalidated)) from pg_constraint where conname in ('complaints_withdrawal_fields','withdrawal_has_reason')),
  'direct_browser_update',has_table_privilege('authenticated','public.complaints','UPDATE'),
  'tables_with_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relrowsecurity),
  'complaints',(select count(*) from public.complaints),
  'withdrawn',(select count(*) from public.complaints where status='withdrawn'),
  'private_bucket',(select not public from storage.buckets where id='complaint-evidence')
) as withdrawal_rollout;
commit;
