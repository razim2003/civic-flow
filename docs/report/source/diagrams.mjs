// Mermaid sources for every report diagram. Rendered to PNG by render-diagrams.mjs.
export const mermaidDiagrams = {
  

  'gantt': `gantt
  title CivicFlow – sprint timeline (2026)
  dateFormat YYYY-MM-DD
  axisFormat %d %b
  section Planning
  Proposal – Milestones 1-3 (definition, Agile plan, requirements) :done, p1, 2026-09-21, 2026-10-12
  Design baseline (architecture, UML, ER, UI)                   :done, p2, 2026-10-12, 2026-10-19
  section Sprints
  Sprint 1 – Foundation & authentication                        :done, s1, 2026-10-19, 1d
  Sprint 2 – Complaint submission                               :done, s2, 2026-10-19, 3d
  Sprint 3 – Complaint processing                               :done, s3, 2026-10-20, 2d
  Sprint 4 – Tracking, resolution & feedback                    :done, s4, 2026-10-21, 9d
  Sprint 5 – Quality, CR-006, security & release                :done, s5, 2026-10-29, 2d
  section Release
  Vercel production deployment                                  :milestone, m1, 2026-10-30, 0d
  Final presentation & demonstration                            :active, f1, 2026-10-31, 7d`,

  'architecture': `flowchart LR
  subgraph CL["Client tier – any browser (untrusted)"]
    SPA["React 19 + TypeScript SPA<br/>feature modules:<br/>auth · complaints · evidence · officer<br/>feedback · notifications · dispatch<br/>analytics · categories · admin"]
  end
  subgraph VC["Presentation hosting – Vercel"]
    CDN["Global CDN<br/>static index.html + JS/CSS<br/>SPA rewrites · CSP · security headers"]
  end
  subgraph SB["Application & data tier – Supabase (managed backend)"]
    AUTH["Supabase Auth<br/>sign-up · e-mail verification<br/>invitations · recovery · JWT"]
    API["PostgREST Data API<br/>reads filtered by RLS"]
    RPC["Business logic<br/>20 SECURITY DEFINER RPCs<br/>validation · rules · transactions"]
    DB[("PostgreSQL 17<br/>8 tables + audit table<br/>RLS · constraints · history")]
    ST["Storage<br/>private bucket<br/>complaint-evidence"]
    EF["Edge Function (Deno)<br/>provision-officer"]
  end
  OSM["OpenStreetMap<br/>map tiles"]
  SPA -- "1 load app (HTTPS)" --> CDN
  SPA -- "2 sign in / JWT" --> AUTH
  SPA -- "3 SELECT + user JWT" --> API --> DB
  SPA -- "4 rpc() + user JWT" --> RPC --> DB
  SPA -- "5 evidence upload/download" --> ST
  SPA -- "6 invite Officer (admin)" --> EF --> AUTH
  SPA -- "map images" --> OSM
  classDef ext fill:#f1efe9,stroke:#8a8577,color:#2b2a26
  class OSM ext`,

  'layers': `flowchart TB
  subgraph F["Each feature module  (src/features/<feature>)"]
    UI["ui/<br/>React pages & components<br/>(no Supabase calls)"]
    APP["application/<br/>hooks & use cases<br/>loading · errors · retries"]
    MOD["model/<br/>pure types, Zod schemas,<br/>business rules (testable)"]
    DATA["data/<br/>the only code that calls<br/>Supabase (REST / RPC / Storage)"]
  end
  SH["shared/<br/>one Supabase client · env validator<br/>error messages · location · UI kit · motion"]
  SUPA[("Supabase backend")]
  UI --> APP
  APP --> MOD
  APP --> DATA
  DATA --> SUPA
  UI -.-> SH
  DATA -.-> SH
  classDef be fill:#fdeee6,stroke:#d9531e,color:#3a1a0c
  class SUPA be`,

  'class': `classDiagram
  direction TB
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
    +adminUpsertCategory()
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
    +submit()
    +review()
    +assign(officer)
    +setPriority(p)
    +transfer(category)
    +dispatch(dept, officer)
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
    +datetime createdAt
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
  class Priority {
    <<enumeration>>
    low
    normal
    high
    urgent
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
  Profile ..> AppRole
  Complaint ..> ComplaintStatus
  Complaint ..> Priority`,

  'er': `erDiagram
  AUTH_USERS ||--|| PROFILES : "has"
  DEPARTMENTS ||--o{ PROFILES : "employs officers"
  DEPARTMENTS ||--o{ CATEGORIES : "receives"
  PROFILES ||--o{ COMPLAINTS : "submits"
  CATEGORIES ||--o{ COMPLAINTS : "classifies"
  DEPARTMENTS ||--o{ COMPLAINTS : "owns queue"
  PROFILES |o--o{ COMPLAINTS : "assigned to"
  COMPLAINTS ||--|{ COMPLAINT_EVENTS : "records"
  COMPLAINTS ||--o{ COMPLAINT_EVIDENCE : "supports"
  COMPLAINTS ||--o| COMPLAINT_FEEDBACK : "receives"
  PROFILES ||--o{ NOTIFICATIONS : "receives"
  COMPLAINT_EVENTS ||--o{ NOTIFICATIONS : "creates"
  PROFILES ||--o{ ADMIN_AUDIT_EVENTS : "performs"
  PROFILES {
    uuid id PK
    text display_name
    app_role role
    boolean is_active
    uuid department_id FK
  }
  DEPARTMENTS {
    uuid id PK
    text name UK
    boolean is_active
  }
  CATEGORIES {
    uuid id PK
    text name UK
    text description
    uuid department_id FK
    boolean is_active
  }
  COMPLAINTS {
    uuid id PK
    uuid citizen_id FK
    uuid submission_request_id
    uuid category_id FK
    uuid department_id FK
    uuid assigned_officer_id FK
    text description
    text location_text
    float latitude
    float longitude
    complaint_status status
    complaint_priority priority
    text resolution_text
    timestamptz resolved_at
    text withdrawal_reason
    bigint version
  }
  COMPLAINT_EVENTS {
    uuid id PK
    uuid complaint_id FK
    bigint complaint_version
    uuid actor_id FK
    text event_type
    text remark
    jsonb changes
  }
  COMPLAINT_EVIDENCE {
    uuid id PK
    uuid complaint_id FK
    text object_path UK
    text original_filename
    text declared_content_type
    bigint declared_size_bytes
    text state
  }
  COMPLAINT_FEEDBACK {
    uuid complaint_id PK
    uuid citizen_id FK
    smallint rating
    text comment
  }
  NOTIFICATIONS {
    uuid id PK
    uuid recipient_id FK
    uuid event_id FK
    text kind
    timestamptz read_at
  }
  ADMIN_AUDIT_EVENTS {
    uuid id PK
    uuid actor_id FK
    text action
    uuid target_id
    jsonb changes
  }`,

  'seq-submit': `sequenceDiagram
  autonumber
  actor C as Citizen
  participant UI as NewComplaint<br/>Page (ui)
  participant H as useSubmission<br/>(application)
  participant M as submission<br/>Schema (model)
  participant D as complaints-api<br/>(data)
  participant R as submit_complaint RPC
  participant DB as PostgreSQL
  C->>UI: fill form + map point
  C->>UI: Submit
  UI->>H: submit(form)
  H->>M: safeParse(form)
  alt invalid input
    M-->>UI: field errors (nothing is sent)
  else valid input
    H->>D: submitComplaint(input, requestId)
    D->>R: POST /rpc/<br/>submit_complaint
    R->>DB: lock caller profile<br/>(active Citizen?)
    R->>DB: validate bounds,<br/>category → department
    alt same requestId already saved
      R-->>D: existing row<br/>(idempotent retry)
    else new complaint
      R->>DB: pick least-loaded<br/>Officer (CR-006)
      R->>DB: INSERT complaint<br/>(submitted, v1)
      R->>DB: INSERT first event +<br/>notifications (same txn)
      R-->>D: complaint row
    end
    D-->>H: Complaint
    H-->>UI: show reference<br/>CF-XXXXXXXX
  end`,

  'seq-resolve': `sequenceDiagram
  autonumber
  actor O as Assigned Officer
  participant UI as OfficerActions (ui)
  participant D as officer-api (data)
  participant R as resolve_complaint RPC
  participant L as lock_officer<br/>_complaint
  participant DB as PostgreSQL
  O->>UI: Resolve + details<br/>+ confirm
  UI->>D: resolve(id, text,<br/>expectedVersion)
  D->>R: POST /rpc/<br/>resolve_complaint
  R->>L: lock(id, expectedVersion)
  L->>DB: lock Officer +<br/>active department
  L->>DB: lock Citizen, then<br/>complaint FOR UPDATE
  L-->>R: complaint, or not_authorized /<br/>complaint_closed / stale (409)
  R->>R: assignee? in_progress?<br/>text 10–5000?
  R->>DB: UPDATE resolved,<br/>resolved_at/by, version+1
  R->>DB: INSERT event +<br/>Citizen notification
  R-->>D: updated complaint
  D-->>UI: refresh detail<br/>and history
  Note over R,DB: any failure rolls back<br/>update + event + notification`,

  'seq-dispatch': `sequenceDiagram
  autonumber
  actor C as Citizen
  actor A as Administrator
  participant S as submit_complaint
  participant P as pick_officer
  participant X as admin_dispatch<br/>_complaint
  participant DB as PostgreSQL
  C->>S: submit(category,<br/>details, location)
  S->>DB: lock Citizen profile
  S->>P: least-loaded active<br/>Officer in department?
  alt department has an active Officer
    P-->>S: officer id
    S->>DB: INSERT (assigned), event,<br/>notify Citizen + Officer
  else department has no Officers
    P-->>S: null
    S->>DB: INSERT (unassigned),<br/>event, notify Citizen
    Note over A: Dispatch centre flags<br/>No Officers in department
    A->>X: dispatch(dept, category,<br/>officer, version, reason)
    X->>DB: lock admin, citizen,<br/>complaint, check version
    X->>DB: UPDATE route/assignee,<br/>event, notify both
  end`,

  'seq-feedback': `sequenceDiagram
  autonumber
  actor C as Citizen (owner)
  participant P as FeedbackPanel (ui)
  participant H as useFeedback (application)
  participant D as feedback-api (data)
  participant R as submit_feedback RPC
  participant DB as PostgreSQL
  P->>D: getFeedback()<br/>(RLS-filtered)
  D-->>P: none yet →<br/>show rating form
  C->>P: rating 4 +<br/>comment, Submit
  P->>H: submit(4, comment)
  H->>H: validate 1–5,<br/>comment ≤ 2000
  H->>D: submitFeedback()
  D->>R: POST /rpc/submit_feedback
  R->>DB: lock Citizen +<br/>owned complaint
  R->>R: resolved?<br/>feedback exists?
  alt identical retry
    R-->>D: stored feedback
  else different second attempt
    R-->>D: feedback_exists
  else first submission
    R->>DB: INSERT complaint_feedback
    R-->>D: feedback row
  end
  H->>D: reload →<br/>read-only panel`,

  'activity': `flowchart TD
  S(["● Citizen submits complaint"]) --> V{"Valid input and<br/>active category?"}
  V -- no --> E1["Show field errors<br/>nothing is saved"] --> S
  V -- yes --> SUB["Status: SUBMITTED<br/>routed to department queue"]
  SUB --> AA{"Department has an<br/>active Officer?"}
  AA -- yes --> AUTO["Auto-assign least-loaded Officer<br/>notify Officer"]
  AA -- no --> DISP["Administrator dispatches<br/>with a reason"]
  DISP --> AUTO
  AUTO --> EV{"Attach evidence?"}
  EV -- yes --> UP["Reserve → upload → finalize<br/>(private storage)"] --> REV
  EV -- no --> REV["Officer begins review<br/>Status: UNDER REVIEW"]
  REV --> WRONG{"Wrong department?"}
  WRONG -- yes --> TR["Transfer with reason"] --> AA
  WRONG -- no --> PRI["Set priority / reassign"]
  PRI --> ST["Assigned Officer starts work<br/>Status: IN PROGRESS"]
  ST --> PR["Add progress remark"]
  PR --> DONE{"Work complete?"}
  DONE -- no --> PR
  DONE -- yes --> RES["Resolve with details<br/>Status: RESOLVED"]
  RES --> FB["Citizen rates the service (once)"]
  FB --> X(["◉ End"])
  SUB -. "owner withdraws with reason" .-> WD["Status: WITHDRAWN (final)"]
  REV -. "owner withdraws" .-> WD
  ST -. "owner withdraws" .-> WD
  WD --> X
  classDef final fill:#fdeee6,stroke:#d9531e,color:#3a1a0c
  class WD,RES final`,

  'state': `stateDiagram-v2
  direction TB
  [*] --> Submitted : submit_complaint
  Submitted --> UnderReview : review_complaint\\n(department Officer)
  UnderReview --> InProgress : start_complaint\\n(assigned Officer)
  InProgress --> Resolved : resolve_complaint\\n(assigned Officer)
  Submitted --> Withdrawn : withdraw_complaint (owner)
  UnderReview --> Withdrawn : withdraw_complaint (owner)
  InProgress --> Withdrawn : withdraw_complaint (owner)
  Resolved --> [*]
  Withdrawn --> [*]
  note right of InProgress
    assign · set priority · add progress
    keep the status and increase the version
  end note`,

  'deployment': `flowchart TB
  U["«device» User browsers<br/>Citizen · Officer · Administrator<br/>(phone, tablet, laptop)"]
  subgraph GH["«repository» GitHub – razim2003/civic-flow"]
    CI["GitHub Actions CI<br/>lint · typecheck · tests · build"]
  end
  subgraph VC["«cloud node» Vercel – project civic-flow"]
    CDN["Global CDN – civic-flow-rho.vercel.app<br/>static dist/ bundle · fonts<br/>vercel.json: SPA rewrite · CSP · headers"]
  end
  subgraph SB["«cloud node» Supabase – project xapqfnumcpjckhpdyuxz"]
    direction LR
    A["Auth"] --- P["PostgREST<br/>API + RPC"] --- D[("PostgreSQL 17<br/>migrations 001–015")]
    S["Storage<br/>private bucket"] --- E["Edge Function<br/>provision-officer"]
  end
  OSM["OpenStreetMap tiles"]
  CI -- "vercel deploy --prod" --> CDN
  U -- "HTTPS: load app" --> CDN
  U -- "HTTPS + JWT: data, files, invites" --> SB
  U -- "map tiles" --> OSM`,

  

  

  'impact': `flowchart LR
  CR(["CR-006<br/>Every complaint must reach<br/>a responsible Officer"])
  CR --> RQ["Requirements<br/>+CF-23 auto-assignment<br/>+CF-24 dispatch<br/>+CF-25 service targets<br/>+US-22…24, UC-15"]
  CR --> DS["Design<br/>SD-4 sequence<br/>narrow admin dispatch right<br/>SLA rules"]
  CR --> DBB["Database – migration 015<br/>replace submit_complaint<br/>+admin_dispatch_complaint<br/>+admin_analytics<br/>no table changes"]
  CR --> CD["Code<br/>features/dispatch<br/>features/analytics<br/>SLA badges, officer map"]
  CR --> TT["Testing<br/>+15 DB, +8 unit, +4 browser<br/>5 assertions updated"]
  CR --> DC["Documentation<br/>RTM, backlog, test report,<br/>security, user guide"]
  classDef cr fill:#fdeee6,stroke:#d9531e,color:#3a1a0c
  class CR cr`,

  'trust': `flowchart TB
  subgraph UNTRUSTED["Untrusted zone – user's browser"]
    ATT["Any user or attacker<br/>can edit JS, URLs, requests"]
    SPA["CivicFlow SPA<br/>route guards = UX only"]
  end
  subgraph EDGE["Transport"]
    TLS["HTTPS only<br/>CSP · X-Frame-Options DENY<br/>nosniff"]
  end
  subgraph TRUSTED["Trusted zone – Supabase"]
    JWT["Auth – verifies JWT"]
    RLS["Row Level Security<br/>owner / department / admin"]
    RPC["Definer RPCs<br/>live role check · transitions<br/>version lock · validation"]
    STO["Private storage policies"]
    AUD[("History + audit log")]
  end
  ATT --> SPA --> TLS --> JWT
  JWT --> RLS & RPC & STO
  RPC --> AUD
  classDef bad fill:#fbe4e1,stroke:#c0392b,color:#4a120b
  classDef good fill:#e3f1ea,stroke:#1f7a4f,color:#0e2e1f
  class ATT bad
  class RLS,RPC,STO,JWT good`,
};
