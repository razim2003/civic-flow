# Database operations and hosted setup review

## Current state

On 2026-10-19, the user explicitly authorized hosted setup, existing-account repair and necessary non-destructive CivicFlow Supabase changes. Eight migrations (foundation/profile repair, citizen complaints/evidence/categories, then requested owner withdrawal) were applied to project `xapqfnumcpjckhpdyuxz` using the authenticated Supabase CLI (2.114.0). The project link is stored in ignored `supabase/.temp/` state. No application credentials were added to source or frontend configuration.

Read-only preflight confirmed an empty application schema, no CivicFlow migration history or signup trigger, and one email-verified Auth account. The GitHub connection had not applied the migrations. The rollout preserved that Auth account and added its missing Citizen profile. See [hosted setup record](hosted-setup-2026-10-19.md). Future operations must inspect the current state again; this database is no longer empty.

## Reviewable migrations

| Migration | Intended effects |
| --- | --- |
| `20261019000100_foundation.sql` | Creates role/workflow/priority enums; eight public tables and one private audit table; constraints/indexes; updated-at triggers; Citizen-only signup trigger; RLS and restrictive grants/defaults |
| `20261019000200_auth_and_administration.sql` | Enables active self-profile and admin profile reads; active category/department lookup reads; current-role helper; bounded self-name update and audited admin-user-update RPCs |
| `20261019000300_backfill_existing_profiles.sql` | Creates only missing non-anonymous Citizen profiles for pre-existing Auth accounts, preserves existing roles/activation state, and requests a PostgREST schema-cache refresh |
| `20261019000400_citizen_complaints.sql` | Citizen-only submission, idempotency, scoped reads and atomic history/notification |
| `20261019000500_private_complaint_evidence.sql` | Private limited bucket, reserved owned paths, reserve/finalize RPCs and Storage policies |
| `20261019000600_prototype_service_categories.sql` | Six user-selected prototype categories and matching routing departments |
| `20261019000700_withdrawn_status.sql` | Adds final Withdrawn enum value in a separately committed migration |
| `20261019000800_citizen_withdrawal.sql` | Retained reason/actor/time, withdrawal constraints, owner-only version-checked RPC and atomic history/update |

Migrations 004-006 are applied on the hosted project: protected complaint creation, scoped complaint/history/evidence reads, the private Storage bucket and six user-selected prototype category/department routes. Exact SQL, preflight, verification, test limitations and recovery are in [Sprint 2 record](sprint-2.md). Feedback and notification-inbox browser access remains denied.

Migrations 007-008 implement the user's CF-22 owner-withdrawal extension. Their read-only pre/post checks confirmed the existing complaint, history, attachment and update records were unchanged by rollout. Function grants, constraints, RLS and anonymous API denial were verified. See [withdrawal review and verification](citizen-withdrawal.md).

The migrations do not delete records, seed passwords or bootstrap privileged identities. Migrations 004-006 activate Citizen complaint creation/evidence; Officer workflow mutations remain planned. The first two create tables/enums and must not be manually rerun against the deployed schema; migration history now records them. The third safely repairs only missing profiles because the signup trigger alone does not cover accounts created before it existed. Never promote existing accounts from user metadata.

## Required before a hosted migration

1. Confirm target reference, environment and current schema/migration history, and inspect existing Auth-user count without printing unnecessary personal data.
2. Verify PostgreSQL/Supabase CLI compatibility and review the exact pending SQL files. Finish full local Supabase validation when Docker is available; embedded tests do not validate the Auth/PostgREST/Storage services or concurrent database sessions.
3. Take a restorable backup/snapshot appropriate to the target, record its reference privately, and agree recovery. Avoid a blanket rollback that drops tables once new user data has been written; use reviewed corrective migrations or restore instead.
4. Record the target, exact migrations, any existing-user backfill, expected effects, local evidence and recovery plan. The user explicitly authorized necessary non-destructive CivicFlow Supabase changes on 2026-10-19; do not repeatedly ask for covered operations. Changes outside that scope require a decision. Privileged credentials must be entered through approved local tooling/secret storage, never browser env variables, chat logs or tracked files.
5. Only after approval apply the reviewed migrations using supported Supabase tooling. Verify migration history and authenticated allow/deny behavior afterward. Do not execute a reset or destructive recovery based solely on migration approval.

No automatic hosted migration is configured in this repository's CI. `supabase/config.toml` identifies `civic-flow-local`; the CLI's ignored `.temp/project-ref` separately records the linked hosted project. The user's external GitHub integration is independent of this repository's CI configuration.

## Auth settings and first Administrator

In the approved development/demo project, configure email signup, email confirmation, minimum password length 12, and disable anonymous sign-in. Allow exact `/auth/callback` and `/reset-password` URLs for the local origins (`http://127.0.0.1:5173` and `http://localhost:5173`) and approved deployed domain. Hosted Auth settings are operational settings: the local TOML does not change them remotely.

For the first Administrator, identify a specific verified Auth account by UUID. Obtain approval for a targeted operator promotion of its existing Citizen profile and record the bootstrap action in the deployment/setup log. Do not promote by arbitrary signup order, email-pattern matching or editable metadata. The ordinary admin RPC cannot bootstrap itself because it correctly requires an existing active Administrator.

The user selected six proposal-based service areas for the prototype. Applied migration 006 created their explicitly labelled prototype routing departments/categories; they do not claim to represent a real government organization. An Officer requires an active department. Existing-user admin controls can then allocate access; no Auth Admin secret is sent to the browser.

## Local work

With Docker available and a verified Supabase CLI, start a fresh local instance under this checkout. Starting an initialized local environment is separate from resetting it; inspect any existing local data before commands that can replace it. Copy the resulting local public URL/publishable key into ignored `.env.local` when targeting local services, and use the local email inbox for confirmation/recovery tests.

Until then, `npm.cmd run test:db` tests actual PostgreSQL grants, RLS, triggers and RPCs inside PGlite, with fixture Auth identities. `npm.cmd run db:types` derives table/enum/RPC types from the same migrations; this repository generator intentionally exposes table mutations as `never` to discourage raw client writes. It is not a hosted Supabase CLI type export. The test harness is not application authentication code and is never bundled into the frontend.
