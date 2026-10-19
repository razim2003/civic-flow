-- Sprint 1 foundation. No hosted execution is authorized by this file.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke create on schema public from public, anon, authenticated;

create type public.app_role as enum ('citizen', 'officer', 'administrator');
create type public.complaint_status as enum ('submitted', 'under_review', 'in_progress', 'resolved');
create type public.complaint_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  role public.app_role not null default 'citizen',
  is_active boolean not null default true,
  department_id uuid references public.departments(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint profiles_role_department check ((role = 'officer' and department_id is not null) or (role <> 'officer' and department_id is null))
);
create index profiles_department_idx on public.profiles(department_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 100),
  description text check (char_length(description) <= 500),
  department_id uuid not null references public.departments(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index categories_department_idx on public.categories(department_id);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete restrict,
  submission_request_id uuid not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  location_text text not null check (char_length(btrim(location_text)) between 1 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  department_id uuid not null references public.departments(id) on delete restrict,
  assigned_officer_id uuid references public.profiles(id) on delete restrict,
  priority public.complaint_priority not null default 'normal',
  status public.complaint_status not null default 'submitted',
  resolution_text text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(citizen_id, submission_request_id),
  constraint complaints_resolution_fields check (
    (status = 'resolved' and char_length(btrim(resolution_text)) between 10 and 5000 and resolution_text is not null and resolved_at is not null and resolved_by is not null)
    or (status <> 'resolved' and resolution_text is null and resolved_at is null and resolved_by is null)
  ),
  constraint complaints_work_requires_assignee check (status not in ('in_progress','resolved') or assigned_officer_id is not null)
);
create index complaints_citizen_created_idx on public.complaints(citizen_id, created_at desc);
create index complaints_department_status_idx on public.complaints(department_id, status, created_at desc);
create index complaints_assigned_status_idx on public.complaints(assigned_officer_id, status);
create index complaints_category_idx on public.complaints(category_id);

create table public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete restrict,
  complaint_version bigint not null check (complaint_version >= 1),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('submitted','reviewed','assigned','transferred','priority_changed','started','progress_added','resolved','evidence_added')),
  remark text check (char_length(remark) <= 2000),
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  created_at timestamptz not null default now(),
  unique(complaint_id, complaint_version),
  constraint progress_has_remark check (event_type <> 'progress_added' or (remark is not null and char_length(btrim(remark)) > 0))
);
create index complaint_events_actor_idx on public.complaint_events(actor_id);

create table public.complaint_evidence (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete restrict,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  object_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 200),
  declared_content_type text not null check (declared_content_type in ('image/jpeg','image/png','application/pdf')),
  declared_size_bytes bigint not null check (declared_size_bytes between 1 and 5242880),
  state text not null default 'pending' check (state in ('pending','attached')),
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(), attached_at timestamptz,
  constraint evidence_attachment_time check ((state = 'pending' and attached_at is null) or (state = 'attached' and attached_at is not null))
);
create index complaint_evidence_complaint_idx on public.complaint_evidence(complaint_id);

create table public.complaint_feedback (
  complaint_id uuid primary key references public.complaints(id) on delete restrict,
  citizen_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  complaint_id uuid not null references public.complaints(id) on delete restrict,
  event_id uuid not null references public.complaint_events(id) on delete restrict,
  kind text not null check (kind in ('submission','progress','resolution')),
  created_at timestamptz not null default now(), read_at timestamptz,
  unique(recipient_id, event_id)
);
create index notifications_recipient_idx on public.notifications(recipient_id, read_at, created_at desc);

create table private.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('user_updated','category_updated','category_created')),
  target_id uuid not null,
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  created_at timestamptz not null default now()
);

-- Create and protect every table in the same transaction. Complaint/evidence
-- policies and write functions arrive with later sprints; they are inaccessible now.
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_events enable row level security;
alter table public.complaint_evidence enable row level security;
alter table public.complaint_feedback enable row level security;
alter table public.notifications enable row level security;
alter table private.admin_audit_events enable row level security;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger departments_updated_at before update on public.departments for each row execute function private.touch_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function private.touch_updated_at();
create trigger complaints_updated_at before update on public.complaints for each row execute function private.touch_updated_at();

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role, is_active, department_id)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Citizen'), 100), 'citizen', true, null);
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

commit;
