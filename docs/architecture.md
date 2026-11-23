# Architecture

Phase 0 is a single Next.js app on Vercel with a Postgres database on Neon. There is no separate API server: pages are Server Components, mutations are Server Actions, and live views poll one JSON endpoint.

Sections marked **(planned)** describe what later steps build. Update them when a step changes the design.

## Stack

| Layer      | Choice                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Server Actions), React 19, TypeScript                                                                                   |
| Styling    | Tailwind v4 + daisyUI 5, one dark theme (`c2x2-dark`)                                                                                           |
| Database   | Neon Postgres via `@neondatabase/serverless`, Drizzle ORM + drizzle-kit                                                                         |
| Validation | Zod (data-access inputs from P04; every Server Action from P05)                                                                                 |
| Tests      | Vitest, for `src/core/`                                                                                                                         |
| Hosting    | Vercel Hobby; preview deploy per PR                                                                                                             |
| Domain     | `matchmaking.commander2x2.org` (Cloudflare DNS, CNAME to Vercel, DNS only)                                                                      |
| Tooling    | pnpm, ESLint, Prettier, markdownlint, GitHub Actions CI, Renovate                                                                               |
| Security   | gitleaks, `pnpm audit`, osv-scanner (vulnerabilities + malware) in CI and weekly; pnpm supply-chain settings; see [SECURITY.md](../SECURITY.md) |

## Environment variables

| Name             | Used by | Notes                                                   |
| ---------------- | ------- | ------------------------------------------------------- |
| `DATABASE_URL`   | P01+    | Injected by the Neon integration on Vercel              |
| `ADMIN_PASSWORD` | P05+    | The organizer's password for `/admin`                   |
| `SESSION_SECRET` | P05+    | Random 32+ chars; signs admin and player cookies (HMAC) |

## Folder layout (planned)

```text
src/
  core/        pure domain logic + tests (no Next/React/DB imports)
    rng.ts         seeded PRNG
    results.ts     table outcome, 1v1 MTR result, bye
    standings.ts   points, opponents' match-win %, tiebreak
    pairing.ts     layout, bye/1v1, seating search, warnings
    export.ts      leaderboard.json export
  db/          Drizzle schema, client, queries, migrations, seed script
  lib/         auth (admin cookie), player device token, roster fetch
  app/         routes (below)
```

## Routes (planned)

| Route                           | Who     | What                                                              |
| ------------------------------- | ------- | ----------------------------------------------------------------- |
| `/`                             | anyone  | Enter an event code                                               |
| `/e/[code]`                     | player  | Join, then: my seat, timer, report result, standings              |
| `/e/[code]/display`             | anyone  | Projector: pairings in large type + timer                         |
| `/api/e/[code]/state`           | clients | JSON snapshot for polling (`no-store`, includes server `now`)     |
| `/admin/login`                  | admin   | Password login                                                    |
| `/admin`                        | admin   | Event list, create event                                          |
| `/admin/e/[code]`               | admin   | Control panel: players, rounds, timer, results, standings, export |
| `/admin/e/[code]/print/[round]` | admin   | Printable pairings for one round                                  |

## Data model

Defined in `src/db/schema.ts`; migrations in `src/db/migrations/`. Every id is a `uuid` (except `audit_log.id`, an identity), every timestamp is `timestamptz`, and enums are Postgres enums whose values match `src/core/types.ts`.

| Table           | Columns                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`        | `id`, `code` (unique, 4 × `A-Z0-9`), `name`, `date`, `status` (`open` \| `running` \| `finished`), `rounds`, `round_duration_sec` (default 3000), `seed`, `created_at`                                          |
| `event_players` | `id`, `event_id`, `display_name`, `roster_id?`, `device_token_hash?` (unique), `joined_round` (default 1), `dropped_after_round?`, `created_at`                                                                 |
| `rounds`        | `id`, `event_id`, `number`, `status` (`draft` \| `published` \| `running` \| `paused` \| `overtime` \| `closed`), `seed`, `started_at?`, `paused_at?`, `elapsed_before_pause_sec`, `duration_sec`, `created_at` |
| `tables`        | `id`, `round_id`, `number`, `kind` (`2v2` \| `1v1` \| `bye`), `outcome?` (`A` \| `B` \| `draw`), `games_a?`, `games_b?`, `reported_by?`, `reported_at?`, `overridden`                                           |
| `seats`         | `table_id`, `round_id`, `event_player_id`, `team` (`A` \| `B`), `position` (1 \| 2)                                                                                                                             |
| `audit_log`     | `id`, `event_id?`, `actor`, `action`, `payload` (jsonb), `at`                                                                                                                                                   |

Constraints worth knowing:

- Unique: `events.code`; `(event_id, number)` for rounds; `(round_id, number)` for tables; `(event_id, roster_id)` for players (a season player joins an event once).
- `seats` has primary key `(table_id, team, position)` and carries the table's `round_id` through a composite foreign key to `tables (id, round_id)`, so `(round_id, event_player_id)` is unique: a player sits at most once per round.
- Deleting an event cascades to its players, rounds, tables, seats and audit entries. A player who has sat at a table can't be deleted on their own (`seats.event_player_id` has no cascade). Deleting a reporting player sets `tables.reported_by` to null.
- Checks: positive round and table numbers, positions 1 or 2, non-negative games, and games only on a `1v1` table.
- Device tokens are stored only as a SHA-256 hash (`device_token_hash`); the token itself lives only in the player's cookie.

### Data access

- `src/db/index.ts`: `getDb()`, the Drizzle client on the Neon HTTP driver, built on `getSql()` from `src/lib/db.ts`. Neon HTTP has no interactive transactions: use `db.batch([...])` for writes that must land together.
- `src/db/queries.ts`: small typed functions (`getEventByCode`, `listEvents`, `createEvent`, `listEventPlayers`, `addEventPlayer`, `getEventPlayerByTokenHash`, `getRoundState`, `getLatestRound`, `getRoundRecords`, `writeAudit`) and the Zod schemas for their inputs. `getRoundRecords` returns `RoundRecord[]` for `standings` and `pairingHistory`.
- `src/db/mappers.ts`: pure row → `src/core` mapping, unit-tested.
- All DB modules except `schema.ts` and `mappers.ts` import `server-only`.

### Migrations and seed

- `pnpm db:generate` writes a migration from the schema (no database needed). Commit it with the schema change.
- `pnpm db:migrate` applies pending migrations in one transaction (WebSocket driver); applied ones are skipped.
- `pnpm db:seed` creates the `TEST` event with 13 players, adding only what is missing.
- Both scripts run with Node's TypeScript support, load `.env.local` without printing it, and refuse to run with `VERCEL_ENV=production`. Point `.env.local` at a Neon **development branch**, never production.
- Deploys: Phase 0 runs migrations by hand. Before merging a PR that adds a migration, the organizer runs `pnpm db:migrate` against production with its connection string (write migrations so the deployed version keeps working until the new one is live). Vercel builds don't migrate.

## Live updates and the timer (planned, P08)

- Player, display and admin pages poll `/api/e/[code]/state` every 5 seconds. Mutations refetch immediately.
- The timer is computed on each client from `started_at`, `paused_at`, `elapsed_before_pause_sec` and `duration_sec`. The state response includes the server's `now` so clients correct their clock offset.
- At 0:00 the round shows overtime: "turno atual + 3" at 2v2 tables, "turno atual + 5" at the 1v1 table.

## Identity and security (planned, P05–P06)

- **Admin:** one password from `ADMIN_PASSWORD`; on login, an httpOnly cookie signed with `SESSION_SECRET`. All admin checks go through `isAdmin()`.
- **Players:** no accounts. Joining sets an httpOnly, per-event device-token cookie. A player can report only for a table they sit at. The admin can reissue a player's link if their phone dies.
- **Roster:** fetched server-side from `https://raw.githubusercontent.com/guilhermeocosta/commander-2x2/main/src/data/leaderboard.json`, cached for 1 hour, to offer known names when joining.
