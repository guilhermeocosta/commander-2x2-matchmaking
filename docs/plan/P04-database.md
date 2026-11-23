# P04 · Database

## Goal

The Drizzle schema, migrations and a thin data-access layer for events, players, rounds, tables, seats and the audit log, plus a seed script that creates a fake event.

## Depends on

P01 (needs `DATABASE_URL`).

## Read first

- [docs/architecture.md](../architecture.md): Data model.
- [docs/rules.md](../rules.md) for the meaning of each field.
- `src/core/types.ts` if P02 is done (map rows into those types).

## Scope

### In

- Add `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`.
- `src/db/schema.ts` matching the architecture doc (enums as Postgres enums or checked text), foreign keys, unique `(event_id, number)` for rounds, unique `code` for events.
- `src/db/index.ts`: the client (`DATABASE_URL`), server-only.
- `src/db/queries.ts`: typed functions used by later steps (`getEventByCode`, `listEvents`, `createEvent`, `addEventPlayer`, `getRoundState`, `writeAudit`, …). Keep them small; later steps add more.
- Migrations in `src/db/migrations/`, scripts `db:generate`, `db:migrate`.
- `scripts/seed.ts` (`pnpm db:seed`): creates an event with 13 players, idempotent by event code `TEST`.
- Update `.env.example` and `docs/architecture.md` if the schema differs from the plan.

### Out

- Any UI or route. Business rules (they live in `src/core`).

## Deliverables

- Schema, client, queries, migrations, seed script, package scripts.

## Acceptance checks

- `pnpm check` green.
- `pnpm db:migrate` applies cleanly to an empty Neon branch; running it twice is a no-op.
- `pnpm db:seed` creates the `TEST` event; running it twice doesn't duplicate.
- `/api/health` still returns `db: "up"`.

## Notes

- Use a separate Neon branch for development if available on the free plan; never seed production.
- How migrations run on Vercel deploys: document the chosen approach (manual `db:migrate` before deploy is fine for Phase 0).

## Log

- 2026-11-22: Started on `step/P04-database` from `main`.
- 2026-11-22: Built the schema, client, queries, migration and seed; `pnpm check` and `pnpm security` are green; `db:migrate`/`db:seed` not yet run against a database. Decisions:
  - Deps (exact pins, all older than 3 days): `drizzle-orm@0.45.4`, `zod@4.6.7`, `drizzle-kit@0.31.11` (dev). `pnpm-workspace.yaml`: `esbuild: false` in `allowBuilds` (keeps its postinstall blocked; strict builds failed without an entry) and an `esbuild@<0.25.0` → `0.25.12` override for GHSA-67mh-4wv8-2f99 (drizzle-kit → `@esbuild-kit/core-utils`, dev only).
  - Schema follows the architecture doc, with these changes (doc updated): `device_token` → `device_token_hash` (SHA-256 of the cookie token, so a leaked row can't impersonate a player); `seats.round_id` with a composite FK to `tables (id, round_id)` so a player sits at most once per round; `created_at` on players and rounds; unique `(event_id, roster_id)` and `(round_id, number)`; check constraints (4-char `A-Z0-9` code, positions, games only on 1v1). Seats don't cascade from players, so a player who has played can't be deleted on their own.
  - Client: `getDb()` in `src/db/index.ts` wraps `getSql()` from `src/lib/db.ts` with Drizzle on Neon HTTP. No interactive transactions on HTTP: later steps use `db.batch`. Row → core mapping lives in `src/db/mappers.ts` (pure, tested with `pairingHistory`); `getRoundRecords` returns `RoundRecord[]`.
  - Scripts run with Node 26's TypeScript support (no `tsx`): `db:migrate` uses the WebSocket driver so all pending migrations apply in one transaction; `db:seed` runs with `--conditions=react-server` so `server-only` resolves. Both load `.env.local` via `--env-file-if-exists` and refuse `VERCEL_ENV=production`. Relative imports in `src/db` use `.ts` extensions (`allowImportingTsExtensions` in `tsconfig.json`). `src/db/migrations` is in `.prettierignore` so generated files stay as drizzle-kit writes them.
  - Deploys: migrations run by hand before merging a PR that adds one (documented in `docs/architecture.md`).
  - Follow-ups: P05 generates event codes and wraps `createEvent` in a Server Action; P06 hashes device tokens (`getEventPlayerByTokenHash`); P07 adds a `saveDraftRound` write with `db.batch` and `toSeatRows`.
- 2026-11-22: **Blocked** on the organizer: there is no `.env.local` with a development `DATABASE_URL` in the worktree, so `pnpm db:migrate` / `pnpm db:seed` (and the "twice is a no-op" checks) haven't run. To unblock: create a Neon dev branch, put its connection string in `.env.local` as `DATABASE_URL`, run `pnpm db:migrate` twice and `pnpm db:seed` twice, and check `/api/health`. Then set P04 to `review`.
- 2026-11-22: Unblocked: the organizer created a Neon `dev` branch and put its connection string in the worktree's `.env.local`. Organizer's runs: `pnpm db:migrate` twice ("up to date" both times; the first applied `0000_init`, the second was a no-op) and `pnpm db:seed` twice ("event TEST ready with 13 players (13 added)", then "(0 added)"). With `pnpm dev` on that branch, `GET /api/health` returned HTTP 200 `{"ok":true,"db":"up"}`. Every acceptance check passes; status set to `review`. Before merge, production needs `pnpm db:migrate` with its own connection string (never `db:seed`).
