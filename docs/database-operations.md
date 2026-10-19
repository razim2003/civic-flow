# Database operations and hosted setup review

## Current state

The repository contains two migrations. They have been replayed in disposable embedded PostgreSQL tests only. No commands have linked this checkout to a hosted database or applied hosted SQL. The project URL/public key in ignored `.env.local` enable browser API configuration; they are not privileged migration credentials.

Intended hosted target, supplied by the user: project reference `xapqfnumcpjckhpdyuxz`. Before any approval request or remote execution, inspect its actual migration/schema state and confirm this is the intended development/demo environment. Do not assume it is empty or safe to reset.

## Reviewable migrations

| Migration | Intended effects |
| --- | --- |
| `20261019000100_foundation.sql` | Creates role/workflow/priority enums; eight public tables and one private audit table; constraints/indexes; updated-at triggers; Citizen-only signup trigger; RLS and restrictive grants/defaults |
| `20261019000200_auth_and_administration.sql` | Enables active self-profile and admin profile reads; active category/department lookup reads; current-role helper; bounded self-name update and audited admin-user-update RPCs |

Complaint/history/evidence/feedback/notification tables exist as protected foundations only. They have no browser grants or write APIs yet. Their policies and transactional operations ship alongside the later features. No private Storage bucket has been created yet.

The migrations do not delete records, seed passwords, bootstrap privileged identities or activate complaint workflows. They add tables/enums that will conflict with same-named objects if the target is not clean. Review their revoke/default-privilege statements as part of target inspection. The signup trigger affects new Auth accounts only; existing hosted Auth users need an explicit, reviewed Citizen profile backfill if any exist. Never promote existing accounts from user metadata.

## Required before a hosted migration

1. Confirm target reference, environment and current schema/migration history, and inspect existing Auth-user count without printing unnecessary personal data.
2. Verify PostgreSQL/Supabase CLI compatibility and review both exact SQL files. Finish full local Supabase validation when Docker is available; embedded tests do not validate the Auth/PostgREST/Storage services or concurrent database sessions.
3. Take a restorable backup/snapshot appropriate to the target, record its reference privately, and agree recovery. Avoid a blanket rollback that drops tables once new user data has been written; use reviewed corrective migrations or restore instead.
4. Present the target, exact migrations, any existing-user backfill, expected effects, local evidence and recovery plan for explicit user approval. Privileged credentials must be entered through approved local tooling/secret storage, never browser env variables, chat logs or tracked files.
5. Only after approval apply the reviewed migrations using supported Supabase tooling. Verify migration history and authenticated allow/deny behavior afterward. Do not execute a reset or destructive recovery based solely on migration approval.

No automatic hosted migration is configured in CI. `supabase/config.toml` identifies `civic-flow-local` and is not a hosted project link.

## Auth settings and first Administrator

In the approved development/demo project, configure email signup, email confirmation, minimum password length 12, and disable anonymous sign-in. Allow exact `/auth/callback` and `/reset-password` URLs for the local origins (`http://127.0.0.1:5173` and `http://localhost:5173`) and approved deployed domain. Hosted Auth settings are operational settings: the local TOML does not change them remotely.

For the first Administrator, identify a specific verified Auth account by UUID. Obtain approval for a targeted operator promotion of its existing Citizen profile and record the bootstrap action in the deployment/setup log. Do not promote by arbitrary signup order, email-pattern matching or editable metadata. The ordinary admin RPC cannot bootstrap itself because it correctly requires an existing active Administrator.

Create the organization's initial departments through a reviewed setup migration; no made-up production departments are seeded. An Officer requires an active department. Existing-user admin controls can then allocate access; no Auth Admin secret is sent to the browser.

## Local work

With Docker available and a verified Supabase CLI, start a fresh local instance under this checkout. Starting an initialized local environment is separate from resetting it; inspect any existing local data before commands that can replace it. Copy the resulting local public URL/publishable key into ignored `.env.local` when targeting local services, and use the local email inbox for confirmation/recovery tests.

Until then, `npm.cmd run test:db` tests actual PostgreSQL grants, RLS, triggers and RPCs inside PGlite, with fixture Auth identities. `npm.cmd run db:types` derives table/enum/RPC types from the same migrations; this repository generator intentionally exposes table mutations as `never` to discourage raw client writes. It is not a hosted Supabase CLI type export. The test harness is not application authentication code and is never bundled into the frontend.
