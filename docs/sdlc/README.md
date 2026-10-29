# CivicFlow – SDLC evidence pack

ICT2232 Software Engineering · University of Ruhuna · Group 15 · Public Service Complaint & Resolution System

This folder explains how CivicFlow moved through each of the ten SDLC stages in the ICT2232 mini-project guidelines. It shows how the outputs of one stage became the inputs of the next. The approved proposal ([grp15SE.pdf](../reference/grp15SE.pdf), unmodified) is the baseline. Every later change is recorded as a change, not silently written into the baseline.

## How to read this pack

| Stage (guidelines §5) | Document | Key evidence | Feeds into |
| --- | --- | --- | --- |
| 1 Problem & project definition | [01-problem-definition.md](01-problem-definition.md) | Problem statement, stakeholders and needs, objectives, scope, assumptions, constraints | Backlog and requirements |
| 2 Process planning | [02-process-model.md](02-process-model.md) | Scrum selection and justification, project plan, development workflow, Definition of Done, CI | Sprint plan |
| 3 Agile planning | [03-agile-planning.md](03-agile-planning.md) | Product backlog (MoSCoW), 20 user stories, acceptance criteria, sprint plan and history, task allocation | Requirements and tests |
| 4 Requirements engineering | [04-requirements-specification.md](04-requirements-specification.md) | 22 functional and 10 measurable non-functional requirements, use-case diagram and descriptions, prioritisation, traceability matrix, validation record | Design and test cases |
| 5 Design | [05-design.md](05-design.md) | Architecture, class/domain model, three sequence diagrams, activity and state diagrams, ER model, UI screens, design decisions | Implementation |
| 6 Implementation | [06-implementation.md](06-implementation.md) | Module map, coding standards, validation and error handling, integration, version control | Testing |
| 7 Testing | [07-test-report.md](07-test-report.md) | Test plan, test cases with IDs, execution results, defect log, limitations | Release decision |
| 8 Deployment | [08-deployment.md](08-deployment.md) | Deployment architecture, configuration, installation steps, smoke-test checklist | Demonstration |
| 9 Maintenance | [09-maintenance.md](09-maintenance.md) | Change-request process, impact analyses for changes already made, slot for the lecturer's change request | Updated artefacts |
| 10 Security | [10-security.md](10-security.md) | Threats, risk assessment, security requirements, implemented controls with evidence | Release decision |
| Team | [11-contribution-log.md](11-contribution-log.md) | Allocation, contribution log template, version-control evidence | Viva |
| Users | [user-guide.md](user-guide.md) | Step-by-step guide for each role, with screenshots | Demonstration |

Detailed engineering records stay where they were written during development. They are the primary evidence behind this pack: [requirements baseline](../requirements.md), [architecture](../architecture.md), [database design](../database-design.md), [roadmap](../implementation-roadmap.md), the sprint records ([1](../sprint-1.md), [2](../sprint-2.md), [Officer/3](../officer-portal.md), [4](../sprint-4.md)), the [withdrawal change](../citizen-withdrawal.md) and the [database operations](../database-operations.md).

## Assessment rubric map (guidelines §17)

| Rubric area (marks) | Where it is evidenced |
| --- | --- |
| Problem definition & process planning (2) | 01, 02 |
| Agile planning & project management (1) | 03, 11, git history |
| Requirements engineering (3) | 04 (FR/NFR, user stories, use cases, MoSCoW, RTM) |
| System design (2) | 05, [architecture](../architecture.md), [database design](../database-design.md), `screens/` |
| Implementation & functionality (4) | 06, `src/`, `supabase/migrations/`, user guide |
| Testing & quality assurance (2) | 07, `supabase/tests/`, `src/**/*.test.ts`, `tests/e2e/`, CI |
| Deployment (2) | 08 *(deployment pending; see status below)* |
| Maintenance / change request (2) | 09 *(lecturer change request pending)* |
| Security (1) | 10 |
| Presentation & individual contribution (1) | 11, user guide, demo script in 08 |

## Honest status (2026-10-29)

| Item | Status |
| --- | --- |
| All Must Have requirements CF-01…CF-14 | Implemented and tested |
| Should Have CF-15…CF-20 | Implemented and tested |
| Could Have CF-21 | Basic read-only monitoring implemented. Enhanced reports are not planned. |
| Scope extension CF-22 (Citizen withdrawal) | Implemented and recorded as an approved change |
| CR-006 (dispatch, auto-assignment, service targets, analytics, map, redesign) | Implemented and tested ([sprint-5.md](../sprint-5.md)). Migration 015 applied to the hosted project on 2026-10-30 after explicit approval, with data checksums unchanged. |
| Hosted database | Migrations 001–014 applied. Sprint 4 migrations 012–014 were applied on 2026-10-29 after explicit approval, with data checksums unchanged (see [sprint-4.md](../sprint-4.md)). |
| Deployment to Vercel | **Not yet deployed.** The configuration and steps are ready in 08. |
| Lecturer maintenance change request | **Not yet received.** The process and template are ready in 09. |
| Contribution log | The template is ready. **Each member must fill in their actual work.** |
