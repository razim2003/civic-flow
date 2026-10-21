# Officer portal and Administrator-created accounts

## Scope and module ownership

This increment implements CF-08/09/10/11 in Sprint 3, followed by the separately versioned CF-12 resolution portion of Sprint 4. CF-13 updates are written atomically and visible through the existing Citizen timeline; an inbox/read state and CF-19 feedback remain Sprint 4 backlog. CF-14 now includes Administrator-created Officer invitations, explicitly requested on 2026-10-20. Category management and enhanced monitoring are still backlog. Original actors, allocation, five sprints and Milestones 1–3 remain unchanged.

Current hosted status: the user explicitly approved the three exact migrations on 2026-10-21. All three were applied to `xapqfnumcpjckhpdyuxz`; migration history, routine permissions, unchanged existing data checksums and anonymous denial were verified. Officer processing/resolution is activated. See the final activation record below.

`features/officer/model` owns pure input rules, `application` coordinates reads/mutations/refresh, `data` contains all Supabase queries/RPC calls and `ui` contains the overview, queues and actions. Assignment/priority remain allocated to 1710, Officer workflows to 1757, database/admin enforcement to 1761 and verification to 1776. The shared complaint detail exposes an action slot and its existing evidence/history UI. No second client, API server or global state package is introduced.

## Visible behavior

- Shared green/cream email/password login; database role selects the workspace. No public Officer role selector or Officer signup.
- Officer overview with real department/open/assigned counts, department queue, Assigned to me, profile and sign-out.
- Ten-item paginated department/assigned queues with description/full-UUID search and status/category/priority filters.
- Complaint detail/location, read-only private evidence downloads and history. Processing includes review, active same-department assignment, priority, start, progress, transfer and resolution confirmation.
- Only the assigned Officer starts work, adds progress or resolves. Transfer before work starts validates a destination category/department and clears assignment. Old-department access ends immediately after transfer.
- Resolved and Withdrawn remain readable but reject every processing mutation. Stale writes preserve input, report the conflict and require a deliberate refresh. An uncertain response is never retried automatically; inspect current history first.
- Administrator → User management → Create Officer account asks for name, email and active department, sends an invitation and grants Officer access through the existing audited RPC. Passwords are chosen by recipients through `/accept-invite`.

## Database contracts and risks

No new table or application-data backfill is needed. New functions are security-definer with an empty search path, qualified names and explicit live authorization. Browser app-table DML remains revoked and existing RLS/Storage policies remain in force. The roster returns only active Officer IDs/names, never email or other profiles.

`private.lock_officer_complaint` shares advisory lock `(15,1761)` with user administration, locks the current Officer/active department, takes the Citizen profile key-share lock before the complaint lock, checks the current department, rejects final states and compares the expected version. Each real write increments the version and writes an event plus Citizen notification in the same transaction. Assignment/priority unchanged requests are no-ops at the current version. Remarks/progress are at most 2,000 characters; transfer and In Progress reassignment reasons require 10–2,000; resolution requires 10–5,000. All remarks are Citizen-visible plain text.

The shared advisory lock serializes staffing and Officer writes across the small prototype. This deliberately favors understandable access/concurrency safety over throughput; revisit with measured load before broad public release. Lock order also avoids an Officer notification/withdrawal deadlock by locking the Citizen before the complaint. Real concurrent-session checks are recorded below.

The Edge Function disables the platform's legacy JWT gate only because it verifies every actual request using Supabase Auth `getUser`, then checks live Administrator access. A publishable key or decoded JWT role is insufficient. The runtime's service/secret key exists only inside the privileged invitation adapter, after caller authorization. CORS and invitation redirects are fixed server configuration, not authority supplied by a form. Set `CIVICFLOW_APP_URL` in Supabase server secrets for an approved deployed origin before release; the current default is `http://127.0.0.1:5173`.

Auth invitation and profile promotion cannot be one database transaction. A promotion failure leaves a Citizen profile without Officer privileges and returns an explicit pending-access error. An invitation/network error may have sent email: check User management before trying again. No account deletion, password setting by an Administrator or automatic email retry is performed. Built-in Auth email delivery/rate limits and a production SMTP provider remain operational considerations. A deployable public service should review abuse/rate limits before broad release.

Supabase's default mail service sends only to project-team addresses and has a small hourly limit. Inviting Officers at other addresses requires operator-configured custom SMTP; this was not configured as part of this increment. The UI reports known address-delivery/rate-limit refusals without claiming account creation succeeded or retrying automatically. Never grant an application Officer Supabase organization/project access merely to bypass email restrictions. See the [official SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).

## Conflict error correction discovered through HTTP testing

The first real concurrent-review test exposed an application error-code issue that embedded SQL tests and mocked browser responses cannot detect: PostgREST 14 repeatedly retries custom SQLSTATE `40001`. The test remained in a retry loop in its dedicated local containers. It was stopped by revoking that test function's execution in the disposable fixture, then all owned fixtures were removed; no hosted endpoint or data was used for the race.

The Officer helper now raises `PT409` for a stale expected version. Applied migration 008 is preserved, and a new migration replaces only the withdrawal routine with the same `PT409` correction. This preserves ownership, bounds, lifecycle, locking and retry-idempotency rules while returning HTTP 409 promptly. Browser mocks now model the actual code. A direct stale Citizen withdrawal and concurrent Officer review are explicit HTTP regressions. See the [official Supabase explanation](https://github.com/orgs/supabase/discussions/50151). Production requests are never used to reproduce the retry loop.

## Exact remote migration review — approved and applied

Target: configured hosted CivicFlow project `xapqfnumcpjckhpdyuxz` (`https://xapqfnumcpjckhpdyuxz.supabase.co`), currently containing real accounts/complaints/evidence. Do not reset it or run synthetic test journeys there.

Exact SQL approved by the user and applied on 2026-10-21:

1. [20261020000100_officer_processing.sql](../supabase/migrations/20261020000100_officer_processing.sql): two private helpers and seven public RPCs for the roster/review/assignment/priority/start/progress/transfer; authenticated-only execute grants and PostgREST cache reload.
2. [20261020000200_officer_resolution.sql](../supabase/migrations/20261020000200_officer_resolution.sql): assigned-Officer resolution RPC, authenticated-only execute grant and cache reload.

3. [20261021000100_non_retrying_withdrawal_conflict.sql](../supabase/migrations/20261021000100_non_retrying_withdrawal_conflict.sql): replace the already-applied withdrawal function with identical authorization/business rules and a non-retryable `PT409` stale-version error; restate its existing narrow grants.

All three files are transactional. Installation creates/replaces routines/grants only; it changes no existing complaint/account/history/notification/evidence row, table, bucket or policy. Future authorized workflow calls intentionally update a complaint and append its history/notification. Migration 002 follows processing so resolution remains a separately reviewable Sprint 4 delivery.

Validation before execution: full migration-based local PostgreSQL tests, bounded validation tests, browser journeys, generated database types, strict frontend/function typecheck, lint/build; read-only hosted history/count/checksum baseline and CLI dry run. After approved execution, compare hosted baseline counts/checksums, verify migration history, function authorization/search paths/grants and anonymous denial. Never create hosted test complaints to prove RLS.

Recovery: stop Officer processing and use a reviewed forward corrective migration if needed. Emergency removal of browser execution privileges can be done through a specifically reviewed grant-only migration. Existing source/data remain intact; do not drop tables/functions indiscriminately, undo Citizen changes, remove real accounts or restore a stale database over newly written records. A data restore/reset requires separate explicit approval and an appropriate restorable backup. The metadata/checksum snapshot is validation evidence, not a full backup.

The user's latest supplied AGENTS instructions required explicit approval of these exact remote migrations, despite earlier general permission for necessary Supabase setup. Execution was held until the user answered “Approve these three migrations.” That approval covers only these files and this target; future remote migrations still need their own approval.

## Account/service setup already authorized

On 2026-10-20 the user explicitly designated the first Administrator and asked us to register it. Supabase Admin Auth sent one invitation through an operator-only process. The returned project key was used in memory, never printed, persisted or added to frontend configuration. After the user accepted the invitation and set their own password, a read-only check confirmed verified email, active Citizen profile and zero active Administrators. The reviewed/tested [bootstrap operation](../supabase/operations/bootstrap-administrator.sql) promoted only that explicit verified account and appended one `user_updated` audit event with source `user_authorized_operator_bootstrap`. A post-check confirmed active Administrator, null department and exactly one bootstrap audit. No password was needed for the operator action.

Hosted Auth originally pointed to port 3000 with no redirect allowlist and a six-character password minimum. Current settings use the local port 5173, exact callback/reset/invitation URLs on localhost/127.0.0.1, confirmation enabled, anonymous sign-in disabled and minimum length 12. CLI `config push` applies immediately: an initial inspection attempt unexpectedly applied Auth defaults and attempted a paid Storage vector change. The Storage change was rejected; TOTP enrollment/verification, eight-digit OTP and one-minute email frequency were promptly restored to their prior values. A subsequent push confirmed Storage unchanged (50MiB global ceiling, vector disabled); the private evidence bucket still separately enforces 5MiB. Local config now records those settings to prevent future default drift.

The single `provision-officer` Edge Function was deployed with the CLI API bundler to this project. No Vercel deployment, Git push/commit, complaint test data, deletion or reset was performed.

## Verification record

Earlier Officer implementation checks (2026-10-21; completion-refinement results follow below):

| Check | Actual result |
| --- | --- |
| `npm.cmd run test -- --maxWorkers=1` | 42 passed, including invitation caller/role/input/provider/partial-failure and session-boundary checks |
| `npm.cmd run test:db` | 96 passed, applying all 11 migrations to fresh PGlite instances |
| `npm.cmd run test:integration` | 9 passed with real Auth user JWTs and PostgREST HTTP: owner/department/inactive/role denial, metadata escalation, non-retrying stale withdrawal, concurrent review, resolution/withdrawal race, transfer access loss, rollback and concurrent last-Administrator protection |
| `npm.cmd run typecheck` | Passed, including the separate Edge Function TypeScript configuration |
| `npm.cmd run lint` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run db:types` | Regenerated 8 tables / 14 public RPCs from all 11 migrations |
| `npm.cmd run test:e2e` | 33 passed; one cold Vite startup redirect assertion exceeded its initial five-second wait. The failure snapshot already showed the login UI. That single check now waits for login-page readiness (15-second bound), then verifies the URL and absence of Administrator navigation; targeted rerun passed (1/1). The full-suite command remains recorded as 33 passed / 1 cold-start failure; it is not represented as a clean 34/34 run |
| Hosted dry run | Only the three exact migrations above are pending; no SQL applied |
| Deployed invitation service | Latest function deployed; anonymous and invalid-token requests both return 401 `not_authenticated` without sending invitations |

Initial Windows unit runs hit worker-startup timeouts while local services were running. Pure model/HTTP tests now use Node, React DOM setup runs only when a document exists, and the unit worker count is bounded. The final 42-test command passed without unhandled errors. The original proposal PDF, dependency versions and application session/authorization decisions were preserved.

PGlite exercises actual migration SQL with fixture identities/Storage metadata. Browser tests intercept Supabase and do not prove hosted authorization. `npm run test:integration` creates uniquely named disposable PostgreSQL 17, Supabase Auth and PostgREST containers using already-installed images, issues real Auth user JWTs, checks direct HTTP allow/deny behavior and concurrent mutations, then removes only those newly created fixtures. It never reads `.env` or contacts hosted Supabase. It still uses a Storage SQL fixture, not the Storage HTTP service; full Storage and Edge runtime integration remain separate release checks.

Primary implementation references: [Supabase function authentication](https://supabase.com/docs/guides/functions/auth), [new API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), [Auth users and invitations](https://supabase.com/docs/guides/auth/users).

The Administrator module is intentionally not marked complete: CF-20 category maintenance and complaint monitoring remain backlog, and custom SMTP is required before inviting arbitrary external Officer emails. This increment delivers account/user management and Administrator-created Officer provisioning only.

## Officer completion refinement — 2026-10-21

The user requested completion after creating an Officer account and visiting the workspace. The pre-approval read-only inspection found only the original eight hosted migrations and no Officer workflow routines. At that stage the three reviewed SQL files were unchanged and awaiting specific approval; creating an Officer identity does not install workflow functions. The user subsequently approved the migrations, as recorded below.

CF-08/09/11/12/17 refinements: department reports and counts remain readable when the assignment-roster routine is explicitly missing (`PGRST202`/`42883`), with a visible activation notice. Other failures, including authorization denial, still fail closed. Processing is disabled until the roster check succeeds; Check again can activate the controls without losing the session after setup. No fallback data or client-side authorization is introduced.

Search/status/category/priority/assignment/page filters now live in bounded URL parameters. Officers can find unassigned complaints and return from a detail page to the same department or Assigned to me filters. Return navigation accepts only the two internal Officer queue paths. Clear filters resets the whole queue selection. An out-of-range page offers a return to the first page. The overview has manual refresh and an explicit path to include closed reports.

Processing shows stage-specific next-step guidance. Assignment and priority controls use current complaint values until edited, so a refresh does not leave an untouched selector stale. No-op RPC responses say no change was needed rather than claiming a new audit event. Team-loading, denied-access and missing-setup states never expose active processing controls. Existing role/department/assignee checks and terminal-state behavior remain authoritative in SQL.

New verification covers URL bounds/navigation, missing-workflow read-only behavior with a private evidence download, recovery after activation, denied roster access, unassigned filtering and return navigation, other-assignee controls, required reassignment reasons and accurate no-op feedback. No new schema or additional product scope was added by these UI refinements.

Completion-refinement checks executed on 2026-10-21, before the later approval/activation:

| Check | Actual result |
| --- | --- |
| `npm.cmd run test -- --maxWorkers=1` | 46 passed |
| `npm.cmd run test:db` | 96 passed against all 11 migration files in fresh PGlite fixtures |
| `npm.cmd run typecheck` | Passed, including Edge Function types |
| `npm.cmd run lint` | Passed |
| `npm.cmd run build` | Passed |
| `npm.cmd run test:e2e -- --workers=1` | 39 passed, including all 10 Officer journeys and Citizen/Administrator regressions |
| Desktop/mobile visual review | Inspected generated Officer overview and closed-complaint mobile screenshots; no clipped controls or horizontal overflow observed |
| Local preview | `http://127.0.0.1:5173/login` returned HTTP 200 |
| Remote changes | None; the same three reviewed migrations remain pending explicit approval |

The first targeted Officer run passed 9/10: its return-navigation test clicked the sidebar before the detail view finished loading. The test now waits for the detail return link and asserts its exact filtered destination before clicking. The final full 39-test command above passed. Browser requests are intercepted fixtures; these results do not claim a hosted processing journey or hosted authorization test. SQL was unchanged in this refinement, so the earlier nine real Auth/PostgREST integration results remain applicable and were not rerun. No hosted test identities, complaint writes, invitations, migrations, deployment or Git commit/push occurred in this refinement.

## Approved hosted activation — 2026-10-21

The user answered “Approve these three migrations” to the question identifying all three filenames, exact target `xapqfnumcpjckhpdyuxz` and this review/recovery plan. The linked project reference and the reviewed files' SHA-256 hashes were checked before execution. No migration file was edited during rollout.

| Approved migration | SHA-256 |
| --- | --- |
| `20261020000100_officer_processing.sql` | `FDF060FC4C2EF3A37B2C0488C1F81E3E7914754BB9E2C31544099AE7E17F2C9A` |
| `20261020000200_officer_resolution.sql` | `402343FE3DF77BC2050AEB4EF3BCD34150B02173F0947A2CC7C24F04828BB635` |
| `20261021000100_non_retrying_withdrawal_conflict.sql` | `F2B4FF15C5E354F4CDE1417B3822038E0214F22041349C05FA2017A6C0EA0528` |

Execution was sequential through the authenticated CLI: read-only baseline using `supabase/operations/inspect-officer-rollout.sql`, `supabase.cmd db push --linked --project-ref xapqfnumcpjckhpdyuxz --skip-vault --dry-run`, then the approved push with `--yes` and without `--dry-run`. The dry run listed exactly these three files, no seeds or role changes. The push completed successfully for all three. A fresh read-only inspection and programmatic assertions confirmed:

- The prior eight migration versions plus exactly the three approved versions are recorded remotely.
- Before/after counts and checksums match for complaints, events, evidence, feedback, notifications, categories, departments and Storage object metadata. Auth-account and active-Administrator counts are unchanged.
- All eight public Officer RPCs exist as security-definer functions with an empty fixed search path, authenticated execution and no anonymous execution. Both private helpers have the same fixed search path and are not executable by either browser role.
- The installed withdrawal function uses `PT409` for stale versions.
- A read-only roster RPC request with the public publishable key and no user token returns HTTP 401 / `42501`. The same read request with an invalid bearer token returns HTTP 401 / `PGRST301`. No workflow mutation was invoked for these checks.

The before/after metadata snapshots are retained under ignored `tmp/officer-rollout/approved-20261021-082037-*.json`; they contain aggregate checksums/routine metadata, not complaint text, account emails, attachment paths or credentials. They are validation evidence, not a full data backup. `npm.cmd run db:types` also completed after rollout, regenerating types from the same 11 migration files (8 tables / 14 public RPCs). Recovery remains the reviewed forward-correction plan above; no reset, deletion or destructive recovery was necessary.

No existing complaint was processed automatically, no account access was changed, and no hosted test identities or invitations were created. Positive lifecycle/authorization/concurrency evidence remains the local SQL and real Auth/PostgREST tests recorded above; a signed-in hosted Officer journey was not automated with a real user's credentials. On an already-open activation notice, choose Check again to load the installed roster without losing the in-memory session. A fresh sign-in also opens the enabled workflow. No frontend deployment, Git commit or Git push was performed.
