-- Read-only preflight; no account details or complaint content are returned.
begin transaction read only;
select jsonb_build_object(
  'migrations',(select jsonb_agg(to_jsonb(m)) from (select version,name from supabase_migrations.schema_migrations order by version) m),
  'complaints',(select count(*) from public.complaints),
  'evidence',(select count(*) from public.complaint_evidence),
  'categories',(select count(*) from public.categories),
  'departments',(select count(*) from public.departments),
  'evidence_bucket',(select jsonb_agg(to_jsonb(b)) from (select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='complaint-evidence') b),
  'storage_policies',(select jsonb_agg(to_jsonb(p)) from (select policyname,cmd,roles,qual,with_check from pg_policies where schemaname='storage' and tablename='objects') p),
  'fingerprint_exists',exists(select 1 from information_schema.columns where table_schema='public' and table_name='complaints' and column_name='submission_fingerprint')
) as preflight;
commit;
