# Stage 7 – Test plan and test report

## 7.1 Test plan

**Objective:** show that every CivicFlow requirement (CF-01…CF-22, NFR-01…NFR-11) behaves as specified, that unauthorised users are refused by the backend (not just hidden in the UI), and that defects found are corrected and re-tested.

**Approach:** risk-based. The highest risks are privacy leakage between citizens and departments, workflow bypass, lost updates and invalid data. They are covered at the database level with real SQL as non-privileged roles, *and* at the browser level.

| Level (guidelines §9) | What is tested | Tool | Environment | Files |
| --- | --- | --- | --- | --- |
| **Unit** | Pure validation rules, error translation, session race handling, Edge Function handler | Vitest | Node / jsdom | `src/**/*.test.ts(x)`, `supabase/functions/**/*.test.ts` |
| **Integration (database)** | Real migrations, grants, RLS, RPCs, constraints, rollbacks, run as `anon`/`authenticated` with fixture identities | Vitest + PGlite (PostgreSQL 17 in-process) | Fresh disposable DB per file | `supabase/tests/*.test.ts` |
| **Integration (HTTP)** | Real Supabase Auth JWTs + PostgREST + PostgreSQL in containers; concurrency races | Node script + Docker | Disposable local containers | `scripts/test-postgres-http.mjs` |
| **System** | Complete user journeys through the real UI in a browser; Supabase responses are intercepted fixtures | Playwright (Edge / Chromium) | Local Vite dev server | `tests/e2e/*.spec.ts` |
| **Acceptance** | Acceptance criteria of the major stories (03 §3.3) checked by mapped system tests, plus a manual UAT run on the deployed system | Playwright + manual checklist | Local now; deployed URL later | This document §7.4, [08 §8.6](08-deployment.md#86-smoke-test-and-acceptance-checklist) |

**Entry criteria:** the code compiles and lint passes. **Exit criteria:** all automated suites pass; no open defect of high severity; every Must requirement traced to at least one passing positive and one negative test.

**Test data:** fictional only (for example "Alex Perera", "Sample Road", `@example.test` emails). Tests never use the hosted database or real accounts.

**Commands:**

```bash
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run test:integration
npm run build
npx playwright test
```

`npm run test:integration` needs Docker Desktop to be running.

## 7.2 Execution summary (2026-10-29)

Environment: Windows 11, Node.js 22.23.4, Microsoft Edge (Playwright channel `msedge`).

| Suite | Files | Tests | Passed | Failed | Notes |
| --- | --- | --- | --- | --- | --- |
| Lint (ESLint) | — | — | ✔ | — | 0 warnings |
| Typecheck (tsc strict) | — | — | ✔ | — | App and Edge Function configs |
| Unit (Vitest) | 10 | 69 | 69 | 0 | |
| Database integration (PGlite) | 7 | 119 | 119 | 0 | All 14 migrations applied to a fresh DB per file |
| Production build | — | — | ✔ | — | No bundler warnings |
| System (Playwright) | 4 | 54 | 54 | 0 | Full suite, 2 workers, ~2.3 min |
| HTTP integration (Docker) | 1 | 9 | — | — | **Not run on 2026-10-29**: Docker engine not running. Last recorded: 9/9 passed on 2026-10-21, before the Sprint 4 SQL existed. |
| **Total automated (executed today)** | **21** | **242** | **242** | **0** | |

CI on GitHub Actions has also passed for every commit on `main` (runs for `88f85f2`, `0c74184`, `a576dac`).

## 7.3 Test cases

Legend: **+** positive, **−** negative/abuse. Every "Actual" result below was observed in the 2026-10-29 run unless stated. Automated test names are quoted exactly so each case can be re-run. Expected results come from the requirement and acceptance criteria, not from the implementation.

### Authentication and access (CF-01…03, CF-15)

| ID | Req | ± | Preconditions / input | Expected result | Actual | Status | Automated test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-AUTH-01 | CF-03 | − | No session; open `/admin/users` | Redirected to sign-in; no admin navigation | As expected | Pass | e2e auth: "protected URLs redirect to sign-in without a session" |
| TC-AUTH-02 | CF-01 | +/− | Submit an empty form, then valid data | Field errors first; signup request carries only `display_name` (no role); "Check your email" shown | As expected | Pass | e2e auth: "registration validates input and shows email verification without accepting a role" |
| TC-AUTH-03 | CF-02, 03 | + | Sign in as Citizen, Officer, Administrator; sign out | Each lands in its own workspace; sign-out clears the workspace | As expected (3 cases) | Pass | e2e auth: "‹role› reaches the right workspace and logout clears it" |
| TC-AUTH-04 | CF-03 | − | Citizen types `/admin/users` | "Administrator access required"; no admin data requested | As expected | Pass | e2e auth: "Citizen cannot open Administrator UI through a manually entered route" |
| TC-AUTH-05 | CF-03 | − | Signed-in account with no profile row | Fails closed with retry/sign-out; no workspace | As expected | Pass | e2e auth: "a missing profile fails closed and offers retry and sign-out" |
| TC-AUTH-06 | CF-02 | + | Sign in, reload page | Must sign in again (session in memory only) | As expected | Pass | e2e auth: "session is not persisted across a full reload" |
| TC-AUTH-07 | CF-02 | − | Password recovery; expired reset link | Generic response (no account enumeration); expired link can't set a password | As expected | Pass | e2e auth: "password recovery has a generic response and expired reset links cannot set a password" |
| TC-AUTH-08 | CF-15 | + | Change display name | Name updates; role unchanged | As expected | Pass | e2e auth: "profile changes refresh the displayed account without changing its role" |
| TC-U-AUTH-01 | CF-01, 02 | − | Short passwords, blank names, bad email, secret key as public key, insecure URL | Rejected by client rules | As expected | Pass | unit: "authentication input boundaries > …" (4 tests) |
| TC-U-AUTH-02 | CF-02 | − | A profile response arrives after sign-out or account switch | Late data discarded; fails closed on error | As expected | Pass | unit: "session boundary race handling > …" (3 tests) |
| TC-DB-FND-01 | CF-01, 03 | − | Signup with metadata `role=administrator` | Profile created as active Citizen; metadata ignored | As expected | Pass | db: "ignores all privileged signup metadata" |
| TC-DB-FND-02 | CF-03, NFR-05 | + | Inspect catalog | RLS enabled on every application table | As expected | Pass | db: "enables RLS on all application tables" |
| TC-DB-FND-03 | NFR-04 | − | `anon` role reads tables / updates profiles | Permission denied | As expected | Pass | db: "denies anonymous table reads and profile mutations" |
| TC-DB-FND-04 | CF-03 | − | Citizen runs `UPDATE profiles SET role='administrator'`, deletes, reads audit | Permission denied | As expected | Pass | db: "denies direct privilege escalation, deletion and private audit reads" |
| TC-RBAC-01 | CF-03 | − | Citizen opens `/admin/categories` | "Administrator access required"; no nav link | As expected | Pass | e2e sprint4: "Citizen-only and Administrator-only pages refuse other roles in the UI" |

### Complaint submission and tracking (CF-04…07, 16…18)

| ID | Req | ± | Preconditions / input | Expected result | Actual | Status | Automated test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-SUB-01 | CF-04, 06, 16, 18 | + | Citizen submits a valid complaint; first upload fails, retry; download; open detail | Reference shown; request has no `citizen_id`/`status`; upload retry reuses the same key; private download; history shows "Supporting evidence added" | As expected | Pass | e2e complaints: "Citizen submits, retries optional evidence, downloads privately and revisits list/detail" |
| TC-SUB-02 | CF-04 | − | Blank coordinates; map tiles unavailable | Validation error; map click selects; numeric entry still works | As expected | Pass | e2e complaints: "blank coordinates fail validation, map click selects location, unavailable tiles allow numeric entry" |
| TC-SUB-03 | CF-06 | − | First submit response lost (503) | Form kept; retry sends the same request ID; one complaint | As expected | Pass | e2e complaints: "a lost submission response preserves details and retries the same idempotency key" |
| TC-SUB-04 | CF-05 | + | Open category dropdown | Six categories, *Other* last; real category UUID submitted | As expected | Pass | e2e complaints: "service dropdown contains all six choices with Other last and submits its real category ID" |
| TC-SUB-05 | CF-05 | − | No categories configured | Explained; submission blocked; no fabricated IDs | As expected | Pass | e2e complaints: "missing category setup is explained and cannot submit fabricated categories" |
| TC-LOC-01 | CF-04 | + | Open the form; click "Use my current location" | Map opens over Southern Province with no pin; opt-in fix sets an editable pin and zooms in | As expected | Pass | e2e complaints: "Southern Province opens without a pin and opt-in device location zooms to the service point" |
| TC-LOC-02 | CF-04 | − | Geolocation denied / unavailable / timeout / unsupported / cancelled / late | Chosen point preserved; submission allowed; late results ignored | As expected (6 cases) | Pass | e2e complaints: "device location failure 1–3 …", "a browser without geolocation …", "cancel prevents …", "manual selection prevents …" |
| TC-TRK-01 | CF-07, 17, NFR-03 | + | 11 complaints; paginate, search, filter; mobile width | Correct pages and filters; only own complaints; fits 375 px | As expected | Pass | e2e complaints: "list pagination/search/status preserve ownership and mobile content fits" |
| TC-TRK-02 | CF-07, 12 | + | Open own resolved complaint | Progress steps, resolution text and date, history | As expected | Pass | e2e sprint4: "CF-19 Citizen rates a resolved complaint once …" (detail part) |
| TC-TRK-03 | CF-07, NFR-11 | − | Open another citizen's reference; description containing HTML | "Complaint unavailable"; HTML shown as text | As expected | Pass | e2e complaints: "foreign complaint references show no details and descriptions render as plain text" |
| TC-U-CMP-01 | CF-04 | − | Invalid field values; zero coordinates | Invalid values rejected; 0,0 accepted as a value | As expected | Pass | unit: "complaint form validation and accessible coordinates > …" (3 tests) |
| TC-U-EV-01 | CF-16 | − | Spoofed MIME, unsupported, empty, oversized files | Rejected client-side (usability, not malware safety) | As expected | Pass | unit: "evidence client checks … > …" (2 tests) |
| TC-DB-SUB-01 | CF-04–06, 18 | + | Citizen calls `submit_complaint` | Trimmed values, routed department, status Submitted, version 1, event and notification created | As expected | Pass | db: "routes a trimmed Citizen report and atomically creates initial history and update" |
| TC-DB-SUB-02 | CF-06 | +/− | Same request ID twice; same ID with changed input | Same row returned; changed input → `request_reused` | As expected | Pass | db: "returns the same record on retry and rejects the same key with changed input" |
| TC-DB-SUB-03 | CF-04, NFR-07 | − | Description < 10 or > 5,000 characters; invalid/NaN/∞ coordinates | `invalid_input` | As expected | Pass | db: "enforces description bounds on the server", "rejects invalid/nonfinite coordinate pair …" |
| TC-DB-SUB-04 | CF-03, 04 | − | Officer, Administrator, inactive Citizen, anonymous | `not_authorized` / permission denied | As expected | Pass | db: "rejects submission by non-Citizen or inactive caller …", "denies anonymous execution …" |
| TC-DB-SUB-05 | NFR-06 | − | Notification insert forced to fail | Complaint and event rolled back | As expected | Pass | db: "rolls back complaint and event if the durable update fails" |
| TC-DB-SUB-06 | CF-07, 08 | − | Citizen B and a foreign-department Officer read Citizen A's complaint/history | 0 rows | As expected | Pass | db: "isolates Citizens and departments and applies parent permissions to history" |
| TC-DB-SUB-07 | CF-05 | − | Inactive category or department | `category_unavailable`; historic reference still readable | As expected | Pass | db: "rejects inactive categories/departments but retains referenced lookup visibility" |
| TC-DB-EV-01 | CF-16, NFR-11 | + | Inspect bucket; reserve | Private bucket, 5 MiB, JPEG/PNG/PDF; server path `citizen/complaint/evidence.ext` | As expected | Pass | db: "creates private bucket limits and server-generated owned paths" |
| TC-DB-EV-02 | CF-16 | − | Foreign Citizen, Officer, Administrator, inactive reserve | Denied | As expected | Pass | db: "denies foreign owner, Officer, Administrator and inactive reservations" |
| TC-DB-EV-03 | CF-16 | − | Declared size 0 / > 5 MiB; MIME `text/html` | Rejected | As expected | Pass | db: "enforces declared size … and MIME … on server" |
| TC-DB-EV-04 | CF-16 | − | Storage writes to foreign, unreserved or spoofed-owner paths | Denied by Storage policy | As expected | Pass | db: "denies Storage writes to foreign, unreserved and spoofed-owner paths" |
| TC-DB-EV-05 | CF-16 | − | Sixth file | `evidence_limit`; expired reservations free slots | As expected | Pass | db: "counts pending reservations toward the five-file limit …" |
| TC-DB-EV-06 | CF-16 | − | Upload after review began | Reserve, upload and finalize all refused | As expected | Pass | db: "stops reservations, uploads and finalization when review has begun" |

### Officer processing and resolution (CF-08…12)

| ID | Req | ± | Preconditions / input | Expected result | Actual | Status | Automated test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-OFF-01 | CF-09–12 | + | Officer reviews, assigns, prioritises, starts, adds progress, resolves with confirmation | Each step "Complaint updated"; expected versions 1→6 sent; complaint closed with resolution text | As expected | Pass | e2e officer: "Officer reviews, assigns, prioritizes, starts, updates and resolves a complaint" |
| TC-OFF-02 | CF-08, 17 | + | "Assigned to me" with a priority filter | Scoped to the department and the Officer; filter narrows the list | As expected | Pass | e2e officer: "assigned queue and filters use department and assignment scopes" |
| TC-OFF-03 | NFR-06 | − | Another user changed the complaint (409) | Remark kept; "Refresh and review"; retry after refresh uses the new version | As expected | Pass | e2e officer: "stale writes keep the remark and require a deliberate refresh" |
| TC-OFF-04 | CF-09 | + | Transfer to Water supply | Officer returned to queue; old department loses access | As expected | Pass | e2e officer: "transfer returns to the queue after old-department read access is lost" |
| TC-OFF-05 | CF-11 | − | Complaint assigned to another Officer | Start/progress/resolve not offered | As expected | Pass | e2e officer: "another assignee cannot start, progress or resolve through the Officer UI" |
| TC-OFF-06 | CF-22, NFR-03 | − | Withdrawn complaint, mobile | Readable; all processing disabled | As expected | Pass | e2e officer: "Withdrawn complaints remain readable with all processing disabled on mobile" |
| TC-OFF-07 | CF-08 | − | Workflow RPC missing vs. authorisation denied | Missing: read-only notice, activates after setup. Denied: fails closed. | As expected (2 cases) | Pass | e2e officer: "missing workflow setup …", "authorization denial is not treated as missing setup" |
| TC-OFF-08 | CF-10 | + | Set an unchanged priority | "No change was needed"; no new history claimed | As expected | Pass | e2e officer: "unchanged priority reports a no-op without promising a new history event" |
| TC-OFF-09 | CF-17 | + | Search and filter, open a detail, go back | Filters preserved; Clear resets all | As expected | Pass | e2e officer: "search and assignment filters survive a detail visit and clear together" |
| TC-U-OFF-01 | CF-09–12 | − | Missing reasons, short remarks, tampered URL filters | Rejected or bounded client-side | As expected | Pass | unit: "Officer intent validation > …" (8 tests) |
| TC-DB-OFF-01 | CF-11, 12, 18 | + | Full lifecycle via RPCs | Versions 1→7; 7 events; Citizen notifications; last is `resolution` | As expected | Pass | db: "records review, assignment, priority, start, progress and resolution atomically" |
| TC-DB-OFF-02 | CF-03, 08 | − | Citizen, other Citizen, foreign Officer, inactive Officer, Administrator call 7 RPCs | `not_authorized` for all | As expected (5×7) | Pass | db: "denies non-Officer, foreign-department or inactive workflow caller …" |
| TC-DB-OFF-03 | NFR-05 | − | Anonymous RPC; direct `UPDATE complaints`; call private helper | Permission denied | As expected | Pass | db: "denies anonymous execution and direct table mutation" |
| TC-DB-OFF-04 | CF-09 | − | Assign to Citizen/foreign/inactive/Admin/null; roster contents | `invalid_assignee`; roster shows only active same-department IDs and names | As expected | Pass | db: "rejects unassigned/foreign/inactive targets …", "exposes only the active same-department assignment roster …" |
| TC-DB-OFF-05 | CF-11, NFR-06 | − | Skip/repeat transitions; stale version; no-ops | `invalid_transition`; `PT409 stale_version`; no-op adds no event | As expected | Pass | db: "rejects skipped/repeated transitions, stale writes and duplicates without new history" |
| TC-DB-OFF-06 | CF-11, 12 | − | Empty/long progress; resolution < 10 or > 5,000 | `progress_required` / `resolution_required`; version unchanged | As expected | Pass | db: "enforces bounded remarks, required progress and resolution details" |
| TC-DB-OFF-07 | CF-12, 22 | − | Any workflow RPC on a Resolved or Withdrawn complaint | `complaint_closed` | As expected | Pass | db: "blocks every mutation after withdrawal or resolution" |
| TC-DB-OFF-08 | NFR-06 | − | Notification insert forced to fail during review | Status/version and history unchanged | As expected | Pass | db: "rolls back complaint changes and history if a notification write fails" |
| TC-DB-OFF-09 | CF-09 | +/− | Transfer with mismatched category, short reason, valid; after start | `category_unavailable` / `reason_required` / success with access moved / `invalid_transition` | As expected | Pass | db: "transfers with a matching active route, clears assignment and removes old-department access" |

### Withdrawal (CF-22)

| ID | Req | ± | Preconditions / input | Expected result | Actual | Status | Automated test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-WD-01 | CF-22 | + | Owner gives a reason and confirms | Status Withdrawn; reason in history; still searchable | As expected | Pass | e2e complaints: "Citizen confirms a reason to withdraw and can still find its history" |
| TC-WD-02 | CF-22 | − | Stale page | Reason kept; refresh required | As expected | Pass | e2e complaints: "stale withdrawal keeps the reason and requires reviewing a refreshed complaint" |
| TC-WD-03 | CF-22 | − | Response lost | Same intent retried safely | As expected | Pass | e2e complaints: "withdrawal retries the same intent after an uncertain response" |
| TC-WD-04 | CF-22 | − | Resolved / withdrawn complaint | Withdraw not offered | As expected | Pass | e2e complaints: "resolved and withdrawn complaints do not offer withdrawal" |
| TC-U-WD-01 | CF-22 | − | No reason / no confirmation / final states | Rejected | As expected | Pass | unit: "owner withdrawal intent validation > …" (2 tests) |
| TC-DB-WD-01 | CF-22 | + | Withdraw from each open state | Reason, actor and time recorded; assignment released; event and notification atomic | As expected (3 states) | Pass | db: "withdraws …, records reason/actor/time, releases assignment and notifies atomically" |
| TC-DB-WD-02 | CF-22 | − | Foreign / non-Citizen / inactive / anonymous | Denied without revealing whether the complaint exists | As expected | Pass | db: "denies withdrawal by foreign/non-Citizen/inactive caller …", "denies anonymous execution …" |
| TC-DB-WD-03 | CF-22 | − | Short reason; invalid/stale version; resolved | Rejected; records unchanged | As expected | Pass | db: "requires a bounded meaningful reason", "rejects invalid expected version …", "rejects stale writes and resolved complaints …" |
| TC-DB-WD-04 | CF-22 | + | Identical retry after a lost response | Returns the existing withdrawal; no duplicate history | As expected | Pass | db: "safely resumes a lost response and never duplicates history …" |
| TC-DB-WD-05 | NFR-06 | − | Notification failure | All withdrawal effects rolled back | As expected | Pass | db: "rolls back all withdrawal effects if the notification cannot be written" |

### Sprint 4: feedback, inbox, categories, monitoring (CF-13, 19, 20, 21)

| ID | Req | ± | Preconditions / input | Expected result | Actual | Status | Automated test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-FB-01 | CF-19 | +/− | Submit with no rating; then "Good" + padded comment | "Choose a rating" and no request; then one call `{rating 4, comment trimmed}`; panel becomes read-only | As expected | Pass | e2e sprint4: "CF-19 Citizen rates a resolved complaint once and then sees it read-only" |
| TC-FB-02 | CF-19 | − | Server answers `feedback_exists` | "Feedback was already submitted…"; form stays; no false success | As expected | Pass | e2e sprint4: "CF-19 a duplicate feedback refusal is explained without claiming success" |
| TC-U-FB-01 | CF-19 | − | Ratings 0, 6, 2.5, missing; comment 2,001 characters | Rejected; 1–5 and 2,000 accepted | As expected | Pass | unit: "CF-19 feedback input matches the submit_feedback contract > …" |
| TC-DB-FB-01 | CF-19 | +/− | Owner rates a resolved complaint; identical retry; different second attempt | Stored once (trimmed); retry returns it; second → `feedback_exists` | As expected | Pass | db: "stores one trimmed rating/comment for the owner of a resolved complaint" |
| TC-DB-FB-02 | CF-19, NFR-07 | − | Ratings 0, 6, null; comment 2,001 characters; whitespace comment | `invalid_feedback`; whitespace stored as null | As expected | Pass | db: "rejects out-of-range ratings and oversized comments", "stores an empty comment as null …" |
| TC-DB-FB-03 | CF-19 | − | Complaint not resolved; withdrawn | `feedback_closed` | As expected | Pass | db: "rejects feedback before resolution and after withdrawal" |
| TC-DB-FB-04 | CF-19, CF-03 | − | Other Citizen, Officer, Administrator, inactive owner | `not_authorized` | As expected (4) | Pass | db: "denies feedback by non-owner, staff or inactive caller …" |
| TC-DB-FB-05 | NFR-05 | − | Anonymous RPC; direct UPDATE/DELETE/INSERT; reads by each role | Denied; readable by owner, department Officer and Admin only | As expected | Pass | db: "denies anonymous execution and direct writes; reads follow complaint access" |
| TC-NTF-01 | CF-13 | + | Two unread, one read update; mark one; filter unread; mark all | Badge "2 unread" → "1 unread" → none; HTML remark shown as text; exact RPC payloads | As expected | Pass | e2e sprint4: "CF-13 inbox shows unread updates as plain text and records read state" |
| TC-U-NTF-01 | CF-13 | +/− | Event label and remark; missing event; unknown kind | Label used; fallback title; invalid kind rejected | As expected | Pass | unit: "CF-13 inbox items > …" |
| TC-DB-NTF-01 | CF-13, NFR-11 | +/− | Owner and others list notifications; mark one | Owner sees 5 kinds in order; others see 0; one marked; re-marking is a no-op | As expected | Pass | db: "shows recipients only their own notifications and marks selected ones read" |
| TC-DB-NTF-02 | CF-13 | − | Mark another user's notification (by ID and "all") | 0 rows changed; target stays unread | As expected | Pass | db: "cannot mark another user’s notification read" |
| TC-DB-NTF-03 | CF-13 | + | Mark all | All of the caller's unread rows set read | As expected | Pass | db: "marks all of the caller’s unread notifications read at once" |
| TC-DB-NTF-04 | CF-13 | − | Null/empty/101 IDs; null flag; inactive; anonymous; direct UPDATE/DELETE | `invalid_input` / `not_authorized` / permission denied | As expected | Pass | db: "validates bounds and denies anonymous, inactive callers and direct updates" |
| TC-DB-NTF-05 | CF-13 | − | Inactive recipient reads | 0 rows | As expected | Pass | db: "hides an inactive recipient’s notifications" |
| TC-CAT-01 | CF-20 | +/− | Admin opens categories; creates with no name, then valid; edits an inactive one | Validation error; created and listed; inactive departments offered only for the existing route; exact RPC payloads | As expected | Pass | e2e sprint4: "CF-20 Administrator creates and edits categories; backend refusals are explained" |
| TC-CAT-02 | CF-20 | − | Server answers `category_in_use` | Explanation shown; input kept | As expected | Pass | e2e sprint4: "CF-20 a referenced category cannot move department and the form keeps the input" |
| TC-U-CAT-01 | CF-20 | − | Empty/long name, long description, missing department | Rejected | As expected | Pass | unit: "CF-20 category input matches admin_upsert_category bounds > …" |
| TC-DB-CAT-01 | CF-20 | + | Create, no-op, update | Two audit events (created, updated) with before/after; no-op not audited | As expected | Pass | db: "creates, renames, deactivates and audits a category; no-ops write no audit" |
| TC-DB-CAT-02 | CF-20, NFR-10 | − | Inactive category | Hidden from Citizens; submission → `category_unavailable` | As expected | Pass | db: "hides inactive categories from Citizens and blocks new submissions to them" |
| TC-DB-CAT-03 | CF-20 | − | Duplicate name (different case); bounds; unknown/inactive department | `category_name_taken`, `invalid_input`, `department_unavailable` | As expected | Pass | db: "rejects duplicate names (case-insensitive), invalid bounds and unavailable departments" |
| TC-DB-CAT-04 | CF-20 | − | Change department of a referenced category | `category_in_use`; rename still allowed | As expected | Pass | db: "keeps a referenced category’s routing department immutable" |
| TC-DB-CAT-05 | CF-03 | − | Citizen, Officer, inactive Admin, anonymous | `not_authorized` / permission denied | As expected (4) | Pass | db: "denies non-Administrator or anonymous caller …" |
| TC-DB-CAT-06 | NFR-05 | − | Direct UPDATE categories; read audit table | Permission denied | As expected | Pass | db: "denies direct category writes and audit-table reads by every browser role" |
| TC-MON-01 | CF-21 | + | Admin overview with 1 resolved complaint, ratings 5 and 4 | All 1, Open 0, Average 4.5; no processing buttons | As expected | Pass | e2e sprint4: "CF-21 Administrator overview shows monitoring counts without processing controls" |
| TC-U-MON-01 | CF-21 | + | Counts and ratings | Open excludes final states; average to 1 decimal; none when no feedback | As expected | Pass | unit: "CF-21 basic monitoring summary > …" |
| TC-UX-01 | NFR-03 | + | 375×812 viewport; detail and inbox | No horizontal overflow | As expected | Pass | e2e sprint4: "feedback and inbox fit a mobile viewport without horizontal overflow" |

### Administration (CF-14)

| ID | Req | ± | Preconditions / input | Expected result | Actual | Status | Automated test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-ADM-01 | CF-14 | − | Citizen opens Officer / Officer-provisioning routes | Refused | As expected | Pass | e2e auth: "Citizen cannot enter Officer or Officer-provisioning routes" |
| TC-ADM-02 | CF-14 | − | Demote the last admin | Backend refusal shown | As expected | Pass | e2e auth: "Administrator sees backend refusal when attempting to remove the last admin" |
| TC-ADM-03 | CF-14 | +/− | Invite an Officer; email delivery refused | Department required; no password/role fields; refusal shown without false success or retry | As expected (2) | Pass | e2e auth: "Administrator creates an Officer invitation …", "… email-delivery refusal …" |
| TC-U-INV-01 | CF-14 | − | Edge Function: no session, non-admin, foreign origin, bad input, inactive department, provider failures | Refused before any invitation; no promotion on partial failure | As expected (9) | Pass | unit: "Administrator-only Officer invitations > …" |
| TC-DB-ADM-01 | CF-14 | − | Non-admin calls `admin_update_user` | `not_authorized` | As expected | Pass | db: "rejects non-admin RPC calls even when crafted outside the UI" |
| TC-DB-ADM-02 | CF-14 | + | Promote to Officer without and with a department | Requires an active department; audit row written | As expected | Pass | db: "requires an active department when promoting an Officer and records an audit event" |
| TC-DB-ADM-03 | CF-14 | − | Demote the last admin | `last_administrator`; change rolled back | As expected | Pass | db: "preserves the last active administrator and rolls back failed admin changes" |
| TC-DB-ADM-04 | NFR-04 | − | Deactivate a user who has a valid claim | Reads and writes refused immediately | As expected | Pass | db: "deactivation immediately revokes reads and writes for the old claim" |

### HTTP integration with real JWTs (last executed 2026-10-21)

| ID | Scenario (from the [Officer verification record](../officer-portal.md#verification-record)) | Result 2026-10-21 |
| --- | --- | --- |
| TC-INT-01 | Owner / department / inactive / role denial through PostgREST with real user JWTs | Pass |
| TC-INT-02 | Signup metadata privilege escalation through Auth | Pass |
| TC-INT-03 | Stale withdrawal returns HTTP 409 immediately (no retry loop) | Pass |
| TC-INT-04 | Concurrent review by two Officers: one succeeds, one gets 409 | Pass |
| TC-INT-05 | Resolution racing withdrawal: exactly one final state | Pass |
| TC-INT-06 | Transaction rollback through HTTP | Pass |
| TC-INT-07 | Transfer removes old-department access | Pass |
| TC-INT-08 | Two Administrators demote each other concurrently: at least one remains | Pass |
| TC-INT-09 | Only the assignee can start (403 for teammate); short resolution rejected (400); submission and owner reads work over HTTP | Pass |

## 7.4 Acceptance test summary

| Story | Acceptance criteria | Result |
| --- | --- | --- |
| US-04/05/06 Submit complaint | AC1–AC4 | Pass (TC-SUB-01…03, TC-DB-SUB-01…04) |
| US-07 Track complaint | AC1–AC3 | Pass |
| US-11 Update status | AC1–AC4 | Pass |
| US-12 Resolve | AC1–AC4 | Pass |
| US-13 Updates inbox | AC1–AC3 | Pass |
| US-14 Manage users | AC1–AC4 | Pass |
| US-18 Feedback | AC1–AC3 | Pass |
| US-19 Categories | AC1–AC4 | Pass |
| US-20 Withdrawal | AC1–AC2 | Pass |
| **Manual UAT on the deployed system** | Checklist in [08 §8.6](08-deployment.md#86-smoke-test-and-acceptance-checklist) | **Not yet executed** (not deployed) |

## 7.5 Defect log

| ID | Found | How found | Severity | Description | Root cause | Correction | Re-test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-01 | Sprint 3 (2026-10-21) | HTTP integration test (concurrent review) | **High** | A stale-version conflict kept the request in an endless retry loop | PostgREST 14 automatically retries SQLSTATE `40001` | Raise `PT409` (HTTP 409). A new corrective migration `20261021000100` replaced the withdrawal function; Officer helpers use PT409 | TC-INT-03/04, TC-DB-OFF-05 pass |
| DEF-02 | Sprint 2 (2026-10-19) | Hosted preflight / manual demo | High | Citizen category dropdown was empty | Category migration 006 not yet applied to the hosted DB | Applied the reviewed migration; added an explicit "missing setup" state instead of a silent empty list | TC-SUB-05 pass |
| DEF-03 | Sprint 2 | Playwright | Medium | Duplicate React sibling key warning in the history list | Two events rendered with the same key | Keys use stable event IDs | Browser suite pass |
| DEF-04 | Sprint 2 | Playwright | Medium | Race between refreshing a complaint and submitting a withdrawal could use an old version | Refresh and submit not serialised | Controls disabled while refreshing; in-flight guard | TC-WD-02 pass |
| DEF-05 | Sprint 1/3 | Operator review | Medium | `supabase config push` reset hosted Auth settings (TOTP, OTP length, email frequency) to defaults | CLI pushes the whole local config | Values restored immediately; local `config.toml` now records them | Verified by later push (no drift) |
| DEF-06 | Sprint 3 | Playwright | Low (test) | Officer return-navigation test clicked before the detail page loaded | Test timing | Test waits for the detail return link | TC-OFF-09 pass |
| DEF-07 | Sprint 3 | Playwright (cold start) | Low (test) | First redirect assertion exceeded 5 s on a cold Vite start | Test timeout too short for first compile | Wait for login readiness (15 s bound) | TC-AUTH-01 pass |
| DEF-08 | Sprint 3 | Unit run on Windows | Low (tooling) | Unit worker start-up timeouts | Too many jsdom workers | Pure tests run in Node; worker count bounded | Unit suite pass |
| DEF-09 | Sprint 4 (2026-10-29) | Production build warning | Medium | The app shell imported the notifications module both statically and lazily, pulling complaint pages into the first download | The unread-badge hook was in the same module as the inbox page | Separate lightweight `notifications/badge` entry and zod-free unread API | Build with no warnings; TC-NTF-01 pass |
| DEF-10 | Sprint 4 | Database regression suite | n/a (expected) | `foundation.test.ts` failed: feedback and notifications became readable | The guard intentionally asserted "closed until policies ship" | Guard updated to check authorised reads with writes still denied | 119/119 pass |
| DEF-11 | Sprint 4 | Local set-up | Low (environment) | `vitest` could not start: missing Rolldown native binding | Dependencies installed with Node 20 (project requires ≥ 22.18) | Reinstalled with Node 22; requirement documented | All suites pass |
| DEF-12 | Sprint 4 | Screenshot review | Low (test) | Inbox fixture showed "Date unavailable" | Malformed fixture timestamp `T010:00` | Fixture fixed. The app's graceful fallback for bad dates is correct behaviour. | TC-NTF-01 pass |

There are no open defects of High or Medium severity.

## 7.6 Limitations of the test evidence

- **Browser tests mock Supabase.** They prove UI behaviour and the exact requests sent, not hosted RLS. Authorisation is proven by the database suite (real SQL as `anon`/`authenticated`) and, before Sprint 4, by the real-JWT HTTP suite.
- **PGlite uses fixture Auth and Storage schemas.** The Supabase Storage HTTP service (actual file bytes, MIME sniffing) and a full Edge Function runtime journey were **not** integration-tested.
- **The HTTP/concurrency suite was not re-run after the Sprint 4 SQL** because Docker was not running. Feedback and inbox concurrency rely on the same lock pattern, tested in PGlite only.
- **Not yet tested on the deployed environment:** performance (NFR-02), availability (NFR-08), deployed security headers and real email delivery.
- **No testing with real users.** Usability was assessed by the team only.
