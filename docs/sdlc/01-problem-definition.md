# Stage 1 – Problem & project definition

Source: approved proposal §1–2 (pp. 4–7). This stage is reproduced and summarised here for the final report. Text marked *Refinement* was added during development and is traced to its decision record.

## 1.1 Background

Public services such as road maintenance, waste management, water supply, sanitation and public transport directly affect citizens. Complaints are traditionally made by telephone, by visiting an office, by email or informally. These channels make it hard for citizens to follow up. They also make it hard for service organisations to keep consistent records, assign responsibility, prioritise urgent cases and monitor unresolved complaints.

## 1.2 Problem statement

> Citizens find it difficult to report public service issues and follow up on them, because complaint information is handled through separate, manual channels. This leads to poor visibility of complaint status, slow communication, unclear responsibility and difficulty monitoring unresolved complaints. Public service organisations also lack an organised way to record, categorise, prioritise, assign and monitor complaints.

**Who is affected:** citizens, front-line public service officers, department managers and the organisation as a whole.
**Impact:** lost or duplicated complaints, no audit trail, unclear accountability and low public trust.
**Proposed solution:** CivicFlow, a role-based web application that gives every complaint a single, traceable digital lifecycle: submission → review → assignment and priority → work in progress → resolution → citizen feedback, with history and updates at every step.

## 1.3 Stakeholders and needs

| Stakeholder | Type | Needs | How CivicFlow addresses them |
| --- | --- | --- | --- |
| Citizen | Primary user (application role) | Easy submission, tracking, status visibility, updates and feedback | Complaint form with map, My Complaints, timeline, Updates inbox, feedback (CF-04…07, 13, 18, 19) |
| Public Service Officer | Primary user (application role) | Centralised complaints, search/filter, assignment, prioritisation and status management | Department queue, Assigned to me, filters, protected workflow actions (CF-08…12, 17) |
| Administrator | Primary user (application role) | User and category management, monitoring and secure administration | User management, Officer invitations, Service categories, monitoring overview (CF-14, 20, 21) |
| Department manager | Secondary stakeholder (**not** an application role) | Visibility of department complaints, workload and unresolved cases | Served by department-scoped queues and admin monitoring. Not a fourth login role (decision recorded in [requirements](../requirements.md)). |
| Public service organisations | Indirect stakeholder | Accountability, organised records, monitoring | Immutable history, audit events, data-driven categories and departments |
| Community | Indirect stakeholder | Transparent, responsive handling | Status and history visible to the complainant; resolution date recorded |
| Lecturer (ICT2232) | Project stakeholder / reviewer | Evidence of each SDLC stage | This evidence pack |

## 1.4 Objectives

From the proposal (§2.5), with the measurable evidence used to judge each:

| # | Objective | Evidence of achievement |
| --- | --- | --- |
| O1 | Convenient digital complaint submission | UC-03 implemented; browser test TC-SUB-01 |
| O2 | Citizens can track status and progress | UC-04, timeline, Updates inbox; TC-TRK-01, TC-NTF-01 |
| O3 | Officers can manage, assign, prioritise and resolve | UC-05…07; TC-OFF-01 |
| O4 | Accurate, centralised records | Database constraints, atomic history and rollback; TC-DB-SUB-05, TC-DB-OFF-08 |
| O5 | Timely progress and resolution updates | Durable notifications created in the same transaction as every change; TC-NTF-* |
| O6 | Feedback after resolution | UC-08; TC-FB-* |
| O7 | Administrators manage users and categories | UC-09, UC-10; TC-ADM-*, TC-CAT-* |
| O8 | Transparency, accountability, efficiency | Append-only history, admin audit log, department queues |
| O9 | Authentication and role-based authorisation | RLS and protected RPCs; [security](10-security.md) |
| O10 | Extensible to more public services | Categories and departments are data. CF-20 lets an Administrator add services without a code change. |

## 1.5 Scope

**In scope** (proposal §2.6.1): citizen registration, login and profile; role-based authentication for the three roles; complaint submission and validation; category and priority management; description and location; supporting image/document upload; assignment to officers and departments; status and progress updates; resolution details and history; notifications or in-system updates; feedback after resolution; search and filtering; administrative user and category management; basic monitoring.

**Out of scope / Won't Have** (proposal §2.6.2 and p. 15): online payments; real-time GPS tracking of field officers; automatic legal case management; AI-based complaint classification; integration with every government system; emergency response and disaster management; automated inspection or field dispatch.

*Refinements recorded during development* (each traced in [09-maintenance.md](09-maintenance.md)):

- CF-22: Citizen withdrawal of their own unresolved complaint with a reason. This is a user-approved scope extension and is not part of the original proposal.
- CF-04: optional "Use my current location" button. This is one-shot and opt-in. It is **not** officer GPS tracking.
- CF-14: Administrator-created Officer invitations, so Officers cannot self-register into privileged access.
- CF-13 is delivered as **in-system** updates. SMS, email and push alerts for complaints are out of scope (proposal constraint: "possible limitations in implementing real-time external notifications").

## 1.6 Assumptions

From the proposal (§2.7). The *validation status* column was added during development.

| Assumption | Status |
| --- | --- |
| Users have an internet-connected device and browser | Accepted; responsive UI tested at 375 px and desktop widths |
| Citizens provide truthful, sufficient information | Accepted. The system validates form and bounds but can't verify truth. Officers review each complaint. |
| Officers have access and update complaints | Accepted; Officer accounts are invited by an Administrator |
| Categories and departments are system data | Implemented as database tables; six prototype categories chosen by the team |
| Evidence follows supported types and size | Enforced: JPEG/PNG/PDF, ≤ 5 MiB, ≤ 5 files per complaint |
| Demonstrations use fictional data | Enforced for all automated tests and screenshots |
| No external government integration | Accepted |

## 1.7 Constraints

Limited academic duration; a five-person student team; no access to real government databases; external real-time notifications limited; security and privacy must still be designed in; the system can't represent every organisation's workflow. Technology constraints adopted by the team: free-tier hosting (Supabase, Vercel), a web-only client and a single frontend backed by a managed backend (no custom API server). These are justified in [02-process-model.md](02-process-model.md) and [05-design.md](05-design.md).
