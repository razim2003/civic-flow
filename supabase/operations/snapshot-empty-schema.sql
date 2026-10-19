-- Scoped recovery snapshot for an empty application schema, not an Auth backup.
begin read only;
select jsonb_build_object(
  'database_role', current_user,
  'captured_at', now(),
  'application_relations', coalesce((select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')), '[]'::jsonb),
  'application_enum_types', coalesce((select jsonb_agg(t.typname) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('public','private') and t.typtype='e'), '[]'::jsonb),
  'application_functions', coalesce((select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p')), '[]'::jsonb),
  'namespaces', (select jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl)) from pg_namespace n where n.nspname in ('public','private')),
  'default_privileges', coalesce((select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'object_type',d.defaclobjtype,'acl',d.defaclacl)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in ('public','private') or d.defaclnamespace=0), '[]'::jsonb),
  'restore_public_schema_privileges_sql', (select string_agg(format('GRANT %s ON SCHEMA public TO %s%s;',a.privilege_type,case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end,case when a.is_grantable then ' WITH GRANT OPTION' else '' end), E'\n') from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname='public'),
  'auth_user_count', (select count(*) from auth.users),
  'verified_auth_user_count', (select count(*) from auth.users where email_confirmed_at is not null)
) as schema_snapshot;
commit;
