-- Read-only recovery metadata and data-integrity summary. No complaint text is returned.
begin transaction read only;
select jsonb_build_object(
  'target','xapqfnumcpjckhpdyuxz','captured_at',now(),
  'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'status_values',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='complaint_status'),
  'columns',(select jsonb_agg(to_jsonb(c)) from (select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='complaints' order by ordinal_position) c),
  'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))) from pg_constraint c where c.conrelid in ('public.complaints'::regclass,'public.complaint_events'::regclass)),
  'policies',(select jsonb_agg(to_jsonb(p)) from (select schemaname,tablename,policyname,cmd,qual,with_check from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname) p),
  'complaint_count',(select count(*) from public.complaints),
  'existing_complaints_checksum',(select md5(coalesce(string_agg((to_jsonb(c)-'withdrawal_reason'-'withdrawn_at'-'withdrawn_by')::text,',' order by id),'')) from public.complaints c),
  'event_count',(select count(*) from public.complaint_events),
  'existing_events_checksum',(select md5(coalesce(string_agg(to_jsonb(e)::text,',' order by id),'')) from public.complaint_events e),
  'evidence_count',(select count(*) from public.complaint_evidence),
  'notification_count',(select count(*) from public.notifications),
  'withdraw_rpc_exists',to_regprocedure('public.withdraw_complaint(uuid,text,bigint)') is not null
) as withdrawal_baseline;
commit;
