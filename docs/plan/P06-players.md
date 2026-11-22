# P06 · Players: join, drop, late join

## Goal

Players join an event from their phones without an account; the organizer manages the player list.

## Depends on

P05.

## Read first

- [docs/rules.md](../rules.md): Drops and late joins.
- [docs/architecture.md](../architecture.md): Identity and security (roster, device token).
- `src/lib/auth.ts`, `src/db/queries.ts`.

## Scope

### In

- `src/lib/roster.ts`: fetch `leaderboard.json` from the site repo (URL in the architecture doc), parse with Zod (`id`, `name`), cache 1 hour; on failure, return an empty roster (joining still works).
- `/` : form "Código do evento" → `/e/[code]`.
- `/e/[code]` (join state): pick a name from the roster (searchable) or type a new one; creates an `event_player` with `roster_id` when picked; sets an httpOnly per-event device-token cookie. A returning device sees "Você está inscrito como X". Prevent two players with the same roster id in one event.
- Player can drop ("Sair do evento", with confirmation).
- Admin panel "Jogadores": list with status (ativo, desistiu, entra na rodada N), add a player by hand, rename, link to a roster name, drop/undo drop, reissue link (shows a QR + URL that sets the device token on another phone).
- Late join: joining after round 1 is paired sets `joined_round` to the next unpaired round.
- Join QR + short URL on the admin panel (`qrcode` package).
- Audit log entries for every change.

### Out

- Pairing and anything round-related (P07).

## Deliverables

- Roster lib, join/drop flows, admin player management, QR.

## Acceptance checks

- `pnpm check` green.
- Join from two different browsers: both appear in the admin list; the same browser rejoining doesn't duplicate.
- Picking a roster name stores its `roster_id`; typing a new name stores none.
- Drop and undo drop work from the admin panel; player self-drop works.
- With the roster URL unreachable, joining still works by typing a name.
- All copy pt-BR; dark only; usable at 375 px width.

## Notes

- Joining is open while the event status is `open` or `running`; closed when `finished`.

## Log
