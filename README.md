# CivicFlow

CivicFlow is a public-service complaint and resolution system built for the ICT2232 Software Engineering project at the University of Ruhuna by Group 15. It gives citizens a way to report local service issues and follow their progress, while giving public-service teams tools to process and resolve complaints.

## What it does

CivicFlow provides role-based workspaces for:

- **Citizens** — create an account, submit complaints with a category and map location, optionally attach evidence, track status and history, receive updates, provide feedback after resolution, and withdraw an unresolved complaint.
- **Officers** — view department and personal queues, review and assign complaints, set priority, update progress, transfer eligible complaints, and record resolutions.
- **Administrators** — invite Officers, manage user access and service categories, monitor service activity, dispatch complaints, and review analytics.

The application also supports private complaint evidence, complaint notifications, service-level targets, CSV analytics export, and department complaint maps. For step-by-step instructions, see the [CivicFlow user guide](docs/sdlc/user-guide.md).

## Technology

- React 19 and TypeScript
- Vite
- Tailwind CSS
- Supabase Auth, PostgreSQL, and private Storage
- PostgreSQL row-level security and database functions for protected operations
- React Leaflet and OpenStreetMap
- Vitest and Playwright
- Vercel deployment configuration

## Requirements

- Node.js **22.18 or later**
- npm
- A Supabase project configured for CivicFlow, or a local Supabase environment

The frontend connects directly to Supabase; starting Vite does not start the database or other backend services.

## Run locally

From the project directory:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
```

Edit `.env.local` and set the Supabase project URL and **publishable** key:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Then start the development server:

```powershell
npm.cmd run dev
```

Open the address printed by Vite (by default, `http://127.0.0.1:5173`). If PowerShell blocks npm scripts, use `npm.cmd` as shown above.

Only the Supabase URL and publishable key belong in frontend environment variables. **Never** put a Supabase secret/service-role key, database password, or other privileged credential in a `VITE_*` variable or commit it to source control. The app keeps the session in memory, so refreshing or closing the tab signs the user out.

### Database setup

A working Supabase project needs CivicFlow's reviewed database migrations, Auth settings, and (for Officer invitations) the required backend configuration. Before applying migrations to any shared or hosted project, read [Database operations](docs/database-operations.md) and the [database design](docs/database-design.md). The Supabase project configuration is in `supabase/config.toml`.

## Useful commands

Run these from the project directory:

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start the Vite development server |
| `npm.cmd run build` | Type-check and create the production build in `dist/` |
| `npm.cmd run preview` | Preview the production build locally |
| `npm.cmd run lint` | Run ESLint |
| `npm.cmd run typecheck` | Type-check the application and functions |
| `npm.cmd run test` | Run unit tests |
| `npm.cmd run test:db` | Run database tests |
| `npm.cmd run test:integration` | Run the local PostgreSQL HTTP integration checks |
| `npm.cmd run test:e2e` | Run Playwright end-to-end tests |
| `npm.cmd run db:types` | Regenerate database types from the local migration schema |

Database integration checks require the local services and tooling described in the project documentation. Do not run database setup or migration commands against a hosted project without reviewing the target and approved procedures first.

## Project layout

```text
src/
  app/                 Application shell, routes, and shared providers
  features/            Auth, complaints, officer, admin, and related workflows
  shared/              Shared UI, location, and application utilities
supabase/
  migrations/          Versioned database schema and workflow changes
  functions/           Supabase Edge Functions
  tests/               Database tests
docs/                  Requirements, design, operations, and user documentation
tests/                 End-to-end tests
```

## Documentation

- [User guide](docs/sdlc/user-guide.md)
- [Architecture](docs/architecture.md)
- [Requirements](docs/requirements.md)
- [Database design](docs/database-design.md)
- [Database operations and setup](docs/database-operations.md)
- [Deployment guide](docs/sdlc/08-deployment.md)
- [SDLC documentation pack](docs/sdlc/README.md)

## Project context

This project was developed for the ICT2232 Software Engineering course at the University of Ruhuna. The application uses fictional demonstration data where applicable; demo records are not real citizens or complaints.
