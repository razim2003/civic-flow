# CF-22: citizen withdrawal

## Authority and behavior

On 2026-10-19 the user explicitly requested that the same Citizen be able to withdraw their complaint with a valid reason. This adds a withdrawal branch to the proposal baseline; it does not alter the original PDF, three actors, exclusions, owners, five sprints or academic milestones. Necessary non-destructive changes on the configured Supabase project are already authorized by the user's subsequent operating instruction recorded in AGENTS.md.

Implementation decision: an active Citizen can withdraw only their own Submitted, Under Review or In Progress complaint. Resolved and Withdrawn are final states. Require a trimmed explanation of 10-2,000 characters and explicit confirmation in the UI. A recorded reason is required; the system does not claim to determine its factual validity or introduce an unrequested approval queue. Typical reasons include an issue already fixed, a duplicate report or an incorrect submission.

Withdrawal changes status to Withdrawn, records actor/time/reason, releases the current assignment and records its previous value in the history event. It retains complaint details, existing history, notifications, private evidence and current read permissions. No deletion or reopening is introduced. Pending/new evidence cannot upload or finalize after withdrawal; already attached evidence remains readable to authorized viewers. Lists, filters, summary counts and the detail page recognize Withdrawn without showing it as the next resolution step.

The protected RPC derives identity from `auth.uid()`, checks the live active Citizen profile, locks actor then owned complaint, checks the expected version, and writes state/history/notification atomically. A stale page must refresh and review the current record. An identical retry with the previous version/reason returns the existing withdrawal without a second event/update; a changed reason or another attempt on a final state is rejected. Direct table mutations remain denied.

## Reviewed remote migrations

Target: Supabase `xapqfnumcpjckhpdyuxz`, the existing CivicFlow project.

1. [007 withdrawn status](../supabase/migrations/20261019000700_withdrawn_status.sql) adds only the enum value and commits it.
2. [008 protected withdrawal](../supabase/migrations/20261019000800_citizen_withdrawal.sql) adds nullable reason/time/actor columns and matching state constraints, extends the event type constraint, requires withdrawal event reasons and exposes the narrowly granted withdrawal RPC.

The enum change is separate because a new enum value cannot be used until its adding transaction commits, per [PostgreSQL ALTER TYPE documentation](https://www.postgresql.org/docs/17/sql-altertype.html). Existing migrations 001-006 are unchanged. Existing complaint statuses/content/versions, history and files are not updated by these migrations. No account/role/Auth changes or destructive cleanup are included.

Reviewed SHA-256: 007 `79409f7efb068f0dac0e40a7bedb67803d05f11ce31fe77bddbb568fc4413006`; 008 `55ec3c9a2826557be934d97e88d0a992121ce87f5c47ceabbe131dd6f2f3a0e5`. The CLI dry run listed exactly these two migrations with no seed/custom-role/Vault changes. Preflight confirmed six applied versions, one real complaint, two history/update records and one attachment. The ignored recovery metadata file `tmp/withdrawal-rollout/before.json` has SHA-256 `ca731374a6f563c6d761bfaed863343477a0e65b9828754c7d170251a4e80583`. It contains schema metadata/counts/checksums, not complaint text or authentication credentials.

Preparation: apply all eight migrations to the disposable embedded database, regenerate database types, run unit/database tests and relevant browser journeys, and capture [read-only baseline metadata](../supabase/operations/snapshot-withdrawal-baseline.sql) into ignored `tmp/withdrawal-rollout/`. The baseline includes constraint/enum/policy definitions, counts and aggregate checksums without returning complaint text or personal details. It is a scoped recovery record, not a full Auth/file/data backup; migration 008 is transactional and changes no existing data. Current schema source remains version-controlled.

Recovery: if 007 succeeds and 008 fails, the unused enum value is harmless; stop, inspect and apply a reviewed corrective migration. Do not remove enum values, rebuild tables, reset the database or delete data. Preserve any later real withdrawals and prefer forward correction. No destructive rollback is authorized. Verify migration history, constraints, function grants/search path, unchanged existing-record checksums and anonymous execution denial after rollout. Use the user's existing normal session for actual withdrawal; do not mutate real complaints as automated test fixtures.

## Validation record

Passed: lint, typecheck, production build, 24 unit tests, 77 embedded PostgreSQL tests and the final integrated 24-test Playwright run. Database types were regenerated from all eight migrations. A duplicate React sibling key and a refresh/submission race discovered by browser tests were fixed; the final run also passed a previously timed-out initial navigation assertion without weakening it. The withdrawn detail screenshot was visually inspected.

The SQL suite covers owner/role/active checks, three permitted source states, required reason bounds, stale versions, both final states, retry idempotency, preserved private evidence, stopped uploads/finalization and rollback on notification failure. Browser journeys cover reason/confirmation, keeping a complaint, successful closure/history/search, stale refresh/retry, lost-response retry and final-state behavior. Database calls use non-privileged roles and fixture identity claims. Browser tests mock Supabase and do not prove actual HTTP/JWT/Storage integration or concurrent database sessions; those local-service checks remain pending the previously documented Docker image prerequisite.

## Applied rollout and verification

The authorized CLI push applied exactly 007-008 on 2026-10-19 with `--skip-vault`; history now records all eight versions. [Read-only verification](../supabase/operations/verify-withdrawal-rollout.sql) confirmed Withdrawn is available, both new constraints are validated, the withdrawal function is SECURITY DEFINER with an empty fixed search path, authenticated execution is granted, anonymous execution is denied and direct browser UPDATE remains denied. All nine application tables retain RLS and evidence remains private.

Read-only post-rollout metadata in ignored `tmp/withdrawal-rollout/after.json` has SHA-256 `5f1c526437f3d13a073371a51c3f016e81b85964b61c50729504ae570ac26490`. Comparing the existing-record checksums and counts with the baseline confirmed the one complaint, two history events, one evidence record and two updates were unchanged. The rollout created no withdrawals, test identities or test complaints. An unauthenticated request to the deployed withdrawal RPC returned HTTP 401 / PostgreSQL 42501 rather than a missing-function response. No real user token/password was requested or used.

The user can now refresh/sign in, open their own unresolved complaint in My Complaints, choose Withdraw complaint, give a reason, confirm, and retain the final record/history. No Git commit/push or Vercel deployment was performed.
