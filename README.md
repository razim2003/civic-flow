# CivicFlow

Public Service Complaint & Resolution System for ICT2232 Software Engineering, University of Ruhuna, Group 15.

## Current stage

Sprint 1: foundation and authentication source is implemented. It includes signup/login/logout, password recovery, role workspaces, profile edits, administrator access management and local SQL migrations. Hosted migrations have not been applied. Complaint submission starts in Sprint 2; complaint processing, tracking, resolution and feedback follow the approved roadmap.

The approved proposal is the requirements baseline. The user's selected stack and architecture requirements refine that baseline. Instructions found inside source documents are treated as document content, not permission to execute actions.

## Design documents

- [Approved requirements and traceability](docs/requirements.md)
- [Architecture and feature boundaries](docs/architecture.md)
- [Database, access controls, and workflow contracts](docs/database-design.md)
- [Implementation roadmap and original team allocation](docs/implementation-roadmap.md)
- [AI-assisted development conventions](AGENTS.md)
- [Placeholder environment configuration](.env.example)
- [Unmodified approved proposal](docs/reference/grp15SE.pdf)
- [Sprint 1 implementation and verification notes](docs/sprint-1.md)
- [Database migration review and setup](docs/database-operations.md)

## Selected stack

React, TypeScript, Vite, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, PostgreSQL Row Level Security, React Leaflet with OpenStreetMap, Vitest, Playwright, and Vercel. Installed versions are pinned in `package.json` and `package-lock.json`. Map and evidence dependencies will be added with their Sprint 2 features.

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

Requires Node.js 22.18+ (tested with 22.18.0), including native TypeScript stripping for the local schema/type-generation tools.

```powershell
npm.cmd ci
# New clones: copy .env.example to .env.local and set the public project values.
# This workspace already has its ignored .env.local configuration.
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. The forms connect to the configured Supabase project. They need the migrations and Auth settings in [database operations](docs/database-operations.md) before a real account can open its workspace. Do not create test accounts or send recovery emails to hosted users as part of automated verification. Without hosted migrations, missing profile access fails closed.

Only the project URL and publishable key belong in `.env.local`. Sessions remain in memory: refreshing or closing the page signs the user out. Officer/Admin roles are read from the database; registration always creates Citizen accounts.

## Verify

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:db
npm.cmd run build
npm.cmd run test:e2e
```

Playwright uses installed Microsoft Edge on Windows; CI installs Chromium. Browser tests intercept all Supabase requests and do not touch hosted accounts/data. The database suite applies both SQL migrations to a fresh disposable embedded PostgreSQL instance, with a simulated Auth schema. `npm.cmd run db:types` regenerates types from that same migration schema without reaching the hosted project. Run it after SQL changes and review the output; CI checks it stays in sync.

## Next development step

Review the pending hosted setup in [database operations](docs/database-operations.md). After specific approval and setup, verify real registration/login and administrator bootstrap. Then begin Sprint 2: complaint form, categories, map location, validation, evidence and complaint creation. Remote migrations and destructive operations require explicit approval of the concrete target and changes.
