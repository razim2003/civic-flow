# Implementation roadmap

## Preserve the approved plan

The proposal uses Agile/Scrum (pp. 7-8), five ordered sprints (p. 10), the allocation on p. 11, and Milestones 1-3 on pp. 16-17. No dates, sprint durations or additional numbered academic milestones are invented here.

At every sprint: Planning -> Design -> Implementation -> Testing -> Review -> Feedback -> Backlog Refinement. Keep a usable demonstrable increment, update traceability and record lecturer-approved scope changes.

## Original task allocation

| Member | Main area in proposal | Responsibilities preserved |
| --- | --- | --- |
| TG/2023/1731 | Requirements & Citizen Module | Stakeholder analysis, requirements, user stories, citizen registration, login, profile, complaint submission |
| TG/2023/1710 | Complaint Management Module | Categories, complaint details, evidence upload, assignment, priority |
| TG/2023/1757 | Officer Module | Officer dashboard, review, status updates, progress remarks, resolution |
| TG/2023/1761 | Admin & Database | Database/ER design, user management, category management, admin dashboard, database integration |
| TG/2023/1776 | Quality, Security & Deployment | Test planning, system/integration testing, security controls, error handling, deployment, maintenance change request |

Assignment/priority UI and use cases remain with TG/2023/1710, consumed by the Officer Module. Database enforcement remains with TG/2023/1761, reviewed with workflow and quality owners. Category selection/details belong to Complaint Management; administrative category mutation belongs to Admin & Database. Feature ownership does not mean each owner implements an independent auth or database client.

## Separately deliverable modules

| Module | Owner(s) | Inputs and output contract | Dependency |
| --- | --- | --- | --- |
| Auth/roles/profile | 1731; 1761 for DB, 1776 security | Auth identity -> active typed profile and protected session | Foundation |
| DB and access controls | 1761; 1776 review | SQL migrations -> constrained schema, RLS and RPCs | Agreed workflow/access assumptions |
| Categories/complaint creation | 1710 + 1731 | Validated citizen form -> committed Submitted complaint UUID | Auth + DB; category lookup |
| Location | 1731 with 1710 integration | Map/coordinate input -> bounded coordinates and text | Complaint form |
| Evidence | 1710; 1761 policies, 1776 tests | Optional supported file -> private attached evidence | Saved complaint + Storage policies |
| Assignment/priority | 1710; 1757 integration | Authorized officer intent + version -> audited assignment/priority | Officer queue + protected RPCs |
| Officer/workflow | 1757; 1761 DB | Review/start/progress/resolve -> next authorized state/history | Auth + complaint records + assignment |
| Citizen tracking/updates | 1731; 1757 workflow data | Own complaint ID -> state, timeline, durable notifications | Workflow events |
| Feedback | 1731 citizen UI; 1761 DB, 1776 tests | Resolved owner's rating/comment -> one feedback record | Resolution |
| Admin | 1761; 1776 security tests | Permitted existing-user/category changes -> audit record | Roles + DB |
| Quality/release | 1776, all feature owners | Integrated increments -> test evidence and Vercel release | Every module |

Member IDs in this module table abbreviate only the final four digits of the full IDs above. Notifications/feedback are implementation work packages within the allocated Citizen/Officer/Database responsibilities, not a reassignment of the original main areas.

## Sprint 1 - Foundation & Authentication

Scope: project setup, database foundation, registration, login, roles and basic UI, exactly as proposed.

1. Review design assumptions: status sequence, department/assignment permissions, immutable submission details, session persistence tradeoff, upload bounds, and first-admin bootstrap. Record decisions without altering the approved proposal.
2. Scaffold React/TypeScript/Vite and Tailwind; select compatible versions and commit lockfile. Add routing, shared layout, public-env validation, lint/typecheck, Vitest and Playwright setup. Do not add unrelated dependencies.
3. Verify Docker engine and CLI access; initialize an isolated local Supabase project. Author tables/default-deny controls/signup trigger migrations, then auth/profile/admin foundation functions. Never expose a table before its RLS/grants.
4. Implement Citizen signup/login/logout and role navigation; an admin can manage existing app users through audited operations. Create synthetic Citizen/Officer/Admin fixtures through local tooling only.
5. Add auth/profile/RLS tests, including crafted signup metadata, inactive old JWT, own-profile access and admin-only changes. Set CI to local verification without hosted migration credentials.

Exit: fresh local setup documented; each role lands in the correct basic workspace; protected backend calls reject wrong roles and inactive users. Deliver a usable auth increment and review evidence. History structures are present so later work never loses audit events.

## Sprint 2 - Complaint Submission

Scope: form, categories, validation, evidence and complaint record creation.

- Deliver CF-04/05/06, map location selection, private optional evidence, and citizen list/detail confirmation. Add profile management if capacity permits.
- Implement submission idempotency, active category routing and server-side validation. Uploads follow reserve/upload/finalize and surface partial failures accurately.
- Add minimal admin category maintenance for maintainable lookup data (Should Have), preserving its priority behind Must Have work.
- Test bounds, inactive categories, ownership, repeated submit, Storage foreign paths/types/limits and upload retry. Demonstrate one submitted complaint with a selected location and optional private attachment.

Exit: citizens can submit and revisit only their own records; no unauthenticated or foreign-user retrieval; evidence failure does not lose the complaint.

## Sprint 3 - Complaint Processing

Scope: officer dashboard, assignment, priority, status and progress remarks.

- Deliver department queue, exact-ID search and useful status/category/priority filters (Should Have search retained).
- Implement review, assign/reassign, department transfer, priority, start and progress operations. Build history/notification writes into these transactions now, even though full tracking UX arrives in Sprint 4.
- Test invalid transitions, wrong assignee/department, inactive officers, direct DML bypass, concurrency and atomic event creation.

Exit: officers can process only permitted complaints; stale writes fail visibly; citizens can inspect the latest committed progress through a basic detail page.

## Sprint 4 - Tracking & Resolution

Scope: citizen tracking, notifications/updates, resolution and feedback.

- Complete citizen timeline and in-system notification list/read state. No SMS/email dependency for complaint updates.
- Implement assigned-officer resolution with required text/date and atomic update/history/notification.
- Implement one post-resolution owner feedback record; finish remaining profile/search/category Should Have work if it was deferred. These stay visible in the backlog rather than being silently dropped.
- Test full submission-to-resolution journey, cross-user privacy, duplicate feedback and updates after refresh. Add only minimal queue/monitoring counts; enhanced reports remain Could Have.

Exit: a complete three-role complaint lifecycle with history and feedback is demonstrable using synthetic data.

## Sprint 5 - Quality & Release

Scope: integration, system testing, security, defect fixing and deployment preparation.

- Complete meaningful unit, database integration, system and acceptance tests linked to CF IDs. Verify keyboard/mobile form behavior and map fallback.
- Replay migrations into a clean local database; test grants/RLS/Storage with real JWTs and inspect the production bundle for accidental secret exposure.
- Prepare Vercel build/deep-link configuration, Supabase Auth redirect allowlists, environment separation and deployed security headers. Verify hosted quotas and tile-provider policy before public use; do not assume free-tier guarantees.
- Present the exact hosted migration target, SQL changes, data impact and backup/recovery plan for approval. Only after approval apply migrations to that environment and perform a separate scoped deployment/smoke check.
- Record test evidence, defects and release/setup notes. Handle a lecturer-approved maintenance change request through impact analysis, changed artifacts, regression tests and updated release notes.

Exit: demonstrated release with known limitations, traceability and security evidence; no claim that unexecuted tests passed.

## Academic milestone mapping

| Approved milestone | Proposal content | Repository evidence |
| --- | --- | --- |
| Milestone 1 - Project Definition & Process Model | Background, problem, stakeholders, objectives, scope, assumptions/constraints, Agile/Scrum and plan | Original proposal; requirements scope/exclusions; this preserved sprint process |
| Milestone 2 - Agile Planning | Backlog, stories, priorities, acceptance criteria, sprint plan/development approach | Proposal pp. 8-10; requirements traceability; five-sprint roadmap and original allocation |
| Milestone 3 - Requirements Baseline | FRs/NFRs, actors, use cases, prioritization and traceability | Proposal pp. 11-16; `requirements.md` IDs and acceptance evidence |

Architecture/database/UI design, implementation, testing, deployment, maintenance and security follow the proposal's development phases (pp. 7-8, 17). Their deliverables do not rename or replace Milestones 1-3.

## Current progress and verification commands

CF-22, requested by the user on 2026-10-19, adds owner withdrawal with a required reason as a reviewable Citizen increment after complaint submission. It is implemented and enabled by hosted migrations 007-008, with retained records/history/evidence and version/ownership checks. It retains all original owners: 1731 Citizen UX, 1710 complaint integration, 1761 DB enforcement and 1776 verification. Original five-sprint order and Milestones 1-3 remain unchanged. Later Officer operations must reject both final states; full lifecycle/concurrency checks must include withdrawal racing with evidence, processing and resolution. See [citizen withdrawal](citizen-withdrawal.md).

Sprint 1 source is implemented. The initial three hosted migrations, including existing-account profile repair, were authorized and applied on 2026-10-19; deployed authenticated profile reads were verified. Sprint 2 adds citizen submission, map/coordinate input, private evidence, and list/detail/history source. Migrations 004-006 were subsequently authorized and applied on the same date; six active category routes and backend permissions were verified. The user selected proposal-based roads, waste, water, sanitation, public transport and other-service categories; these are prototype routing data. Other appears last in the selector. Admin category maintenance remains a Should Have backlog item for completion by Sprint 4. The specifically designated, verified first Administrator was activated with an audited operator statement on 2026-10-20. See [hosted setup record](hosted-setup-2026-10-19.md) and [Sprint 2 evidence](sprint-2.md).

Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, `npm.cmd run test:db`, `npm.cmd run build`, and `npm.cmd run test:e2e`. Embedded PGlite database tests apply the real migrations and exercise PostgreSQL grants/RLS/functions while using fixtures for Auth identity and Storage metadata. They do not replace integration with Supabase Auth, PostgREST, the Storage HTTP service, or multi-connection concurrency. Initial full-stack image downloads stalled. The Officer increment now includes dedicated local PostgreSQL/Auth/PostgREST tests with real user JWTs and concurrent sessions; Storage HTTP and a complete Edge runtime journey remain release checks. See the current verification record in docs/officer-portal.md. See [Sprint 1 implementation notes](sprint-1.md), [Sprint 2 evidence](sprint-2.md) and [database operations](database-operations.md).

Definition of done for each module: required acceptance behavior, server-enforced authorization, bounded validation, meaningful allow/deny tests, accessible loading/error/empty states, updated docs/types/migrations where applicable, and owner review.

## Sprint 4 completion — 2026-10-29

CF-19 feedback, CF-13 notification inbox/read state and CF-20 category maintenance are implemented in that roadmap order, each with its own migration (20261029000100/200/300), RLS/RPC database tests, unit tests and browser journeys; a read-only CF-21 monitoring overview reuses existing Administrator read access. Ownership is unchanged: 1731 Citizen UI, 1757 workflow data, 1761 database/admin, 1710 category UX, 1776 verification. Hosted rollout is pending explicit approval. Sprint 5 continues with deployment, the deployed smoke test and the lecturer's change request. See [Sprint 4](sprint-4.md) and the [SDLC evidence pack](sdlc/README.md).

## Officer increment — 2026-10-20

Sprint 3 Officer queue/assignment/priority/review/start/progress/transfer source is implemented, followed by the separately versioned CF-12 resolution operation from Sprint 4. The user refined CF-14 to require Administrator-created Officer invitations; the server-only invitation function and recipient password setup are implemented, and the designated verified first Administrator was activated with an audit event. The original ownership above is retained. Exact SQL and operational status are in [Officer portal notes](officer-portal.md). The user specifically approved hosted migrations 20261020000100/20261020000200/20261021000100 on 2026-10-21; all three are applied with unchanged existing data checksums, restricted routine grants and anonymous API denial verified. CF-19 feedback, a notification inbox/read state and CF-20 category maintenance remain explicit backlog; this does not mark Sprint 4 complete.

The 2026-10-21 Officer completion increment adds unassigned filtering, URL-preserved search/filter/page navigation, refresh controls, stage guidance and accurate no-op feedback. Explicitly missing workflow routines in a new/unconfigured environment leave authorized reports/evidence readable while disabling processing; denied roster access still fails closed. It adds no schema changes beyond the three reviewed and now-applied migrations. Verification and hosted activation status are tracked in [Officer portal notes](officer-portal.md).

The user's subsequent 2026-10-21 CF-04 refinement adds optional device-location selection and a closer Southern Province map default to the Citizen form. Ownership remains 1731 (Citizen/location) with 1710 integration and 1776 verification. It changes no database contract, role, original sprint allocation or academic milestone. See [location verification](sprint-2.md#citizen-location-refinement--2026-10-21).
