# Sprint 2 citizen complaint increment

## Behavior and traceability

The earlier Citizen workspace was the Sprint 1 authentication/profile increment. This change implements the next citizen journey rather than leaving a profile-only workspace.

| CF IDs | Source behavior |
| --- | --- |
| CF-04/05/06 | Description, active service category, location text and bounded coordinates; map click/drag or accessible numeric input; committed UUID and Submitted confirmation |
| CF-07/17 | Real own-complaint counts, recent complaints, paginated/searchable/status-filtered My Complaints and a private detail page |
| CF-16 | Optional private JPEG/PNG/PDF evidence after submission; maximum five files, 5 MiB each; reserve/upload/finalize, retry and authenticated download |
| CF-18 | Initial submission and finalized-evidence events displayed in the complaint history; progress/resolution rendering is ready for later Officer operations |
| CF-03 | Live active-profile/role/ownership/department authorization in PostgreSQL and Storage policies; direct browser table mutations denied |
| CF-13 foundation | Submission/evidence events create durable citizen notifications atomically; separate notification inbox/read-state arrives in Sprint 4 |

The user explicitly selected proposal-based roads, waste, water, sanitation, public transport and other services. Display/routing names are Road maintenance, Waste management, Water supply, Sanitation, Public transport and Other public services. Each maps to an identically named prototype department. These are demonstration routing labels, not real government organizational claims. No officer/admin accounts are promoted or created.

CF-05 follow-up: the service selector presents Road maintenance, Waste management, Water supply, Sanitation, Public transport, then **Other**. The stored `Other public services` category is labelled Other in the selector, cards and details; its real category UUID and department routing are preserved. Additional configured categories appear before Other. Only active categories with active routing departments are selectable. Preflight found zero categories/departments and only migrations 001-003, explaining the empty dropdown. The reviewed setup below has now been authorized and applied: six active routes are available to the Citizen database role. No fake frontend category IDs or successful-submission fallback is used. The empty state now explains the missing setup and prevents submission.

Officer assignment/priority/status mutations remain Sprint 3. Resolution, feedback and notification inbox remain Sprint 4. Admin category maintenance is a visible Should Have backlog item for completion by Sprint 4. The original owners, five sprints and Milestones 1-3 remain unchanged.

## Module contracts and decisions

- `features/complaints`: UI pages -> application hooks -> explicit data adapter; pure Zod/domain models. Public page exports compose the router. No UI Supabase calls.
- `features/evidence`: its own model/application/data/UI and public EvidencePanel; no dependency on complaint internals. Error translation shared in `shared/errors`.
- `shared/location`: lazy React Leaflet/CSS, local marker assets, OSM attribution, map failure notice, no compulsory geolocation. Numeric coordinates work without tiles. Tile URLs contain no citizen/complaint text or identifiers.
- One existing typed Supabase client, memory-only auth, narrowly scoped RPCs and RLS. No custom API, ORM, state framework or secrets added.
- A stable complaint request key prevents double submission and resumes an uncertain response. Reusing that key with changed data is rejected. Each file has its own stable reservation key. Finalization may succeed after a failed/lost upload response; it checks actual Storage metadata before accepting the object.
- Submission saves before evidence, so partial upload failure is accurately shown without losing the complaint. Files are downloaded as attachments, without embedding PDFs or untrusted HTML. Client header checks improve feedback but do not promise malware safety.
- Evidence is accepted only while Submitted. Failed/abandoned reservations expire after 24 hours; they count toward quota while live. Browser queue removal does not delete records/files. There is no automatic destructive cleanup.
- Parent/profile locks serialize quotas and mutations. History and notification writes share the transaction; rollback tests exercise failure. Multi-session concurrency still needs the full local integration suite.

## Exact hosted change review — applied on 2026-10-19

Target: Supabase project `xapqfnumcpjckhpdyuxz` (`https://xapqfnumcpjckhpdyuxz.supabase.co`). This is the configured project where the user verified their Citizen account. After reviewing this target, SQL and recovery plan, the user stated: "have complete freedom while doing this, do changes on supabase if it is needed to make the project success". This authorized the prepared 004-006 rollout and necessary non-destructive Supabase work for CivicFlow; the authorization is recorded in AGENTS.md.

Review the exact version-controlled SQL:

1. [20261019000400_citizen_complaints.sql](../supabase/migrations/20261019000400_citizen_complaints.sql): adds nullable submission fingerprint; scoped complaint/history/evidence reads; referenced inactive-lookup visibility; Citizen-only submit RPC; atomic event/notification writes. No direct browser DML grants.
2. [20261019000500_private_complaint_evidence.sql](../supabase/migrations/20261019000500_private_complaint_evidence.sql): adds unique upload request keys; creates private `complaint-evidence` bucket with MIME/size limits; reservation/read policies; reserve/finalize RPCs. No client overwrite/delete policies.
3. [20261019000600_prototype_service_categories.sql](../supabase/migrations/20261019000600_prototype_service_categories.sql): inserts the six named prototype routing departments/categories, retaining matching existing names if present. It does not alter existing accounts/roles.

Reviewed file SHA-256 digests (recheck before executing):

| Version | SHA-256 |
| --- | --- |
| 004 | `860403540624ecb6b9ea84ddffbccad8ba29fa205d03e6c48ce3243e83d8ca09` |
| 005 | `26c66668e5d1b6aef0f119eca9f374052bbe21c8768ab05fce7eb7d593ffe3b4` |
| 006 | `1dffa1729f58dfad0126e1127a246f75e283296ea1c67da8c4d4581cfacd3ff8` |

Read-only hosted preflight on 2026-10-19 confirmed migrations 001-003, zero complaints/evidence/categories/departments, no evidence bucket, no Storage object policies and no fingerprint column. The CLI dry run listed exactly these three new migrations, no seeds/custom roles/Vault changes. Preflight queries are in [inspect-citizen-rollout.sql](../supabase/operations/inspect-citizen-rollout.sql).

Expected data effects: six prototype departments and six categories, new functions/policies/columns/bucket; no deletion, account changes or existing complaint content changes. Creating actual complaints/files happens only through subsequent authenticated citizen actions. New history/notification writes are enabled but no artificial complaint records are seeded remotely.

Recovery preparation: [snapshot-citizen-baseline.sql](../supabase/operations/snapshot-citizen-baseline.sql) asserts affected tables are empty and captures affected columns, grants, policies, migration history and bucket configuration. The ignored local metadata snapshot is `tmp/citizen-rollout/schema-baseline.json`, SHA-256 `b2bbe47b1e7334fc2bd7532cccd1323706aec0f649a55c51b5fcc473c570a760`. This is scoped schema recovery evidence, not an Auth/full database backup. Existing profiles/Auth records are outside these migrations. Standard Docker dump remains unavailable due stalled image downloads. If affected tables cease to be empty, stop and obtain an appropriate data backup before migration.

Each SQL file is transactional. If rollout fails, stop and inspect migration history; keep the app out of new complaint operations until corrected. Preserve committed records/files and prefer a reviewed corrective migration. No reset/drop/delete rollback is authorized. Restoring backups, reverting data or destructive cleanup requires separate approval.

The authorized rollout rechecked preflight and file hashes, then applied only the three reviewed migrations with `supabase.cmd db push --linked --project-ref xapqfnumcpjckhpdyuxz --skip-vault`. History, bucket privacy/limits, grants/policies/function privileges and six category routes were verified. No hosted test identities/complaints or real users' passwords were used for automated tests. The user can now sign in normally and validate their own complaint journey. No Git push/Vercel publication was performed.

## Verification and limits

Executed successfully: lint, TypeScript, 22 Vitest unit tests, 54 embedded PostgreSQL tests, production build and the final integrated 18-test Playwright run (13 auth/access journeys plus five new complaint journeys). A test fixture's exposed count header was corrected before the final passing run. Desktop form/detail and mobile list screenshots were visually inspected. Map tiles are stubbed in browser tests; tile failure, map click selection and numeric fallback are exercised. Generated types were checked against the migration-derived output.

The embedded suite replays all six real migrations in a fresh disposable PGlite database. It checks Citizen-only creation, owner/routing derivation, trim/bounds/nonfinite coordinates, same-key retry/changed payload, parent/department/inactive/anonymous denial, direct DML denial, Storage path ownership/expiry/quota, stored size/MIME verification, immutable attachments, idempotent finalization and transaction rollback. Test calls run as non-privileged `authenticated`/`anon` roles with fixture `auth.uid()` claims. Storage catalog tables are fixtures; the actual Supabase HTTP upload service and JWT verification are not simulated by those SQL checks.

Browser tests intercept every Supabase request and use fictional identities/files. They exercise new navigation, submission and lost-response retry, failed upload retry, private download, list/detail/history, pagination/search/status, foreign-record unavailability, plain-text rendering, map failure/selection and mobile width. They do not prove hosted RLS or actual Storage behavior; database tests supply the SQL evidence. Full local Supabase Auth/PostgREST/Storage tests with actual non-privileged user JWTs and concurrent sessions remain pending because Docker image downloads stalled. No hosted test data, deployment, commit or push was performed.


## Hosted rollout verification

The CLI dry run listed exactly 004-006; actual execution then successfully applied all three with the reviewed hashes and `--skip-vault`. Read-only verification in `supabase/operations/verify-citizen-rollout.sql` confirmed:

- Migration history contains all six versions.
- The existing active Citizen subject, under the deployed non-privileged `authenticated` database role, reads all six active categories and matching departments; only its own profile is visible. This is a database-role/claim check, not an actual user-JWT HTTP journey.
- Nine application tables retain RLS; direct browser complaint/evidence writes are denied.
- Three new RPCs have empty fixed search paths, SECURITY DEFINER, authenticated execution and no anonymous execution.
- Evidence bucket is private, restricted to JPEG/PNG/PDF and 5 MiB; Storage has only the intended INSERT/SELECT policies, no client overwrite/delete policy.
- Anonymous PostgREST category retrieval returns HTTP 401 / PostgreSQL 42501, confirming the endpoint exists and denies unauthenticated reads.
- Zero complaint/evidence records were created by rollout checks. No account, role or password changes were made.

Category follow-up checks: lint, typecheck and production build passed; all seven complaint Playwright journeys passed on the final focused run, including exact six-choice ordering/Other submission with its real UUID and an honest missing-setup state. An earlier run returned to login after a download; the final rerun passed. Full local Auth/Storage HTTP/JWT and concurrency checks remain pending as described above. Refresh the app and sign in normally to load the live categories.

## Citizen location refinement — 2026-10-21

The user explicitly requested a current-location shortcut and a closer Southern Province map default (CF-04). The initial unselected map now uses approximate center `[6.15, 80.7]` at zoom 9. It still has no pin or submitted coordinates until the Citizen chooses a location; the default is a viewing preference, not a service-area boundary. Existing complaint details continue to open at their saved location.

Use my current location requests one browser position only after the button is activated. A successful fix fills the existing latitude/longitude fields, sets an editable pin and centers the map at zoom 16. Estimated device accuracy is displayed to help the Citizen check the pin. The location description remains a required user-entered field. No reverse geocoder, continuous tracking, new dependency or additional stored personal data is introduced.

`shared/location/geolocation.ts` adapts the browser API with high accuracy requested, no cached position and a 10-second acquisition timeout. Browser permission/availability still determine whether a fix is possible. `useLocationSelection` coordinates coordinates, loading/errors and cancellation; manual map/coordinate edits, explicit cancellation and unmount invalidate late callbacks. While a lookup is pending the form prevents submission against an uncertain location, but manual selection/cancellation immediately restores submission. Denied access, unavailable positioning and timeout preserve any previously chosen point and allow ordinary submission. `LocationMap` uses the Leaflet map instance to focus a device fix, since initial React Leaflet center/zoom props do not update the existing map. References: [browser geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [React Leaflet map updates](https://react-leaflet.js.org/docs/api-map/).

The implementation preserves existing backend validation and the complaint payload/database schema. No Supabase migration, hosted configuration/data change, deployment, Git commit or push is required or performed for this refinement. Location/complaint ownership remains with 1731/1710 and verification with 1776.

Verification results will be recorded after the final checks. New browser coverage uses fictional device coordinates and intercepted Supabase/tile requests: default Southern Province selection, explicit opt-in success/focus/submission, denied/unavailable/timed-out positioning, unsupported browsers, cancellation and ignoring a late callback after manual selection. It also checks the new controls fit on mobile.
