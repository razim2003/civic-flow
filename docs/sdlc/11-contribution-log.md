# Team contribution log

> **Action for the team:** guidelines §13 require a log of the work **actually completed** by each member, supported by version-control evidence, and every member must be able to explain their part in the viva. The planned allocation below comes from the proposal. Each member must fill in their own rows truthfully. Don't copy the planned allocation as if it were completed work.

## 13.1 Planned allocation (proposal §4.5)

| Member | Main area | Planned responsibilities |
| --- | --- | --- |
| TG/2023/1731 | Requirements & Citizen Module | Stakeholder analysis, requirements, user stories, citizen registration, login, profile, complaint submission |
| TG/2023/1710 | Complaint Management Module | Categories, complaint details, evidence upload, assignment, priority |
| TG/2023/1757 | Officer Module | Officer dashboard, review, status updates, progress remarks, resolution |
| TG/2023/1761 | Admin & Database | Database/ER design, user management, category management, admin dashboard, DB integration |
| TG/2023/1776 | Quality, Security & Deployment | Test planning, system/integration testing, security controls, error handling, deployment, maintenance change request |

## 13.2 Contribution log (to be completed by each member)

Add one row per significant task. "Evidence" must point to something checkable: a commit hash, a pull request, a file or test name, a document section or meeting notes.

| Date | Member | SDLC stage | Task completed | Evidence | Hours (approx.) |
| --- | --- | --- | --- | --- | --- |
| | TG/2023/1731 | Requirements | | | |
| | TG/2023/1731 | Implementation | | | |
| | TG/2023/1710 | Design | | | |
| | TG/2023/1710 | Implementation | | | |
| | TG/2023/1757 | Implementation | | | |
| | TG/2023/1757 | Testing | | | |
| | TG/2023/1761 | Design (ER / DB) | | | |
| | TG/2023/1761 | Implementation | | | |
| | TG/2023/1776 | Testing | | | |
| | TG/2023/1776 | Security / Deployment | | | |

## 13.3 Version-control evidence

Repository: [github.com/razim2003/civic-flow](https://github.com/razim2003/civic-flow). The history at the time of writing:

| Commit | Author (Git identity) | Date | Summary |
| --- | --- | --- | --- |
| `88f85f2` | razim2003 | 2026-10-19 | Initial phase (Sprint 1 foundation and authentication) |
| `0c74184` | razim2003 | 2026-10-19 | Complaint submission and viewing (Sprint 2) |
| `a576dac` | razim2003 | 2026-10-21 | Officer processing, withdrawal, location refinements (Sprint 2–3) |
| `d751c3a` | Mohamed Sharfan | 2026-10-29 | Sprint 4: feedback, notification inbox, category management, monitoring |
| *(this commit)* | Mohamed Sharfan | 2026-10-29 | SDLC evidence pack and Sprint 4 records |

Note for the viva: a Git identity shows who **pushed** a commit, not necessarily who designed or wrote each part. Where several members worked together on one machine, record each person's part in §13.2 and cite the files they owned.

Useful commands for collecting evidence:

```bash
git log --format="%h %an %ad %s" --date=short
git shortlog -sn
git log --stat --author="<name>"
```

## 13.4 Viva preparation checklist (each member)

- [ ] I can explain the requirements and user stories of my module and their CF IDs.
- [ ] I can open my module's code and explain its ui/application/model/data layers.
- [ ] I can explain the database rule (RLS policy or RPC) that protects my module.
- [ ] I can run and explain at least two tests for my module (one positive, one negative).
- [ ] I know which defects affected my module and how they were fixed (07 §7.5).
