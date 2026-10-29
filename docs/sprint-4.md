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

## Hosted migration review — awaiting explicit approval

**Not applied.** AGENTS.md requires explicit approval for each remote migration. The Supabase connection available in this session also returned *permission denied* for project `xapqfnumcpjckhpdyuxz`, because the connected account can only see a different project. Until these are applied to the hosted project, the deployed backend will refuse the new features. Feedback and the inbox show a "service not available" message, and category saves are rejected. Existing features are unaffected.

Target: Supabase project `xapqfnumcpjckhpdyuxz` (`https://xapqfnumcpjckhpdyuxz.supabase.co`), which contains real accounts and complaints. Do not reset it or run synthetic journeys there.

| Order | File | SHA-256 | Effect |
| --- | --- | --- | --- |
| 1 | [20261029000100_citizen_feedback.sql](../supabase/migrations/20261029000100_citizen_feedback.sql) | `4c4eaade520e44beb2e0a5a3edea70a1f72cc7bcbca3da3f38f23ded786fafa4` | Grants SELECT on `complaint_feedback` to `authenticated`, adds the read policy and creates `submit_feedback` with an authenticated-only EXECUTE grant |
| 2 | [20261029000200_notification_inbox.sql](../supabase/migrations/20261029000200_notification_inbox.sql) | `23ad8d3b96f1a2f48b9e7a7f3d8ffe02bc9f232d5a2e48c99b2523d093304f67` | Grants SELECT on `notifications`, adds the recipient-only read policy and creates `mark_notifications_read` |
| 3 | [20261029000300_category_management.sql](../supabase/migrations/20261029000300_category_management.sql) | `6b73ed949e554b24287a44c7ffcbba56f2b7ee4c6ea9a1f6fbb18f68668145c7` | Creates the audited `admin_upsert_category` |

Expected data effects: none at installation. Each file is one transaction that adds grants, policies and functions and reloads the PostgREST schema cache. No existing complaint, notification, category, account, evidence or Storage object is changed. Later authorised user actions will insert feedback rows, set `read_at` and create or update categories with audit rows.

Validation before applying: recheck the hashes above, run `supabase db push --linked --dry-run` (it must list exactly these three files) and take read-only baseline counts and checksums with `supabase/operations/inspect-officer-rollout.sql`.

Validation after applying: confirm migration history, confirm the three functions are `SECURITY DEFINER` with an empty `search_path`, authenticated EXECUTE and no anonymous EXECUTE, confirm RLS is still enabled on all nine tables, confirm unchanged baseline counts and checksums, and confirm that an anonymous REST call to `/rest/v1/rpc/submit_feedback` returns 401/42501.

Recovery: stop using the new screens and apply a reviewed forward corrective migration (for example, a grant-only revoke of EXECUTE). Do not drop tables, reset the database or delete feedback, notifications or audit rows. A data restore needs separate approval and a restorable backup.

To apply after approval, someone with access to the project would use either option:

```bash
supabase db push --linked --project-ref xapqfnumcpjckhpdyuxz --skip-vault --dry-run
supabase db push --linked --project-ref xapqfnumcpjckhpdyuxz --skip-vault
```

or the Supabase MCP `apply_migration` tool from an account that is a member of the project.
