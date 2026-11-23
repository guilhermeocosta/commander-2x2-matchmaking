# Architecture

Phase 0 is a single Next.js app on Vercel with a Postgres database on Neon. There is no separate API server: pages are Server Components, mutations are Server Actions, and live views poll one JSON endpoint.

Sections marked **(planned)** describe what later steps build. Update them when a step changes the design.

## Stack

| Layer      | Choice                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Server Actions), React 19, TypeScript                                                                                   |
| Styling    | Tailwind v4 + daisyUI 5, one dark theme (`c2x2-dark`)                                                                                           |
| Database   | Neon Postgres via `@neondatabase/serverless`, Drizzle ORM + drizzle-kit (planned, P04)                                                          |
| Validation | Zod (planned, from the first step that needs it)                                                                                                |
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

## Data model (planned, P04)

| Table           | Columns                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`        | `id`, `code`, `name`, `date`, `status` (`open` \| `running` \| `finished`), `rounds`, `round_duration_sec`, `seed`, `created_at`                                                                  |
| `event_players` | `id`, `event_id`, `display_name`, `roster_id?`, `device_token?`, `joined_round`, `dropped_after_round?`                                                                                           |
| `rounds`        | `id`, `event_id`, `number`, `status` (`draft` \| `published` \| `running` \| `paused` \| `overtime` \| `closed`), `seed`, `started_at?`, `paused_at?`, `elapsed_before_pause_sec`, `duration_sec` |
| `tables`        | `id`, `round_id`, `number`, `kind` (`2v2` \| `1v1` \| `bye`), `outcome?` (`A` \| `B` \| `draw`), `games_a?`, `games_b?`, `reported_by?`, `reported_at?`, `overridden`                             |
| `seats`         | `table_id`, `event_player_id`, `team` (`A` \| `B`), `position` (1 \| 2)                                                                                                                           |
| `audit_log`     | `id`, `event_id`, `actor`, `action`, `payload` (jsonb), `at`                                                                                                                                      |

## Live updates and the timer (planned, P08)

- Player, display and admin pages poll `/api/e/[code]/state` every 5 seconds. Mutations refetch immediately.
- The timer is computed on each client from `started_at`, `paused_at`, `elapsed_before_pause_sec` and `duration_sec`. The state response includes the server's `now` so clients correct their clock offset.
- At 0:00 the round shows overtime: "turno atual + 3" at 2v2 tables, "turno atual + 5" at the 1v1 table.

## Identity and security (planned, P05–P06)

- **Admin:** one password from `ADMIN_PASSWORD`; on login, an httpOnly cookie signed with `SESSION_SECRET`. All admin checks go through `isAdmin()`.
- **Players:** no accounts. Joining sets an httpOnly, per-event device-token cookie. A player can report only for a table they sit at. The admin can reissue a player's link if their phone dies.
- **Roster:** fetched server-side from `https://raw.githubusercontent.com/guilhermeocosta/commander-2x2/main/src/data/leaderboard.json`, cached for 1 hour, to offer known names when joining.
