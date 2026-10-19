# Sprint 1 - Foundation & Authentication

Implementation increment authorized by the user on 2026-10-19. Original ownership remains as specified in the proposal and roadmap.

## Implemented source

- React 19, TypeScript, Vite and Tailwind foundation with responsive account screens and role workspaces.
- Citizen registration, login/logout, verification return screen, password reset request and recovery screen using Supabase Auth.
- In-memory sessions, non-blocking Auth subscription, stale-request protection, profile refresh and fail-closed handling for missing/inactive profiles.
- Profile name editing through a bounded RPC. No client-selectable signup role.
- Administrator existing-user listing/search/pagination and access editing, with mandatory active department for Officers and backend last-admin protection.
- Version-controlled foundation tables and role/access functions. Every table starts protected; later complaint-related APIs remain unavailable.
- Type generation from the actual migration schema, unit/embedded PostgreSQL/browser tests, CI and Vercel build/deep-link/header configuration. No deployment was executed.

## Scope and traceability

Primary requirements: CF-01, CF-02, CF-03, CF-14 and the profile part of CF-15. The source provides their implementation. The initial hosted schema and existing-account profile repair were applied on 2026-10-19, with authenticated profile-read verification. Actual browser login and separately authorized Administrator bootstrap remain separate acceptance steps; mocked browser tests alone do not prove them.

Complaint submission, category administration, maps, evidence storage, assignment, status changes, notifications, resolution and feedback remain later increments. No sample complaint totals, dummy user-role selector or fake completed workflow is shown in the live product.

## Verification boundaries

Recorded checks for this increment: lint, TypeScript and production build pass; 7 unit tests, 20 embedded database tests and all 13 browser tests pass (40 total). Browser coverage includes password-change success through an Auth state refresh. Desktop (1440x1000) and mobile (375x812) screenshots were visually reviewed; the browser console reported zero errors and warnings. Build output is split into shared React/Supabase and feature chunks, with no oversized-chunk warning. Manifest/lockfile metadata agrees and the final dependency audit reported zero known vulnerabilities.

Vitest covers input/configuration rules and Auth profile request races. PGlite replays both real migrations into a fresh PostgreSQL engine and tests actual role grants/RLS/RPC execution, with fixture `auth.users` and `auth.uid()`. Playwright intercepts Supabase responses and tests UI integration; it does not prove the hosted RLS configuration. The two suites provide complementary evidence.

Full local Supabase integration, actual recovery email flows, multi-connection concurrency and Vercel-hosted headers remain pending. Docker's engine was initially unavailable; later image downloads stalled during hosted setup. Automated tests do not modify hosted accounts/data. The separately authorized hosted rollout and account repair are recorded in [hosted setup](hosted-setup-2026-10-19.md).

## Next increment

Verify real browser login with the repaired existing account; separately authorize the first-admin bootstrap when its account is identified. Sprint 2 then adds complaint creation, categories, map coordinates and private evidence against the tested backend contracts.
