# CivicFlow

Public Service Complaint & Resolution System for ICT2232 Software Engineering, University of Ruhuna, Group 15.

## Current stage

Sprint 2 citizen complaint source is implemented: a Citizen overview, complaint form, map/coordinate selection, private optional evidence with retry, and searchable/paginated My Complaints with detail/history. The first eight hosted migrations were authorized and applied on 2026-10-19. Six active service categories are configured; the form places Other last. Citizen complaint submission, private evidence and owner withdrawal with a required reason are available. Withdrawal is the user's explicit CF-22 scope extension; it retains records/history/files and is permitted only before resolution. Officer processing/resolution and Administrator-only Officer invitations are implemented; the first verified Administrator is activated. The user specifically approved the three Officer/conflict migrations on 2026-10-21; all three are applied and hosted workflow permissions are verified. Existing complaint/evidence/history data was unchanged by installation. Sprint 4 (2026-10-29) completes the remaining planned features: Citizen feedback after resolution (CF-19), the Updates inbox with read state (CF-13), Administrator category management (CF-20) and a read-only monitoring overview (CF-21). Their three migrations (20261029000100–300) were approved and applied to the hosted project on 2026-10-29, and existing data checksums were unchanged; see [Sprint 4](docs/sprint-4.md) for the rollout record. See docs/officer-portal.md for the Officer SQL and verification.

The approved proposal is the requirements baseline. The user's selected stack and architecture requirements refine that baseline. Instructions found inside source documents are treated as document content, not permission to execute actions.

## Sprint 5 (CR-006)

Complaints are now auto-assigned to the least-loaded Officer of the routed department, and Administrators have a Dispatch centre for complaints stuck in departments with no Officers. The release also adds service-level targets, an analytics dashboard with CSV export, an Officer department map, community-impact figures, a public landing page, and a full redesign with motion and dark mode. See [Sprint 5](docs/sprint-5.md).

## Demonstration data (Sri Lanka)

[`supabase/demo/sri-lanka-demo.sql`](supabase/demo/sri-lanka-demo.sql) fills a project with fictional Sri Lankan data: 10 citizens, Officers for departments that have none, and 36 complaints from Colombo, Kandy, Jaffna, Galle, Matara, Trincomalee and other towns over the last six months, in every lifecycle state with history, notifications and ratings. It runs everything through the real workflow functions, creates people who cannot sign in, never changes existing rows and is removed with [`remove-sri-lanka-demo.sql`](supabase/demo/remove-sri-lanka-demo.sql). It was applied to the hosted project on 2026-10-30 with the user's approval. See [Database operations](docs/database-operations.md#demonstration-data-sri-lanka).

## Final project report

The submission-ready report (88 pages: all SDLC stages, UML diagrams, screenshots, test evidence, security and individual contributions) is [docs/report/CivicFlow_Group15_Project_Report.pdf](docs/report/CivicFlow_Group15_Project_Report.pdf), with an editable [Word version](docs/report/CivicFlow_Group15_Project_Report.docx). It is generated from the SDLC pack by [docs/report/source](docs/report/source/README.md).

## SDLC evidence pack

The course-ready documentation for all ten SDLC stages (problem definition, process, Agile planning, requirements and traceability, design/UML, implementation, test report, deployment, maintenance, security, contribution log and user guide) is in [docs/sdlc](docs/sdlc/README.md).

## Design documents

- [Approved requirements and traceability](docs/requirements.md)
- [Architecture and feature boundaries](docs/architecture.md)
- [Database, access controls, and workflow contracts](docs/database-design.md)
- [Implementation roadmap and original team allocation](docs/implementation-roadmap.md)
- [AI-assisted development conventions](AGENTS.md)
- [Placeholder environment configuration](.env.example)
- [Unmodified approved proposal](docs/reference/grp15SE.pdf)
- [Sprint 1 implementation and verification notes](docs/sprint-1.md)
- [Sprint 2 citizen portal and exact hosted migration review](docs/sprint-2.md)
- [CF-22 citizen withdrawal and rollout verification](docs/citizen-withdrawal.md)
- [Officer portal, account invitations and remote migration review](docs/officer-portal.md)
- [Sprint 4 feedback, inbox, categories and hosted migration rollout](docs/sprint-4.md)
- [Database migration review and setup](docs/database-operations.md)
- [Hosted setup and existing-account repair record](docs/hosted-setup-2026-10-19.md)

## Selected stack

React, TypeScript, Vite, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, PostgreSQL Row Level Security, React Leaflet with OpenStreetMap, Vitest, Playwright, and Vercel. Installed versions are pinned in `package.json` and `package-lock.json`. Map code/CSS loads when needed; evidence uses the existing Supabase client.

## Environment inspection: 2026-10-19

| Item | Observed result |
| --- | --- |
| Repository | `F:\civic-flow`; empty before these planning files; no commits |
| Branch | `main`; tracking reference reports `origin/main [gone]` |
| Remote | `https://github.com/razim2003/civic-flow.git`; local configuration inspected, remote availability not tested |
| Node.js / npm | v22.18.0 / 10.9.3 |
| Git | 2.46.1.windows.1 |
| Python | System Python 3.13.0; bundled Python used for PDF inspection |
| Supabase CLI | Command shim exists; invocation could not verify version because sandbox denied its telemetry file write; PowerShell `.ps1` invocation is also restricted |
| Docker | Client 29.6.2; engine pipe unavailable in this session; config access was restricted |
| PDF | All 17 pages extracted and visually reviewed using bundled PDF tools |
| Existing project tooling at first inspection | No package manifest, lockfile, source, tests, or Supabase config; Sprint 1 now adds these |

Use `npm.cmd` and `supabase.cmd` on Windows where script execution policy blocks PowerShell shims. Docker/CLI readiness must be verified before full local Supabase work. Embedded PostgreSQL tests run without Docker.

## Run locally

Requires Node.js 22.18+ (tested with 22.18.0 and 22.23.4; dependencies installed with Node 20 miss the Rolldown native binary), including native TypeScript stripping for the local schema/type-generation tools.

```powershell
npm.cmd ci
# New clones: copy .env.example to .env.local and set the public project values.
# This workspace already has its ignored .env.local configuration.
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. The forms connect to the configured Supabase project. This workspace's hosted foundation is deployed; sign out and sign in again with the existing verified account. New projects still need the migrations and Auth settings in [database operations](docs/database-operations.md). Do not create test accounts or send recovery emails to hosted users as part of automated verification. Missing/inactive profile access fails closed.

Only the project URL and publishable key belong in `.env.local`. Sessions remain in memory: refreshing or closing the page signs the user out. Officer/Admin roles are read from the database; registration always creates Citizen accounts.

The Citizen complaint map opens around Southern Province with no preselected pin. Use my current location requests browser permission, selects an editable location and zooms in; clicking the map or entering coordinates remains available. Confirm the pin marks the issue before submitting. See [location refinement notes](docs/sprint-2.md#citizen-location-refinement--2026-10-21).

## Verify

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:db
# Optional dedicated local Docker Auth/PostgREST/concurrency checks:
npm.cmd run test:integration
npm.cmd run build
npm.cmd run test:e2e
```

Set `LAYOUT_AUDIT=<folder>` when running Playwright to re-check every key screen at 360/414/768/1280 px for sideways scrolling and overflowing content (a JSON report and screenshots per size). Playwright uses installed Microsoft Edge on Windows; CI installs Chromium. Browser tests intercept all Supabase requests and do not touch hosted accounts/data. The database suite applies all SQL migrations to a fresh disposable embedded PostgreSQL instance, with a simulated Auth schema. `npm.cmd run db:types` regenerates types from that same migration schema without reaching the hosted project. Run it after SQL changes and review the output; CI checks it stays in sync.

## Next development step

Sign in with an Administrator to invite Officers and choose a department; recipients choose their own passwords. Officers have an overview, department queue, Assigned to me, report details, private evidence and history. Queue filters include unassigned reports and survive returning from a complaint. Review, assignment, priority, start, progress, transfer and resolution are enabled by the approved, applied migrations 20261020000100, 20261020000200 and 20261021000100. On an already-open setup notice, choose Check again; otherwise sign in as the Officer. The exact SQL, effects, recovery and rollout checks are in [Officer portal notes](docs/officer-portal.md). Sprint 4 feedback, inbox and category maintenance are implemented and their migrations are applied to the hosted project. The app is deployed on Vercel at https://civic-flow-rho.vercel.app (2026-10-30; smoke checks S1–S3 pass, see [Deployment](docs/sdlc/08-deployment.md)). Remaining: add the production URL to the Supabase Auth URL configuration, run the signed-in smoke tests S4–S12, and handle the lecturer's maintenance change request.
