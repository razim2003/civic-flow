# Database operations and hosted setup review

## Current state

On 2026-10-19, the user explicitly authorized hosted setup, existing-account repair and necessary non-destructive CivicFlow Supabase changes. Eight migrations (foundation/profile repair, citizen complaints/evidence/categories, then requested owner withdrawal) were applied to project `xapqfnumcpjckhpdyuxz` using the authenticated Supabase CLI (2.114.0). The project link is stored in ignored `supabase/.temp/` state. No application credentials were added to source or frontend configuration.

Read-only preflight confirmed an empty application schema, no CivicFlow migration history or signup trigger, and one email-verified Auth account. The GitHub connection had not applied the migrations. The rollout preserved that Auth account and added its missing Citizen profile. See [hosted setup record](hosted-setup-2026-10-19.md). Future operations must inspect the current state again; this database is no longer empty.

On 2026-10-21 the user explicitly approved the three reviewed Officer/conflict migrations for this same project. All 11 migration files are now recorded remotely. The rollout installed Officer processing/resolution routines and corrected withdrawal conflict responses, preserving existing complaint/history/evidence/notification/reference/Storage checksums. See [Officer rollout verification](officer-portal.md#approved-hosted-activation--2026-10-21).

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
| `20261020000100_officer_processing.sql` | Protected roster/review/assignment/priority/start/progress/transfer routines and two private helpers; no data backfill |
| `20261020000200_officer_resolution.sql` | Assigned-Officer resolution with required details/date and atomic history/update |
| `20261021000100_non_retrying_withdrawal_conflict.sql` | Replaces only the withdrawal routine to return non-retrying `PT409` for stale versions, preserving business rules and existing data |
| `20261029000100_citizen_feedback.sql` | Applied 2026-10-29. Feedback read policy and owner-only `submit_feedback` RPC |
| `20261029000200_notification_inbox.sql` | Applied 2026-10-29. Recipient-only notification reads and `mark_notifications_read` RPC |
| `20261029000300_category_management.sql` | Applied 2026-10-29. Audited `admin_upsert_category` RPC |

Migrations 004-006 are applied on the hosted project: protected complaint creation, scoped complaint/history/evidence reads, the private Storage bucket and six user-selected prototype category/department routes. Exact SQL, preflight, verification, test limitations and recovery are in [Sprint 2 record](sprint-2.md). Feedback and notification-inbox browser access remains denied.

Migrations 007-008 implement the user's CF-22 owner-withdrawal extension. Their read-only pre/post checks confirmed the existing complaint, history, attachment and update records were unchanged by rollout. Function grants, constraints, RLS and anonymous API denial were verified. See [withdrawal review and verification](citizen-withdrawal.md).

The migrations do not delete records, seed passwords or bootstrap privileged identities. Migrations 004-006 activate Citizen complaint creation/evidence; the approved 20261020/20261021 migrations activate Officer workflows and safe conflict handling. The first two create tables/enums and must not be manually rerun against the deployed schema; migration history now records them. The third safely repairs only missing profiles because the signup trigger alone does not cover accounts created before it existed. Never promote existing accounts from user metadata.

## Required before a hosted migration

1. Confirm target reference, environment and current schema/migration history, and inspect existing Auth-user count without printing unnecessary personal data.
2. Verify PostgreSQL/Supabase CLI compatibility and review the exact pending SQL files. Finish full local Supabase validation when Docker is available; embedded tests do not validate the Auth/PostgREST/Storage services or concurrent database sessions.
3. Take a restorable backup/snapshot appropriate to the target, record its reference privately, and agree recovery. Avoid a blanket rollback that drops tables once new user data has been written; use reviewed corrective migrations or restore instead.
4. Record the target, exact migrations, any existing-user backfill, expected effects, local evidence and recovery plan. The user supplied updated AGENTS instructions on 2026-10-20 requiring explicit approval for each exact remote migration after local preparation. Earlier general Supabase authorization covers necessary account/service setup, but is not blanket permission for a new remote migration. Privileged credentials must be entered through approved local tooling/secret storage, never browser env variables, chat logs or tracked files.
5. Only after approval apply the reviewed migrations using supported Supabase tooling. Verify migration history and authenticated allow/deny behavior afterward. Do not execute a reset or destructive recovery based solely on migration approval.

No automatic hosted migration is configured in this repository's CI. `supabase/config.toml` identifies `civic-flow-local`; the CLI's ignored `.temp/project-ref` separately records the linked hosted project. The user's external GitHub integration is independent of this repository's CI configuration.

## Auth settings and first Administrator

In the approved development/demo project, configure email signup, email confirmation, minimum password length 12, and disable anonymous sign-in. Allow exact `/auth/callback` and `/reset-password` URLs for the local origins (`http://127.0.0.1:5173` and `http://localhost:5173`) and approved deployed domain. Hosted Auth settings are operational settings: the local TOML does not change them remotely.

For the first Administrator, identify a specific verified Auth account by UUID. Obtain approval for a targeted operator promotion of its existing Citizen profile and record the bootstrap action in the deployment/setup log. Do not promote by arbitrary signup order, email-pattern matching or editable metadata. The ordinary admin RPC cannot bootstrap itself because it correctly requires an existing active Administrator.

The user selected six proposal-based service areas for the prototype. Applied migration 006 created their explicitly labelled prototype routing departments/categories; they do not claim to represent a real government organization. An Officer requires an active department. Existing-user admin controls can then allocate access; no Auth Admin secret is sent to the browser.

## Local work

With Docker available and a verified Supabase CLI, start a fresh local instance under this checkout. Starting an initialized local environment is separate from resetting it; inspect any existing local data before commands that can replace it. Copy the resulting local public URL/publishable key into ignored `.env.local` when targeting local services, and use the local email inbox for confirmation/recovery tests.

Until then, `npm.cmd run test:db` tests actual PostgreSQL grants, RLS, triggers and RPCs inside PGlite, with fixture Auth identities. `npm.cmd run db:types` derives table/enum/RPC types from the same migrations; this repository generator intentionally exposes table mutations as `never` to discourage raw client writes. It is not a hosted Supabase CLI type export. The test harness is not application authentication code and is never bundled into the frontend.

## Demonstration data (Sri Lanka)

`supabase/demo/sri-lanka-demo.sql` is data, not a migration. It is one atomic, idempotent `DO` block. Run it as the database owner, for example with the Supabase SQL editor, the MCP `execute_sql` tool or `psql -f`. Running it against a hosted project needs the same explicit approval as any other remote write.

| What it creates | Detail |
| --- | --- |
| People | 10 fictional Citizens (`…000101`–`…000110`) and Officers (`…000201`–`…000206`) only for departments that have **no** active Officer. Ids start `5e1a0000-0000-4000-8000-`, e-mails end `@demo.civicflow.test`, `encrypted_password` is empty and `raw_user_meta_data.demo` is `true`, so nobody can sign in as them. "Other public services" is never staffed, which leaves a coverage gap for the Dispatch centre. |
| Complaints | 36 complaints from real Sri Lankan towns and roads, using approximate public coordinates. 21 are resolved (19 rated), 4 in progress, 3 under review, 5 submitted (3 of them unassigned in the unstaffed department) and 3 withdrawn. One shows an Officer transfer from Road maintenance to Water supply. |
| How | The script calls the real RPCs (`submit_complaint`, `review_complaint`, `set_complaint_priority`, `start_complaint`, `add_progress`, `transfer_complaint`, `assign_complaint`, `resolve_complaint`, `withdraw_complaint`, `submit_feedback`) as each fictional actor, so auto-assignment, versions, history and notifications follow the live rules. Only the timestamps are then moved back up to about 6 months. Departments that already have Officers use them: their queues receive the demo work. |

Removal: `supabase/demo/remove-sri-lanka-demo.sql` deletes only demo complaints and their history, notifications and feedback, then the demo profiles and Auth users. It is **destructive** and needs explicit approval. It refuses to run, and deletes nothing, while real records depend on a demo person (for example a real complaint auto-assigned to a demo Officer). Reassign that work in the Dispatch centre first.

Tests: `supabase/tests/demo-data.test.ts` runs both scripts on fresh databases. It checks the lifecycle mix, history and notification consistency, Sri Lankan coordinates, the analytics trend, idempotency, reuse of existing Officers, and that removal is refused while in use and otherwise leaves real rows intact.

### Hosted application — 2026-10-30

The user approved adding the data to `xapqfnumcpjckhpdyuxz`.

1. A dry run on the hosted database aborted on purpose at the end, so it was fully rolled back. A follow-up query confirmed 0 demo rows remained.
2. The baseline md5 checksums were taken: complaints 6, events 17, notifications 18, feedback 0, profiles 7, categories 6, departments 6, Auth users 7.
3. The script ran once.
4. After the run, every baseline checksum of the pre-existing rows was **identical**.
5. The demo rows added were 14 people (10 Citizens; Officers for Water supply ×2, Sanitation and Public transport), 36 complaints, 157 events and 190 notifications (8 unread). There were also 19 ratings averaging 3.84.
6. No complaint has an event count that differs from its version, and no timestamp is in the future or older than 180 days.
7. Administrator analytics show submissions in every one of the last six months, 9 overdue open complaints and 3 unassigned complaints in Other public services, which has no Officers.

Road maintenance and Waste management already had Officers ("officer test" and "arkam"), so they handle those demo complaints.

## Officer migration/account setup — 2026-10-20

The specifically designated, invitation-verified first Administrator is active and its operator bootstrap is audited. The Administrator-only Officer invitation Edge Function is deployed. Auth redirects/minimum password settings are configured for the local app; existing TOTP/OTP/email-frequency and Storage global settings are preserved. The three workflow migrations were prepared for review, then specifically approved and applied on 2026-10-21. Review exact SQL, effects, concurrency/access contracts, recovery and final verification in [Officer portal notes](officer-portal.md). No existing migration was edited in place.
