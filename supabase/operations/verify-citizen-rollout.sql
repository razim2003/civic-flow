-- Read-only deployed-schema checks; no fixture complaints/files or account changes.
begin transaction read only;
do $$ begin
  perform set_config('civicflow.citizen_rollout',jsonb_build_object(
    'applied_migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
    'private_bucket',(select jsonb_build_object('public',public,'max_bytes',file_size_limit,'mime_types',allowed_mime_types) from storage.buckets where id='complaint-evidence'),
    'complaints',(select count(*) from public.complaints),
    'evidence',(select count(*) from public.complaint_evidence),
    'tables_with_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relrowsecurity),
    'browser_complaint_direct_writes',has_table_privilege('authenticated','public.complaints','INSERT,UPDATE,DELETE'),
    'browser_evidence_direct_writes',has_table_privilege('authenticated','public.complaint_evidence','INSERT,UPDATE,DELETE'),
    'anonymous_category_read',has_table_privilege('anon','public.categories','SELECT'),
    'rpc_security',(select jsonb_agg(jsonb_build_object('name',p.proname,'definer',p.prosecdef,'settings',p.proconfig,
      'anonymous_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.proname)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_complaint','reserve_evidence','finalize_evidence')),
    'storage_policies',(select jsonb_agg(jsonb_build_object('name',policyname,'operation',cmd)) from pg_policies where schemaname='storage' and tablename='objects')
  )::text,true);
  perform set_config('request.jwt.claim.sub',
    (select p.id::text from public.profiles p join auth.users u on u.id=p.id where p.role='citizen' and p.is_active and u.email_confirmed_at is not null order by p.created_at limit 1),true);
end $$;
set local role authenticated;
select current_setting('civicflow.citizen_rollout')::jsonb as schema_verification,
  (select jsonb_agg(jsonb_build_object('category',c.name,'active',c.is_active and d.is_active,'department',d.name) order by c.name)
    from public.categories c join public.departments d on d.id=c.department_id) as citizen_visible_categories,
  (select count(*) from public.profiles) as caller_visible_profiles;
commit;
