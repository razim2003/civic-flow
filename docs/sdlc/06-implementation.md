# Stage 6 – Implementation

## 6.1 Technology stack (as built)

| Layer | Technology (pinned in `package.json`) |
| --- | --- |
| UI | React 19, React Router 7, Tailwind CSS 4, lucide-react icons |
| Language / build | TypeScript 6 (strict), Vite 8 (Rolldown) |
| Validation | Zod 4 (client); SQL CHECK constraints and RPC validation (server) |
| Maps | Leaflet 1.9 + React Leaflet 5, OpenStreetMap tiles |
| Backend | Supabase: PostgreSQL 17, Auth, Storage, one Deno Edge Function |
| Tests | Vitest 5 (unit), PGlite (embedded PostgreSQL for database tests), Playwright (browser) |
| CI / hosting | GitHub Actions; Vercel configuration (`vercel.json`) |

## 6.2 Module map

| Module | Path | Responsibility | Requirements |
| --- | --- | --- | --- |
| App shell | `src/app/App.tsx` | Routes, role navigation, protected layout, unread badge | CF-02, CF-03 |
| Auth | `src/features/auth` | Register, login/logout, recovery, invitation password, session/profile loading | CF-01–03 |
| Profiles | `src/features/profiles` | Own display name | CF-15 |
| Complaints | `src/features/complaints` | Form, submission, list, detail, withdrawal | CF-04–07, 17, 18, 22 |
| Evidence | `src/features/evidence` | Private reserve → upload → finalize, download | CF-16 |
| Officer | `src/features/officer` | Queues, filters, review/assign/priority/start/progress/transfer/resolve | CF-08–12, 17 |
| Feedback | `src/features/feedback` | Post-resolution rating | CF-19 |
| Notifications | `src/features/notifications` | Updates inbox, read state, unread badge | CF-13 |
| Categories | `src/features/categories` | Admin category maintenance | CF-20 |
| Admin | `src/features/admin` | User management, Officer invitation, monitoring overview | CF-14, 21 |
| Shared | `src/shared` | One Supabase client, environment validation, errors, location, UI primitives | — |
| Database | `supabase/migrations` (14 files) | Schema, RLS, RPCs, Storage policies | All |
| Edge Function | `supabase/functions/provision-officer` | Admin-only Officer invitation using the Auth Admin API | CF-14 |

Each feature follows **ui → application → model / data**. Only `data/` files call Supabase. The [architecture](../architecture.md#layers-and-ownership) explains why.

## 6.3 Coding standards applied

- Strict TypeScript, no `any`. Database types are **generated** from the migrations (`npm run db:types`), and CI fails if they drift.
- ESLint with zero warnings allowed (`npm run lint -- --max-warnings 0`).
- Naming: snake_case in SQL; camelCase/PascalCase in TypeScript; feature folders named after the domain.
- SQL functions: `SECURITY DEFINER` with `set search_path=''`, fully-qualified names, explicit EXECUTE grants to `authenticated` only, and stable error codes (`not_authorized`, `invalid_input`, `stale_version`, …).
- No string-built HTML. All user text is rendered through React text nodes.
- Small public interfaces (`index.ts`) between features.

## 6.4 Input validation (two layers)

| Field | Client rule (Zod) | Database rule |
| --- | --- | --- |
| Complaint description | trimmed, 10–5,000 | CHECK + RPC check |
| Location text | trimmed, 1–300 | CHECK + RPC check |
| Coordinates | finite, lat −90…90, lon −180…180 | CHECK + RPC check |
| Withdrawal reason | trimmed, 10–2,000, confirmation | RPC check + table constraint |
| Progress remark / resolution | 1–2,000 / 10–5,000 | RPC checks + CHECK |
| Evidence | JPEG/PNG/PDF magic bytes, ≤ 5 MiB, ≤ 5 files | Declared type/size CHECK, bucket MIME/size limits, quota under lock, stored metadata verified at finalize |
| Feedback | integer 1–5, comment ≤ 2,000 | RPC check + CHECK |
| Category | name 1–100, description ≤ 500, department required | RPC check + CHECK + unique name |
| Password | ≥ 12 characters at registration | Supabase Auth minimum length 12 |

The client rules give immediate feedback. The database rules are authoritative. Tests assert both (see [test report](07-test-report.md)).

## 6.5 Error handling

- Database functions raise **stable codes**. `shared/errors/message.ts`, `complaintMessage.ts` and feature-specific translators (`feedbackMessage`, `categoryMessage`, `workflowMessage`) turn them into plain-language messages. Unknown errors show a generic message and never expose server details.
- **Stale writes** (HTTP 409 / `PT409`) keep the user's input and ask them to refresh. They are never retried automatically.
- **Lost responses** on create/withdraw are safe to retry because of idempotency keys or identical-retry detection.
- **Partial failures** are reported honestly. For example, "Your complaint is saved, but the file has not uploaded" includes a Retry button.
- **Missing setup** (a hosted migration not applied, `PGRST202`) shows an explanatory notice instead of a crash. Authorisation errors still fail closed.
- Shared resource hooks ignore late responses after navigation or sign-out (`useResource`).

## 6.6 Integration of major modules

The end-to-end workflow crosses five modules: the Citizen submits (complaints), attaches evidence (evidence), the Officer processes (officer), the Citizen is notified (notifications) and gives feedback (feedback), and the Administrator monitors and maintains categories (admin, categories). These modules don't call each other's internals. They integrate through:

1. **Shared database contracts.** Every RPC writes the history event and notification that the Citizen-side modules read.
2. **Public feature interfaces.** For example, the complaint detail page renders `EvidencePanel` and `FeedbackPanel`, and the Officer page reuses `ComplaintDetailPage` through a render slot.

## 6.7 Version control

- Repository: [github.com/razim2003/civic-flow](https://github.com/razim2003/civic-flow), default branch `main`.
- Work is committed in reviewable increments, one per sprint deliverable. From Sprint 4, features are developed on a branch (for example `sprint-4/feedback-inbox-categories`) and merged into `main`.
- CI (`.github/workflows/ci.yml`) runs on every push and pull request. A red build blocks claiming an increment as done.
- Applied migrations are never edited. Fixes are new migrations (for example `20261021000100_non_retrying_withdrawal_conflict.sql` corrected the conflict code from migration 008).
- Secrets are never committed: `.env*` is ignored and `.env.example` holds placeholders only.

## 6.8 How to run locally

See [08-deployment.md §8.4](08-deployment.md#84-local-installation) and the project [README](../../README.md).
