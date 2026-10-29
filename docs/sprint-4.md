# Sprint 4 – Tracking & Resolution completion (2026-10-29)

## Scope and traceability

Sprint 4 in the approved proposal is "Citizen tracking, notifications/updates, resolution and feedback". Resolution (CF-12) was delivered on 2026-10-21 together with the Officer increment. This increment completes the remaining Sprint 4 backlog in roadmap order and the Should Have category maintenance that the roadmap carried forward "for completion by Sprint 4":

| CF ID | Priority | Delivered behaviour | Owner (proposal allocation) |
| --- | --- | --- | --- |
| CF-19 | Should | A Citizen gives one 1–5 rating and an optional comment (up to 2,000 characters) on their own **Resolved** complaint. The feedback can't be changed afterwards. An identical retry returns the stored record; a different second submission is refused. The Officers in that department and Administrators can read it. | 1731 Citizen UI, 1761 DB, 1776 tests |
| CF-13 | Must | "Updates" inbox for Citizens: durable notifications (already written atomically by every complaint RPC) are listed newest first with an unread badge, an unread-only filter, mark-as-read and mark-all-as-read. Text is built from the authorised history event and rendered as plain text. | 1731 Citizen UI, 1757 workflow data, 1761 DB |
| CF-20 | Should | Administrator "Service categories" page: create, rename, describe, activate/deactivate and route categories. Changes are audited, and categories are never deleted. A category that already has complaints keeps its department. An active category must route to an active department. Names are unique without regard to case. | 1761 Admin & DB, 1710 categories, 1776 tests |
| CF-21 | Could | Read-only Administrator monitoring overview: complaint counts by status, the open total, the feedback count and the average rating. Administrators still cannot process complaints. | 1761 admin dashboard |

No new role, workflow state, cancellation/reopening path, external notification channel (SMS/email/push) or other excluded feature was added. The three actors, five sprints and Milestones 1–3 are unchanged.

## Design decisions

- **Feedback is immutable and owner-only.** `submit_feedback` derives the Citizen from `auth.uid()` and locks the Citizen profile and then the owned complaint, the same lock order as withdrawal and uploads. It checks Resolved inside the transaction. No UPDATE/DELETE grant exists. Feedback does not change the complaint version or history, because it is not a workflow transition.
- **Read state is the only mutable notification field.** `mark_notifications_read(ids[], all)` updates `read_at` only on the caller's own unread rows. Explicit ID lists are bounded to 1–100. The recipient, event and kind can't be changed. RLS also hides the notifications of an inactive account.
- **Categories are reference data with history.** `admin_upsert_category` shares the administration advisory lock `(15,1761)` with user administration and Officer workflows. It appends `category_created`/`category_updated` audit events (the action values already allowed by the foundation migration) to the private audit table. No-op saves write nothing.
- **Monitoring needs no new SQL.** Administrator monitoring uses existing RLS (an Administrator can already read every complaint) with head-only counts. Enhanced analytics and exports remain optional Could Have work.
- **Frontend boundaries.** New `feedback/`, `notifications/` and `categories/` features follow the existing `ui → application → model/data` layers. The complaint detail page composes the public `FeedbackPanel`, and the app shell imports only the lightweight `notifications/badge` entry, so the inbox and complaint pages stay lazily loaded.

## Verification executed on 2026-10-29

Windows 11, portable Node.js 22.23.4 (the project requires ≥ 22.18), Microsoft Edge for Playwright.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed (0 warnings) |
| `npm run typecheck` | Passed (app + Edge Function configs) |
| `npm run test` | **69 passed** in 10 files (+13 for feedback/inbox/category/monitoring rules) |
| `npm run test:db` | **119 passed** in 7 files, with all 14 migrations applied to fresh PGlite databases (+23 Sprint 4 RLS/RPC tests) |
| `npm run db:types` | Regenerated 8 tables and 17 public RPCs; the generator now supports array and nullable RPC arguments |
| `npm run build` | Passed, with no bundling warnings after the badge entry split |
| `npx playwright test` | **54 passed** in 4 files (+8 Sprint 4 journeys). The 46 pre-existing journeys still pass. |
| `npm run test:integration` | **Not run.** The Docker Desktop engine was not running. The last recorded run (9 passed, 2026-10-21) predates the Sprint 4 SQL. |

One regression test failed as designed: `foundation.test.ts` asserted that feedback and notifications stay unreadable "until its policies ship". Because the policies now ship, it was changed to check authorised reads with direct writes still denied. Row-level allow/deny cases are in `supabase/tests/sprint4.test.ts`.

Browser tests intercept all Supabase traffic and use fictional data. They prove UI behaviour and request contracts, not hosted authorization. The SQL suite proves the authorization rules inside PostgreSQL using non-privileged roles.

## Hosted migration rollout — applied 2026-10-29

**Applied** to project `xapqfnumcpjckhpdyuxz` on 2026-10-29 after the user gave explicit approval in-session for exactly these three files. The approval followed the review below. The Supabase MCP connection (scoped to this project by `.mcp.json`) now had project access. The Supabase CLI was not linked, so `apply_migration` ran each reviewed file verbatim in order.

| Step | Result |
| --- | --- |
| Hash check | Working-tree files are CRLF on Windows. Their LF content matched the three reviewed SHA-256 hashes, as did `git show HEAD:` |
| Preflight | Remote history 001–011 only. None of the three functions existed. RLS was on for all 9 tables |
| Baseline (counts) | 6 Auth accounts and 6 profiles (1 active Administrator), 5 complaints, 11 events, 4 evidence rows, 4 Storage objects, 11 notifications, 0 feedback, 6 categories, 6 departments |
| Apply | 012 → 013 → 014 each reported success |
| History alignment | The MCP tool recorded generated versions (`20261029174637/174652/174708`). With separate user approval, those 3 `supabase_migrations.schema_migrations` rows were renamed to `20261029000100/200/300`, the same metadata-only change `supabase migration repair` makes, so the CLI history matches the repo. Remote history is now 001–014 |
| Data checksums | Counts and per-table md5 checksums (complaints, events, evidence, feedback, notifications, categories, departments, profiles, storage objects) were **identical** before and after |
| Functions | All three are `SECURITY DEFINER`, `search_path=""`, with authenticated EXECUTE and no EXECUTE for `anon` or `public` |
| Policies/grants | `complaint_feedback_read` and `notifications_read` exist for `authenticated`. Only `authenticated` has SELECT on these tables, and there are no write grants. RLS is still on for all tables |
| Anonymous REST | `POST /rest/v1/rpc/submit_feedback`, `mark_notifications_read` and `admin_upsert_category` → **401 / 42501**. `GET complaint_feedback` and `notifications` → **401 / 42501** |
| Security advisors | Nothing new. The expected `authenticated_security_definer_function_executable` WARN now lists 17 RPCs, all of which check authorization themselves. `rls_enabled_no_policy` INFO is for the private audit table (deny-all by design). Leaked-password protection is disabled (an existing Auth setting) |

Not yet done: a signed-in hosted smoke test of feedback, the inbox and category saves with real role accounts. This belongs to the deployment smoke test in [08-deployment.md](sdlc/08-deployment.md).

### Reviewed plan (as approved)

Target: Supabase project `xapqfnumcpjckhpdyuxz` (`https://xapqfnumcpjckhpdyuxz.supabase.co`), which contains real accounts and complaints. Do not reset it or run synthetic journeys there.

| Order | File | SHA-256 | Effect |
| --- | --- | --- | --- |
| 1 | [20261029000100_citizen_feedback.sql](../supabase/migrations/20261029000100_citizen_feedback.sql) | `4c4eaade520e44beb2e0a5a3edea70a1f72cc7bcbca3da3f38f23ded786fafa4` | Grants SELECT on `complaint_feedback` to `authenticated`, adds the read policy and creates `submit_feedback` with an authenticated-only EXECUTE grant |
| 2 | [20261029000200_notification_inbox.sql](../supabase/migrations/20261029000200_notification_inbox.sql) | `23ad8d3b96f1a2f48b9e7a7f3d8ffe02bc9f232d5a2e48c99b2523d093304f67` | Grants SELECT on `notifications`, adds the recipient-only read policy and creates `mark_notifications_read` |
| 3 | [20261029000300_category_management.sql](../supabase/migrations/20261029000300_category_management.sql) | `6b73ed949e554b24287a44c7ffcbba56f2b7ee4c6ea9a1f6fbb18f68668145c7` | Creates the audited `admin_upsert_category` |

Expected data effects: none at installation. Each file is one transaction that adds grants, policies and functions and reloads the PostgREST schema cache. No existing complaint, notification, category, account, evidence or Storage object is changed. Later authorised user actions will insert feedback rows, set `read_at` and create or update categories with audit rows.

Planned validation before applying: recheck the hashes above, run `supabase db push --linked --dry-run` (it must list exactly these three files) and take read-only baseline counts and checksums with `supabase/operations/inspect-officer-rollout.sql`.

Planned validation after applying: confirm migration history, confirm the three functions are `SECURITY DEFINER` with an empty `search_path`, authenticated EXECUTE and no anonymous EXECUTE, confirm RLS is still enabled on all nine tables, confirm unchanged baseline counts and checksums, and confirm that an anonymous REST call to `/rest/v1/rpc/submit_feedback` returns 401/42501.

Recovery: stop using the new screens and apply a reviewed forward corrective migration (for example, a grant-only revoke of EXECUTE). Do not drop tables, reset the database or delete feedback, notifications or audit rows. A data restore needs separate approval and a restorable backup.
