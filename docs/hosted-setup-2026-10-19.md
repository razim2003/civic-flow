# Hosted setup and existing-account repair

## Authorization and target

The user explicitly authorized applying CivicFlow's database setup and repairing the existing account after its email-confirmed login could not load `public.profiles`.

Target: `xapqfnumcpjckhpdyuxz`, the configured CivicFlow project. Supabase CLI 2.114.0 authenticated successfully. No database password, secret API key or user password was requested in chat or written to tracked files. No Administrator promotion was performed.

## Baseline and recovery scope

Read-only preflight found no application relations, functions, enum types, migration history or Auth application triggers, and exactly one verified Auth account. The GitHub connection had not applied the initial migrations.

The standard Docker-based `pg_dump` and a local Supabase service startup were attempted. Image downloads stalled, and those helper processes were stopped. The rollout therefore used a scoped management-API snapshot of the empty application schema, namespace ACLs, default privileges and account counts. This is not an Auth data backup or a full database dump. No pre-existing application data existed to export, and the rollout did not modify the Auth account.

The ignored local snapshot is `tmp/db-setup/pre-migration-schema-baseline.json` (2618 bytes), SHA-256 `8a68d83c4ee772965cb7cc41e5b2de99c7a0c15fad2801597a3beb581e9ba225`. Its capture query is versioned in `supabase/operations/snapshot-empty-schema.sql`; it includes the original public-schema privilege statements and contains no account details or credentials.

Recovery must preserve Auth identities and any subsequent application data. Prefer a corrective migration; inspect the snapshot for the original privilege state. A reset, dropping newly created objects, or destructive rollback requires separate approval. No automatic destructive rollback was performed or approved.

## Applied changes

1. `20261019000100_foundation.sql`: tables, constraints, indexes, default-deny grants/RLS and Citizen-only signup trigger.
2. `20261019000200_auth_and_administration.sql`: profile/lookup read policies and protected profile/admin functions.
3. `20261019000300_backfill_existing_profiles.sql`: creates missing non-anonymous profiles as active Citizens; existing profiles/roles are unchanged; refreshes PostgREST metadata.

The CLI dry run listed exactly these three migrations, with no seeds, custom roles or Vault changes. The actual push used the explicit project reference and `--skip-vault`. The original two migrations were not edited.

## Verification

- All 26 local database tests passed, including six tests of existing-account repair, role/activation preservation, anonymous-account exclusion and replay safety.
- Lint and TypeScript checks passed. No frontend behavior was changed by this repair.
- Hosted migration history records all three versions.
- The verified account can read exactly one active own profile under the deployed `authenticated` role.
- The profiles REST endpoint is now present and returns HTTP 401 / PostgreSQL `42501` to an unauthenticated zero-row request, rather than `PGRST205` missing-table.
- Read-only verification operations are saved in `supabase/operations/inspect-hosted.sql` and `verify-hosted.sql`.

The user's actual password/login session was not accessed. Sign out and sign in again to verify the complete browser login with the existing verified account. Hosted Auth settings and the first-Administrator bootstrap were not changed by this rollout. Full local Supabase-service validation remains pending completion of the Docker image downloads.

## Repository synchronization

The new repair migration, regression tests, operations queries and this record are local changes. They were not committed or pushed: the user authorized database setup, and repository conventions require a separate instruction to commit/push. Include these files in the next reviewed commit so GitHub retains the complete applied migration history.
