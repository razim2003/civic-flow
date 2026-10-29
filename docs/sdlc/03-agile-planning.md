# Stage 3 – Agile planning

## 3.1 Product backlog

The proposal backlog (§4.1), with IDs, MoSCoW priority, sprint and current status. CF IDs are the requirement IDs used everywhere else in the repository.

| CF ID | Backlog item | MoSCoW | Sprint | Status (2026-10-29) |
| --- | --- | --- | --- | --- |
| CF-01 | User registration (Citizen) | Must | 1 | Done |
| CF-02 | Secure login/logout | Must | 1 | Done |
| CF-03 | Role-based access control | Must | 1 | Done |
| CF-04 | Submit complaint (description, location) | Must | 2 | Done |
| CF-05 | Complaint category selection | Must | 2 | Done |
| CF-06 | Unique complaint ID, initial Submitted status | Must | 2 | Done |
| CF-07 | View submitted complaints / track status | Must | 2 | Done |
| CF-08 | Officer review and complaint queue | Must | 3 | Done |
| CF-09 | Assign complaint (officer/department) | Must | 3 | Done |
| CF-10 | Set complaint priority | Must | 3 | Done |
| CF-11 | Update status and progress remarks | Must | 3 | Done |
| CF-12 | Resolve complaint | Must | 4 | Done |
| CF-13 | Complaint notifications/updates | Must | 4 | Done (inbox and read state added 2026-10-29) |
| CF-14 | Admin user management | Must | 1 (+3) | Done |
| CF-15 | Citizen profile management | Should | 1 | Done (display name) |
| CF-16 | Upload supporting evidence | Should | 2 | Done |
| CF-17 | Search and filter complaints | Should | 2–3 | Done |
| CF-18 | Complaint history | Should | 2–3 | Done |
| CF-19 | Citizen feedback | Should | 4 | Done (2026-10-29) |
| CF-20 | Complaint category management | Should | 2→4 | Done (2026-10-29) |
| CF-21 | Dashboard/reports | Could | 4 | Basic monitoring done; enhanced reports not planned |
| CF-22 | Citizen withdrawal *(approved scope extension)* | Should (team-assigned) | 2 | Done |
| CF-23 | Automatic workload-balanced assignment *(CR-006)* | Must | 5 | Done |
| CF-24 | Administrator dispatch centre *(CR-006)* | Must | 5 | Done |
| CF-25 | Service-level targets and overdue flags *(CR-006)* | Should | 5 | Done |
| — | Integration/system testing, security, deployment | Sprint 5 scope | 5 | In progress |

## 3.2 User stories

Written as "As a ‹role›, I want ‹capability›, so that ‹benefit›." The 20 stories expand the proposal's story titles (§4.2). Story points use a relative 1–8 scale, estimated by the team. They are planning estimates, not measured effort.

| ID | User story | CF | MoSCoW | Pts |
| --- | --- | --- | --- | --- |
| US-01 | As a **citizen**, I want to create an account with my name, email and a password, so that I can submit and follow my complaints. | CF-01 | Must | 3 |
| US-02 | As a **registered user**, I want to log in and log out securely, so that only I can use my account. | CF-02 | Must | 3 |
| US-03 | As any **user**, I want to see only the pages and data my role allows, so that private information stays protected. | CF-03 | Must | 5 |
| US-04 | As a **citizen**, I want to describe a public service problem and mark its location on a map or by coordinates, so that the service team can find it. | CF-04 | Must | 8 |
| US-05 | As a **citizen**, I want to choose a service category, so that my complaint reaches the right department. | CF-05 | Must | 2 |
| US-06 | As a **citizen**, I want a unique reference and confirmation after submitting, so that I know my complaint was recorded. | CF-06 | Must | 2 |
| US-07 | As a **citizen**, I want to list, search and open my complaints and see their status, so that I know what is happening. | CF-07, CF-17 | Must | 5 |
| US-08 | As an **officer**, I want a queue of my department's complaints with filters, so that I can see and pick up work. | CF-08, CF-17 | Must | 5 |
| US-09 | As an **officer**, I want to assign a complaint to an officer in my department, so that responsibility is clear. | CF-09 | Must | 3 |
| US-10 | As an **officer**, I want to set a complaint's priority, so that urgent problems are handled first. | CF-10 | Must | 2 |
| US-11 | As an **assigned officer**, I want to start work and add progress remarks, so that the citizen sees what is being done. | CF-11 | Must | 5 |
| US-12 | As an **assigned officer**, I want to record resolution details and mark the complaint resolved, so that the case is closed with a record. | CF-12 | Must | 3 |
| US-13 | As a **citizen**, I want an Updates inbox that shows what changed and which updates I haven't read, so that I don't miss progress on my complaints. | CF-13 | Must | 5 |
| US-14 | As an **administrator**, I want to view users and change their role, department or active status, and invite officers, so that the team has the right access. | CF-14 | Must | 8 |
| US-15 | As a **citizen**, I want to change my display name, so that my profile is correct. | CF-15 | Should | 1 |
| US-16 | As a **citizen**, I want to attach photos or PDF documents privately, so that officers have evidence of the problem. | CF-16 | Should | 8 |
| US-17 | As a **citizen or officer**, I want to see the full history of a complaint, so that every change is transparent. | CF-18 | Should | 3 |
| US-18 | As a **citizen**, I want to rate and comment on how my resolved complaint was handled, so that the service can improve. | CF-19 | Should | 3 |
| US-19 | As an **administrator**, I want to add, rename, route and deactivate service categories, so that the system can grow to new services without code changes. | CF-20 | Should | 5 |
| US-20 | As a **citizen**, I want to withdraw my unresolved complaint with a reason, so that officers don't spend time on a problem that no longer needs action. | CF-22 | Should* | 5 |
| US-21 | As an **administrator**, I want summary counts of complaints by status and the average feedback rating, so that I can monitor service performance. | CF-21 | Could | 2 |
| US-22 | As a **citizen**, I want my complaint to be given to a responsible Officer as soon as I submit it, so that it never waits unnoticed. | CF-23 | Must | 5 |
| US-23 | As an **administrator**, I want to route and assign complaints that are stuck in departments without Officers, so that every complaint has an owner. | CF-24 | Must | 5 |
| US-24 | As an **officer**, I want to see which complaints are due soon or overdue, so that I handle urgent work first. | CF-25 | Should | 3 |

\*CF-22 is a user-approved scope extension; see [09-maintenance.md](09-maintenance.md).

## 3.3 Acceptance criteria (major stories)

Given/When/Then form. Each criterion links to the automated test that checks it (see the [test report](07-test-report.md)).

**US-04/05/06 Submit complaint** (proposal §4.3 "Submit Complaint")
- AC1 Given I am a signed-in **citizen**, when I submit a valid category, description (10–5,000 characters), location text (1–300) and coordinates, then the complaint is saved with a database-generated UUID and status **Submitted**, and a confirmation shows the reference. *(TC-SUB-01, TC-DB-SUB-01)*
- AC2 Given a required field is missing or out of bounds, when I submit, then the form shows the field error and nothing is saved. The database also rejects the same input sent directly. *(TC-SUB-02, TC-DB-SUB-03)*
- AC3 Given the response is lost and I retry, then the same complaint is returned and no duplicate is created. *(TC-SUB-03, TC-DB-SUB-02)*
- AC4 Given I am not a citizen, or I am inactive or anonymous, then submission is refused by the database. *(TC-DB-SUB-04)*

**US-07 Track complaint** (proposal §4.3 "Track Complaint")
- AC1 Given I have complaints, when I open My Complaints, then I see only my own, with reference, category and current status. *(TC-TRK-01)*
- AC2 When I open one, then I see progress steps, history and, if resolved, the resolution text and date. *(TC-TRK-02)*
- AC3 Given a reference that isn't mine or doesn't exist, then no details are shown. *(TC-TRK-03, TC-DB-SUB-06)*

**US-11 Update status** (proposal §4.3 "Update Status")
- AC1 Only an active officer of the complaint's department can review it, and only the **assigned** officer can start, add progress or resolve. *(TC-DB-OFF-02, TC-OFF-05)*
- AC2 Only valid transitions are accepted: Submitted → Under review → In progress → Resolved. Skipped or repeated steps are rejected. *(TC-DB-OFF-05)*
- AC3 Each change stores the new status, appends one history event and one citizen notification atomically, and the citizen can see it. *(TC-DB-OFF-01, TC-DB-OFF-08)*
- AC4 If someone else changed the complaint first, my change is rejected as stale and my input is kept. *(TC-OFF-03, TC-DB-OFF-05)*

**US-12 Resolve complaint** (proposal §4.3 "Resolve Complaint")
- AC1 Resolution requires 10–5,000 characters of details and explicit confirmation. Status becomes **Resolved** and the date and resolving officer are stored. *(TC-OFF-01, TC-DB-OFF-06)*
- AC2 The citizen sees the resolution and receives a "Complaint resolved" update. *(TC-NTF-01)*
- AC3 Feedback becomes available to the owner. *(TC-FB-01)*
- AC4 Resolved and withdrawn complaints reject all further processing. *(TC-DB-OFF-07)*

**US-13 Updates inbox**
- AC1 Given changes to my complaints, when I open Updates, then I see one item per change, newest first, with unread items marked and counted in the navigation badge. *(TC-NTF-01)*
- AC2 When I mark one or all as read, then only my own notifications change and the badge updates. *(TC-NTF-01, TC-DB-NTF-02)*
- AC3 I can never see another user's notifications. *(TC-DB-NTF-01)*

**US-14 Manage users** (proposal §4.3 "Manage Users")
- AC1 Only an active administrator can open user management or call its operations. Other roles are denied by the database. *(TC-ADM-01, TC-DB-ADM-01)*
- AC2 The administrator can change role, department and active state. An officer must have an active department. Every change is audited. *(TC-DB-ADM-02)*
- AC3 The last active administrator can't be demoted or deactivated, even by concurrent requests. *(TC-ADM-02, TC-DB-ADM-03, TC-INT-08)*
- AC4 A deactivated user loses access immediately, even with an unexpired session. *(TC-DB-ADM-04)*

**US-18 Feedback**
- AC1 Given my complaint is **Resolved**, when I choose a 1–5 rating (and optionally a comment of up to 2,000 characters) and submit, then it is saved once and shown read-only. *(TC-FB-01, TC-DB-FB-01)*
- AC2 A second, different submission is refused with a clear message. *(TC-FB-02, TC-DB-FB-01)*
- AC3 Feedback on unresolved or withdrawn complaints, or by anyone other than the owner, is refused. *(TC-DB-FB-03, TC-DB-FB-04)*

**US-19 Manage categories**
- AC1 Only an administrator can create or edit categories. Every change is audited. *(TC-CAT-01, TC-DB-CAT-01, TC-DB-CAT-05)*
- AC2 Deactivated categories disappear from the citizen form but stay on existing complaints. *(TC-DB-CAT-02)*
- AC3 Names are unique regardless of case. An active category must route to an active department. *(TC-DB-CAT-03)*
- AC4 A category that already has complaints keeps its department. *(TC-CAT-02, TC-DB-CAT-04)*

**US-22/23 Every complaint has an owner (CR-006)**
- AC1 Given a department has active Officers, when a citizen submits, then the Officer with the fewest open assignments is assigned and notified. *(TC-DB-DSP-01)*
- AC2 Given a department has no active Officers, then the complaint is unassigned and appears under *Needs attention* with "No Officers in department". *(TC-DB-DSP-02, TC-DSP-01)*
- AC3 When an administrator dispatches it with a reason, then department, category and assignee change in one versioned transaction with history and notifications. Work in progress can't leave its department. *(TC-DSP-01, TC-DB-DSP-04…07)*

**US-20 Withdraw complaint**
- AC1 The owner of a Submitted, Under review or In progress complaint gives a 10–2,000 character reason and confirms. Status becomes **Withdrawn** (final) and the record, evidence and history are kept. *(TC-WD-01, TC-DB-WD-01)*
- AC2 Resolved or already-withdrawn complaints can't be withdrawn. Other users can't withdraw them. *(TC-WD-04, TC-DB-WD-02)*

## 3.4 Sprint plan and sprint history

The five sprints are exactly those in the proposal (§4.4). Dates are taken from the repository's sprint records and git history.

| Sprint | Goal (proposal) | Delivered increment | Recorded dates | Evidence |
| --- | --- | --- | --- | --- |
| 1 Foundation & Authentication | Project setup, database foundation, registration, login, roles, basic UI | React/Vite/Tailwind scaffold; Supabase schema with RLS; signup, login, recovery; role workspaces; admin user management; CI | 2026-10-19 | [sprint-1.md](../sprint-1.md) |
| 2 Complaint Submission | Form, categories, validation, evidence, record creation | Complaint form with map; six categories; idempotent submission; private evidence; My Complaints; CF-22 withdrawal | 2026-10-19 → 21 | [sprint-2.md](../sprint-2.md), [citizen-withdrawal.md](../citizen-withdrawal.md) |
| 3 Complaint Processing | Officer dashboard, assignment, priority, status, remarks | Officer queues, filters, review/assign/priority/start/progress/transfer; Officer invitations | 2026-10-20 → 21 | [officer-portal.md](../officer-portal.md) |
| 4 Tracking & Resolution | Tracking, notifications/updates, resolution, feedback | Resolution (2026-10-21); Updates inbox, feedback, category management, monitoring (2026-10-29) | 2026-10-21, 2026-10-29 | [sprint-4.md](../sprint-4.md) |
| 5 Quality & Release | Integration, system testing, security, defect fixing, deployment | CR-006 dispatch/coverage fix, auto-assignment, service targets, analytics, map, redesign with motion and dark mode; test report, security, deployment preparation | 2026-10-29 → 30, in progress | [sprint-5.md](../sprint-5.md), 07–10 |

**Sprint review / retrospective notes** (recorded from the sprint documents):

- Sprint 2 review found an empty category dropdown, because the hosted categories migration hadn't been applied. This led to an explicit "missing setup" UI state and a rule that the hosted database must be checked before each demo.
- Sprint 3 review: real HTTP concurrency tests found that PostgREST retries SQLSTATE 40001 indefinitely. The correction (PT409) led to adding real-JWT integration tests to the Definition of Done for workflow SQL.
- Sprint 5 review: hosted use showed 4 of 5 open complaints in departments with no Officers, so they were invisible to everyone able to act. This led to CR-006 (auto-assignment, Administrator dispatch, service targets) being prioritised above deployment.
- Sprint 4 review: the planned "notification inbox" had been partly delivered as history in Sprint 2/3. The remaining inbox and read-state work was split out explicitly so it wouldn't be over-claimed.

## 3.5 Task allocation

The original allocation (proposal §4.5) is preserved. Feature ownership does not mean each owner built a separate subsystem: modules integrate through shared contracts.

| Member | Main area | Responsibilities | Backlog items owned |
| --- | --- | --- | --- |
| TG/2023/1731 | Requirements & Citizen Module | Stakeholder analysis, requirements, user stories, registration, login, profile, complaint submission | CF-01, 02, 04, 07, 13 (UI), 15, 19 (UI), 22 (UI) |
| TG/2023/1710 | Complaint Management Module | Categories, complaint details, evidence upload, assignment, priority | CF-05, 06, 09, 10, 16, 20 (category UX) |
| TG/2023/1757 | Officer Module | Officer dashboard, review, status updates, progress remarks, resolution | CF-08, 11, 12, 17 (officer) |
| TG/2023/1761 | Admin & Database | ER design, user management, category management, admin dashboard, DB integration | CF-03 (DB), 14, 18, 19/20 (DB), 21 |
| TG/2023/1776 | Quality, Security & Deployment | Test planning, system/integration testing, security controls, error handling, deployment, maintenance CR | All test suites, Sprint 5, 07/08/09/10 |

Actual individual contributions are recorded in [11-contribution-log.md](11-contribution-log.md).
