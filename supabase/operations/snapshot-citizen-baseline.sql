-- Scoped metadata snapshot for migrations 004-006; no Auth records or secrets.
-- Application rows in these four affected tables must still be empty.
begin transaction read only;
do $$ begin
  if exists(select 1 from public.complaints) or exists(select 1 from public.complaint_evidence)
    or exists(select 1 from public.categories) or exists(select 1 from public.departments) then
    raise exception 'baseline_changed: review and back up affected data before rollout';
  end if;
end $$;
select jsonb_build_object(
  'target','xapqfnumcpjckhpdyuxz','captured_at',now(),
  'scope','Affected tables empty; schema metadata only; not an Auth/full database backup',
  'migrations',(select jsonb_agg(to_jsonb(m)) from (select version,name from supabase_migrations.schema_migrations order by version) m),
  'columns',(select jsonb_agg(to_jsonb(c)) from (select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name in ('complaints','complaint_evidence','categories','departments') order by table_name,ordinal_position) c),
  'policies',(select jsonb_agg(to_jsonb(p)) from (select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where (schemaname='public' and tablename in ('complaints','complaint_events','complaint_evidence','categories','departments')) or (schemaname='storage' and tablename='objects') order by schemaname,tablename,policyname) p),
  'grants',(select jsonb_agg(to_jsonb(g)) from (select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('complaints','complaint_events','complaint_evidence','categories','departments') order by table_name,grantee,privilege_type) g),
  'existing_bucket',(select jsonb_agg(to_jsonb(b)) from (select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='complaint-evidence') b)
) as baseline;
commit;
