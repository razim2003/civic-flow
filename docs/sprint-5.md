# Sprint 5 – Dispatch, coverage and product experience (CR-006, 2026-10-30)

## Why this change was needed (problem found in use)

During hosted testing the team found that a complaint could reach a department that had no Officers. Nobody could then see, assign or process it. A read-only check of the hosted project on 2026-10-30 confirmed it:

| Department | Active Officers | Open complaints | Unassigned |
| --- | --- | --- | --- |
| Road maintenance | 1 | 1 | 0 |
| Waste management | 0 | 2 | 2 |
| Water supply | 0 | 1 | 1 |
| Public transport | 0 | 1 | 1 |
| Sanitation, Other public services | 0 | 0 | 0 |

**Four of the five open complaints could never be handled.** The original design gave the Administrator monitoring access only, so the Administrator could see the problem but not act on it. The project owner asked for this inconsistency to be fixed and for the product to be completed, extended and redesigned. This is recorded as change request **CR-006** in [09-maintenance.md](sdlc/09-maintenance.md).

## What changed

| Area | Behaviour | Requirements |
| --- | --- | --- |
| Automatic assignment | `submit_complaint` assigns the least-loaded active Officer of the routed department (ties go to the longest-serving Officer). The submission event records `auto_assigned`. No Officer available means the complaint stays unassigned and is flagged. | CF-09, new CF-23 |
| Officer notifications | The assigned Officer is notified when a complaint is auto-assigned, assigned, reassigned or transferred to them. Officers now have an Updates inbox. | CF-13 |
| Dispatch centre | An active Administrator can route an open complaint to another department/category and/or assign an active Officer of that department, with a 10–2,000 character reason shared with the citizen. It is version-checked and audited in the complaint history, and notifies the citizen and the new assignee. Work in progress keeps its department and always has an assignee. Coverage cards show departments without Officers. | new CF-24 |
| Service-level targets | Each priority has a target: urgent 1 day, high 3, normal 7, low 14. Open complaints show "Due in…" / "Overdue by…" badges. Analytics counts overdue work and on-target resolutions. | new CF-25 |
| Analytics | Admin dashboard: status, priority, category and department coverage, Officer workload, resolution time, on-target rate, satisfaction distribution and a 6-month trend, plus a CSV export (formula-injection safe). | CF-21 (now delivered beyond "basic") |
| Community impact | Signed-in users see aggregate, non-identifying totals: reported, resolved, resolved in 30 days, average days to fix. | CF-21 |
| Department map | Officers see open department complaints on a map, coloured by priority, with popups linking to each complaint. | CF-08 |
| Experience | Full visual redesign ("civic signal" design system), dark mode, a public landing page, motion (page transitions, staggered tickets, count-ups, transit-line progress) that respects reduced-motion settings, and self-hosted fonts that meet the CSP. | NFR-03 |

Unchanged: the three roles; Administrators still can't review, start, progress or resolve complaints. No GPS tracking, AI classification, payments, emergency handling or field dispatch was added. "Dispatch" here means routing a ticket internally, not sending crews.

## Database contract (migration 015)

`20261029000400_dispatch_and_coverage.sql`, SHA-256 (LF) `f0c0721f80bbca75f8f8c722871c5864517d2de661abd7c23d41a6f36e39e776`.

- `private.sla_hours(priority)` (immutable) and `private.pick_officer(department)`. Both are unreachable by browser roles.
- `public.submit_complaint` replaced with the same signature and the same validation and idempotency rules. It now takes the shared administration advisory lock `(15,1761)` **before** any row lock (the same order as Officer workflows), so staffing can't change while an Officer is being picked.
- `private.record_officer_event` replaced: it also notifies the new assignee on `assigned`/`transferred`, but not an Officer who assigns themselves.
- New `public.admin_dispatch_complaint(id, department, category, officer?, expected_version, reason)`, `public.admin_analytics()` (Administrator only) and `public.community_impact()` (any active user; aggregates only). All are `SECURITY DEFINER`, `search_path=''`, with EXECUTE granted only to `authenticated`.
- No table, column, policy or existing row is changed by installation.

## Verification executed (2026-10-30)

| Check | Result |
| --- | --- |
| `npm run lint` / `npm run typecheck` | Passed |
| `npm run test` | **77 passed** (13 files), including SLA, dispatch and analytics/CSV rules |
| `npm run test:db` | **138 passed** (8 files): 15 new dispatch/auto-assignment/analytics tests, plus 5 updated assertions that now account for the assigned Officer's notification |
| `npm run db:types` | 8 tables, 20 RPCs. The generator now emits `Record<string, never>` for no-argument RPCs |
| `npm run build` | Passed |
| `npx playwright test` | **58 passed** (5 files), including 4 new journeys: dispatch, analytics with CSV, Officer inbox/map/SLA, landing and theme |
| `npm run test:integration` | Not run (Docker engine not running) |

## Hosted rollout — applied 2026-10-30

The user explicitly approved this single migration for `xapqfnumcpjckhpdyuxz` after reviewing the target, effects, validation and recovery plan below. It was applied through the project-scoped Supabase MCP connection.

| Step | Result |
| --- | --- |
| Baseline | History 001–014; none of the new functions existed; 6 complaints, 13 events, 5 evidence rows, 0 feedback, 13 notifications, 6 categories, 6 departments, 6 profiles, 5 Storage objects, 6 audit rows, each with an md5 checksum |
| Apply | `apply_migration` with the file content verbatim → success |
| History | The generated version `20261029190552` was renamed to `20261029000400` (a metadata-only change, as planned), so remote history 001–015 matches the repo |
| Data | All counts and md5 checksums **identical** before and after |
| Functions | `submit_complaint`, `admin_dispatch_complaint`, `admin_analytics`, `community_impact`, `pick_officer` and `record_officer_event` are `SECURITY DEFINER` with `search_path=""`. `sla_hours` is invoker with an empty `search_path`. Public RPCs: authenticated EXECUTE only. Private helpers: no browser EXECUTE. RLS is still on for every table |
| Anonymous REST | `admin_dispatch_complaint`, `admin_analytics` and `community_impact` → **401 / 42501** |
| Live read-only check | `admin_analytics()` run as the active Administrator inside a rolled-back transaction reports Public transport, Waste management and Water supply as unstaffed, with 4 unassigned open complaints, matching the problem report |
| Advisors | No new finding types. The expected definer-RPC WARN now lists 20 functions (all authorise internally). The private audit table INFO is deny-all by design. **Leaked-password protection is disabled** (an Auth setting; enabling it is recommended) |

Next operational step (a user action, not automated): sign in as the Administrator, open **Dispatch centre**, and route or assign the 4 stuck complaints, or invite Officers for the unstaffed departments.

### Plan as approved

1. Read-only baseline: counts and md5 checksums of all application tables and Storage object metadata.
2. Apply migration 015 verbatim, then rename its history row to `20261029000400`.
3. Verify the 3 new and 2 replaced functions (definer, empty `search_path`, grants), unchanged checksums, anonymous 401 on the new RPCs, and the security advisors.

Expected effect at install: none on data. Afterwards, new complaints get auto-assigned, and the Administrator can dispatch the 4 stuck complaints from the Dispatch centre. They are **not** moved automatically.

Recovery: forward-fix only. Revoking EXECUTE on `admin_dispatch_complaint` disables dispatch. A corrective migration that restores the previous `submit_complaint` body disables auto-assignment. No data deletion or reset.

## Demonstration data — 2026-10-30

The user asked for Sri Lankan sample data to check the system. `supabase/demo/sri-lanka-demo.sql` adds fictional Citizens and Officers who cannot sign in, plus 36 complaints across Sri Lankan towns covering every lifecycle state. Everything goes through the real RPCs, and the script was applied to the hosted project with explicit approval. Checksums of the existing data were unchanged. The design, safeguards, removal script and hosted verification are in [Database operations](database-operations.md#demonstration-data-sri-lanka), and the tests are TC-DB-DEMO-01…05 in the [test report](sdlc/07-test-report.md).
