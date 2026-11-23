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
