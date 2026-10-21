-- Read-only: counts/checksums and routine metadata; never returns complaint text,
-- attachment paths, account emails or credentials. This is not a data backup.
begin read only;
select jsonb_build_object(
  'migration_versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'auth_accounts',(select count(*) from auth.users),
  'active_administrators',(select count(*) from public.profiles where role='administrator' and is_active),
  'withdrawal_conflict_code',(select case when position('PT409' in p.prosrc)>0 then 'PT409' when position('40001' in p.prosrc)>0 then '40001' else 'unknown' end from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='withdraw_complaint'),
  'data',(select jsonb_object_agg(name,jsonb_build_object('count',count,'checksum',checksum)) from (
    select 'complaints' name,count(*) count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) checksum from public.complaints t
    union all select 'events',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.complaint_events t
    union all select 'evidence',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.complaint_evidence t
    union all select 'feedback',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.complaint_feedback t
    union all select 'notifications',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.notifications t
    union all select 'categories',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.categories t
    union all select 'departments',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.departments t
    union all select 'storage_objects',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from storage.objects t
  ) data),
  'officer_functions',(select coalesce(jsonb_agg(jsonb_build_object(
    'name',p.proname,'schema',n.nspname,'definer',p.prosecdef,'config',p.proconfig,
    'anonymous_execute',has_function_privilege('anon',p.oid,'execute'),
    'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute')) order by p.proname),'[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname in ('lock_officer_complaint','record_officer_event','list_assignable_officers','review_complaint','assign_complaint','set_complaint_priority','start_complaint','add_progress','transfer_complaint','resolve_complaint'))
) as rollout_snapshot;
commit;
