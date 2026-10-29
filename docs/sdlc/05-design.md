# Stage 5 – System design

Detailed design records: [architecture.md](../architecture.md) (layers, flows, deployment, threat controls) and [database-design.md](../database-design.md) (tables, access matrix, function contracts, evidence storage). This document collects the design views the guidelines require (§7) and explains the main decisions.

## 5.1 High-level architecture

CivicFlow is a **single-page web application with a managed backend** (a three-tier, client–server architecture):

```mermaid
flowchart LR
  subgraph Client["Browser (any device)"]
    SPA["React + TypeScript SPA<br/>feature modules: auth, complaints, evidence,<br/>officer, feedback, notifications, categories, admin"]
  end
  subgraph Vercel["Vercel (static hosting + security headers)"]
    STATIC["index.html + JS/CSS bundles<br/>SPA deep-link rewrite, CSP"]
  end
  subgraph Supabase["Supabase (managed backend)"]
    AUTH["Auth<br/>email/password, verification,<br/>invitations, recovery"]
    REST["PostgREST Data API<br/>reads filtered by RLS"]
    RPC["Workflow RPC functions<br/>validation + authorisation + transaction"]
    DB[("PostgreSQL 17<br/>9 tables, RLS, constraints,<br/>append-only history, audit")]
    ST["Storage<br/>private bucket complaint-evidence"]
    EDGE["Edge Function<br/>provision-officer"]
  end
  OSM["OpenStreetMap tiles"]
  SPA -->|load app| STATIC
  SPA -->|sign in / session| AUTH
  SPA -->|SELECT with user JWT| REST --> DB
  SPA -->|rpc with user JWT| RPC --> DB
  SPA -->|upload/download with JWT| ST
  SPA -->|admin invite| EDGE --> AUTH
  EDGE -->|audited RPC with caller JWT| RPC
  SPA -->|map images| OSM
```

**Trust boundary:** the browser is untrusted. Every authorisation decision is made in PostgreSQL (grants, Row Level Security and checks inside `SECURITY DEFINER` functions) or in Storage policies. Route guards and hidden buttons are only for usability.

**Frontend layering (per feature):** `ui/` (React pages) → `application/` (hooks and use cases) → `model/` (pure types, Zod validation, rules) and `data/` (the only place that calls Supabase). Features import each other only through `index.ts`.

## 5.2 Class / domain model

Domain entities (database tables) with their key attributes and the operations that may change them. Operations are the only write paths; browsers have no direct INSERT/UPDATE/DELETE.

```mermaid
classDiagram
  direction LR
  class Profile {
    +uuid id
    +string displayName
    +AppRole role
    +bool isActive
    +uuid departmentId
    +updateMyProfile(name)
    +adminUpdateUser(role, dept, active, name)
  }
  class Department {
    +uuid id
    +string name
    +bool isActive
  }
  class Category {
    +uuid id
    +string name
    +string description
    +bool isActive
    +adminUpsertCategory(...)
  }
  class Complaint {
    +uuid id
    +string description
    +string locationText
    +float latitude
    +float longitude
    +ComplaintStatus status
    +Priority priority
    +string resolutionText
    +datetime resolvedAt
    +string withdrawalReason
    +int version
    +submit(...)
    +review()
    +assign(officer)
    +setPriority(priority)
    +transfer(category)
    +start()
    +addProgress(remark)
    +resolve(text)
    +withdraw(reason)
  }
  class ComplaintEvent {
    +uuid id
    +int complaintVersion
    +string eventType
    +string remark
    +json changes
  }
  class Evidence {
    +uuid id
    +string objectPath
    +string originalFilename
    +string state
    +reserve()
    +finalize()
  }
  class Feedback {
    +int rating
    +string comment
    +submitFeedback()
  }
  class Notification {
    +string kind
    +datetime readAt
    +markRead()
  }
  class AdminAuditEvent {
    +string action
    +json changes
  }
  class AppRole {
    <<enumeration>>
    citizen
    officer
    administrator
  }
  class ComplaintStatus {
    <<enumeration>>
    submitted
    under_review
    in_progress
    resolved
    withdrawn
  }
  Department "1" <-- "0..*" Profile : officer belongs to
  Department "1" <-- "0..*" Category : routes to
  Profile "1" <-- "0..*" Complaint : citizen owns
  Profile "0..1" <-- "0..*" Complaint : assigned officer
  Category "1" <-- "0..*" Complaint : classifies
  Department "1" <-- "0..*" Complaint : queue
  Complaint "1" *-- "1..*" ComplaintEvent : history
  Complaint "1" *-- "0..5" Evidence : supports
  Complaint "1" *-- "0..1" Feedback : rated by owner
  ComplaintEvent "1" <-- "0..*" Notification : announces
  Profile "1" <-- "0..*" Notification : recipient
  Profile "1" <-- "0..*" AdminAuditEvent : actor
```

## 5.3 Sequence diagrams

### SD-1 Submit complaint (UC-03)

```mermaid
sequenceDiagram
  actor C as Citizen
  participant UI as NewComplaintPage (ui)
  participant H as useSubmission (application)
  participant M as submissionSchema (model)
  participant D as complaints-api (data)
  participant R as submit_complaint RPC
  participant DB as PostgreSQL
  C->>UI: fill category, description, location, coordinates
  C->>UI: Submit
  UI->>H: submit(form)
  H->>M: safeParse(form)
  alt invalid
    M-->>UI: field errors (nothing sent)
  else valid
    H->>D: submitComplaint(input, requestId)
    D->>R: POST /rpc/submit_complaint (user JWT)
    R->>DB: lock caller profile (active Citizen?)
    R->>DB: validate bounds, active category → department
    alt same requestId already saved
      R-->>D: existing complaint (idempotent retry)
    else new
      R->>DB: INSERT complaint (status=submitted, version=1)
      R->>DB: INSERT event #1 + notification (same transaction)
      R-->>D: complaint row
    end
    D-->>H: Complaint
    H-->>UI: show reference CF-XXXXXXXX
  end
```

### SD-2 Officer resolves a complaint (UC-07)

```mermaid
sequenceDiagram
  actor O as Assigned Officer
  participant UI as OfficerActions
  participant D as officer-api
  participant R as resolve_complaint RPC
  participant L as private.lock_officer_complaint
  participant DB as PostgreSQL
  O->>UI: choose Resolve, enter details, confirm
  UI->>D: resolve(id, text, expectedVersion)
  D->>R: POST /rpc/resolve_complaint
  R->>L: lock(id, expectedVersion)
  L->>DB: advisory lock, then lock Officer and active department
  L->>DB: lock Citizen (key share) then complaint FOR UPDATE
  L-->>R: complaint (or not_authorized / complaint_closed / stale_version PT409)
  R->>R: caller is assignee? status in_progress? text 10–5000?
  R->>DB: UPDATE status=resolved, resolved_at, resolved_by, version+1
  R->>DB: INSERT event 'resolved' + Citizen notification 'resolution'
  R-->>D: updated complaint
  D-->>UI: refresh detail and history
  Note over DB: any failure rolls back the update, event and notification together
```

### SD-3 Citizen gives feedback (UC-08)

```mermaid
sequenceDiagram
  actor C as Citizen (owner)
  participant P as FeedbackPanel
  participant H as useFeedback
  participant D as feedback-api
  participant R as submit_feedback RPC
  participant DB as PostgreSQL
  P->>D: getFeedback(complaintId) via RLS
  D-->>P: null → show rating form
  C->>P: choose rating 4, comment, Submit
  P->>H: submit(4, comment)
  H->>H: feedbackInputSchema (1–5, ≤2000)
  H->>D: submitFeedback()
  D->>R: POST /rpc/submit_feedback
  R->>DB: lock active Citizen, lock owned complaint
  R->>R: status = resolved? existing feedback?
  alt identical retry
    R-->>D: stored feedback
  else different second attempt
    R-->>D: error feedback_exists (23505)
  else first submission
    R->>DB: INSERT complaint_feedback
    R-->>D: feedback row
  end
  H->>D: reload → panel becomes read-only
```

## 5.4 Activity diagram – complaint processing workflow

```mermaid
flowchart TD
  S([Citizen submits complaint]) --> V{Valid input &<br/>active category?}
  V -- no --> E1[Show errors; nothing saved] --> S
  V -- yes --> SUB[Status: Submitted<br/>routed to department queue]
  SUB --> EV{Add evidence?}
  EV -- yes --> UP[Reserve → upload → finalize<br/>while still Submitted] --> Q
  EV -- no --> Q[Officer opens department queue]
  Q --> WRONG{Wrong department?}
  WRONG -- yes --> TR[Transfer with reason<br/>assignee cleared] --> Q
  WRONG -- no --> REV[Begin review<br/>Status: Under review]
  REV --> ASG[Assign Officer & set priority]
  ASG --> ST[Assigned Officer starts work<br/>Status: In progress]
  ST --> PR[Add progress remarks]
  PR --> DONE{Work complete?}
  DONE -- no --> PR
  DONE -- yes --> RES[Resolve with details<br/>Status: Resolved]
  RES --> FB[Citizen gives feedback once]
  FB --> X([End])
  SUB -. owner withdraws with reason .-> WD[Status: Withdrawn - final]
  REV -. owner withdraws .-> WD
  ST -. owner withdraws .-> WD
  WD --> X
```

Every arrow that changes status or assignment writes a history event and a Citizen update in the same database transaction.

## 5.5 State machine – complaint status

```mermaid
stateDiagram-v2
  [*] --> Submitted : submit_complaint
  Submitted --> UnderReview : review_complaint (department Officer)
  UnderReview --> InProgress : start_complaint (assigned Officer)
  InProgress --> Resolved : resolve_complaint (assigned Officer)
  Submitted --> Withdrawn : withdraw_complaint (owner)
  UnderReview --> Withdrawn : withdraw_complaint (owner)
  InProgress --> Withdrawn : withdraw_complaint (owner)
  Resolved --> [*]
  Withdrawn --> [*]
  note right of InProgress
    assign / set priority / add progress
    keep the status and increase the version
  end note
```

## 5.6 Database / ER design

Nine tables: `profiles`, `departments`, `categories`, `complaints`, `complaint_events`, `complaint_evidence`, `complaint_feedback`, `notifications`, and `private.admin_audit_events`. The ER diagram, column rules, access matrix and function contracts are in [database-design.md](../database-design.md). Key integrity rules:

- Resolution fields are set **if and only if** the status is Resolved. Withdrawal fields are set if and only if it is Withdrawn. In progress and Resolved require an assignee.
- `(complaint_id, complaint_version)` is unique, so there is exactly one history event per version.
- `(recipient_id, event_id)` is unique, so a notification is never duplicated.
- Feedback has the complaint as its primary key, so there is at most one per complaint.
- Foreign keys are `ON DELETE RESTRICT` everywhere. The application deletes nothing.

## 5.7 User-interface prototype

The UI was prototyped directly as working screens (no separate wireframing tool) and reviewed at desktop and 375 px mobile widths. The screenshots below come from the automated browser tests with fictional data (`CAPTURE_SCREENS=1 npx playwright test`).

| # | Screen | Role | Screenshot |
| --- | --- | --- | --- |
| 1 | Sign in | All | [01-sign-in.png](screens/01-sign-in.png) |
| 2 | Citizen overview (counts, recent complaints) | Citizen | [02-citizen-overview.png](screens/02-citizen-overview.png) |
| 3 | Make a complaint (category, description, map, coordinates) | Citizen | [03-citizen-new-complaint.png](screens/03-citizen-new-complaint.png) |
| 4 | Complaint detail (progress steps, location, evidence, history) | Citizen | [04-citizen-complaint-detail.png](screens/04-citizen-complaint-detail.png) |
| 5 | My complaints (search, status filter, pagination) | Citizen | [05-citizen-my-complaints.png](screens/05-citizen-my-complaints.png) |
| 6 | Resolved complaint with feedback | Citizen | [06-citizen-resolved-feedback.png](screens/06-citizen-resolved-feedback.png) |
| 7 | Updates inbox (unread badge, mark read) | Citizen | [07-citizen-updates-inbox.png](screens/07-citizen-updates-inbox.png) |
| 8 | Officer overview (department counts) | Officer | [08-officer-overview.png](screens/08-officer-overview.png) |
| 9 | Department queue (filters) | Officer | [09-officer-department-queue.png](screens/09-officer-department-queue.png) |
| 10 | Process complaint (action selector, guidance) | Officer | [10-officer-process-complaint.png](screens/10-officer-process-complaint.png) |
| 11 | Resolved complaint (closed processing) | Officer | [11-officer-resolved.png](screens/11-officer-resolved.png) |
| 12 | Administrator overview with monitoring | Administrator | [12-admin-overview-monitoring.png](screens/12-admin-overview-monitoring.png) |
| 13 | Service categories | Administrator | [13-admin-service-categories.png](screens/13-admin-service-categories.png) |
| 14 | Dispatch centre (coverage, needs-attention filter) | Administrator | [14-admin-dispatch-centre.png](screens/14-admin-dispatch-centre.png) |
| 15 | Service analytics (light / dark) | Administrator | [15-admin-analytics.png](screens/15-admin-analytics.png), [17-admin-analytics-dark.png](screens/17-admin-analytics-dark.png) |
| 16 | Department map | Officer | [16-officer-department-map.png](screens/16-officer-department-map.png) |
| 0 | Public landing page | Visitor | [00-landing.png](screens/00-landing.png) |

UI principles: one primary action per screen; plain-language status names; every form field labelled with its hint and error text; status shown as both text and colour; a skip-link and visible focus; and all user-supplied text rendered as plain text, never HTML.

### SD-4 Auto-assignment and Administrator dispatch (CR-006)

```mermaid
sequenceDiagram
  actor C as Citizen
  actor A as Administrator
  participant S as submit_complaint
  participant P as private.pick_officer
  participant X as admin_dispatch_complaint
  participant DB as PostgreSQL
  C->>S: submit (category, description, location)
  S->>DB: advisory lock 15/1761, then lock Citizen
  S->>P: least-loaded active Officer in routed department
  alt an Officer exists
    P-->>S: officer id
    S->>DB: INSERT complaint (assigned), event, notify Citizen and Officer
  else department has no Officers
    P-->>S: null
    S->>DB: INSERT complaint (unassigned), event, notify Citizen
    A->>X: dispatch(department, category, officer, version, reason)
    X->>DB: lock Administrator, Citizen, complaint, check version
    X->>DB: UPDATE route/assignee, event transferred or assigned, notify Citizen and Officer
  end
```

### Visual design system

The redesign uses a deliberate "civic signal" language rather than generic dashboard styling:

- **Palette and type:** warm paper surfaces, deep municipal green, and signal orange for anything that needs action. Bricolage Grotesque for headings and Public Sans for body text (self-hosted, so the strict CSP stays intact).
- **Complaints as service tickets:** a dashed perforation and notches.
- **Progress as a transit line:** the line fills between stations.
- **Motion:** page transitions, staggered lists, count-up figures and drawing route lines. All of it is disabled under `prefers-reduced-motion`.
- **Dark mode:** selected from the same tokens, not inverted. Chart series use a palette validated for both modes.

## 5.8 Design decisions and justification

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| **React + TypeScript + Vite** SPA | Server-rendered (Next.js), plain JS | Typed domain models catch errors at build time. Vite gives fast builds. The team already knew React. An SPA is enough because there is no SEO requirement. |
| **Supabase** (PostgreSQL, Auth, Storage) instead of a custom API server | Node/Express + MySQL; Firebase | Relational integrity (FKs, CHECKs, transactions) suits a workflow with history. RLS puts authorisation next to the data. Managed Auth avoids storing passwords ourselves. The free tier fits the project. |
| **Business writes only through `SECURITY DEFINER` RPCs**; direct table DML revoked | Direct table updates with RLS UPDATE policies | A status change must update the complaint, history and notification atomically with transition rules and locks. Generic UPDATE policies can't express "only valid transitions". |
| **Optimistic concurrency** (`expected_version`, error `PT409`) | Last-write-wins | Two Officers editing the same complaint must not overwrite each other silently. PT409 maps to HTTP 409 without PostgREST retry loops (defect DEF-01). |
| **Append-only history + durable notifications** in PostgreSQL | Realtime push, email/SMS | Meets CF-13/18 within the scope constraint on external notifications. History is the audit trail. |
| **Memory-only sessions** (`persistSession: false`) | localStorage tokens | Avoids leaving bearer tokens in persistent storage on shared computers. Trade-off: a page refresh requires signing in again (documented). |
| **Private evidence bucket** with server-reserved paths | Public bucket, signed URLs | Complaint evidence may contain personal information. Paths can't be chosen by users, and downloads are authorised per request. |
| **Department-scoped Officers; assigned-Officer-only progress/resolution** | Any Officer can edit any complaint | Least privilege and clear accountability, as the problem statement asks ("identifying responsible officers"). |
| **Categories deactivated, never deleted; referenced department immutable** | Hard delete / free edit | Historic complaints must keep their original routing and meaning. |
| **Leaflet + OpenStreetMap** with numeric coordinate fallback | Google Maps | No API key or cost. Accessible fallback when tiles fail. The OSM attribution policy is respected. |
| **Vercel** static hosting | Netlify, GitHub Pages | Simple Vite deployment, SPA rewrites and security headers configured in `vercel.json`. |
| **Auto-assignment + Administrator dispatch** (CR-006) | Manual pick-up only; giving Administrators full workflow rights | Guarantees an owner whenever staff exist, and gives a narrow, audited escape hatch when they don't, without making Administrators process complaints. |
| **`motion` library + CSS tokens** | Hand-written CSS only; heavy UI kits | Declarative, interruptible animations that respect reduced motion. Design tokens keep light and dark themes consistent. |
| **Vitest + PGlite + Playwright** | Jest only, manual testing | Tests each layer: pure rules, real SQL/RLS inside PostgreSQL, and user journeys in a real browser. |
