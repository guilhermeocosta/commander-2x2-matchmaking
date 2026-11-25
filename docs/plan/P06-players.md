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

- 2026-11-24: Started on `step/P06-players` from `main`.
- 2026-11-24: Built the step; `pnpm check` and `pnpm security` are green. No migration. Decisions:
  - Deps (exact pins, both older than 3 days): `qrcode@1.5.4` and `@types/qrcode@1.5.6` (dev). QR codes are SVG rendered on the server, black on white whatever the theme so phone cameras read them.
  - Pure rules in `src/core/roster.ts` (Zod parse of `leaderboard.json`, accent-insensitive search) and `src/core/players.ts` (late join, drop, status), with tests. `src/lib/roster.ts` caches the fetch for 1 hour with `"use cache"`; failures throw inside the cache scope so they aren't cached, and `getRoster()` returns `[]`.
  - Device tokens: 32 random bytes in an httpOnly, Secure, SameSite=Lax cookie `c2x2_p_<CODE>` (path `/`, 30 days); only the SHA-256 is stored. A device with a valid cookie for the event is sent back to its player instead of joining again.
  - Reissue: `/e/CODE/entrar#<token>`. The token is in the fragment (never sent in a GET, so no server logs and no link-preview fetch can use it); the player taps a button to post it. Claiming swaps the hash in one `UPDATE … WHERE hash = old`, so a link works once. Reissuing cuts off the old device immediately.
  - Late join and drop use the latest row in `rounds` (any status): `joined_round` = latest + 1 and `dropped_after_round` = latest (0 before round 1). Joining is refused once every round is paired, and when the event is `finished`. Status "entra na rodada N" shows while `joined_round` > 1 and that round doesn't exist yet. P07 should decide whether a player who joins while a round is still a draft should be added to that draft on a re-roll.
  - Admin "Jogadores": join QR + URL (origin from the request host), counts, per-player "Gerenciar" (rename and roster link in one form, drop/undo, reissue link with QR and copy), and "Adicionar jogador" (name and/or roster pick; no device until a link is reissued). Audit actions are listed in `docs/architecture.md`; payloads hold ids only. Also added a pt-BR `not-found` page and the "Código do evento" form on `/`.
  - Verified in the browser pane against `next dev` on the Neon `dev` branch, mostly at 375 px, using `localhost`, `127.0.0.1` and `[::1]` as three separate cookie jars: joining from two contexts lists both in the admin; reloading the same device shows "Você está inscrito como X" and adds nothing; a roster pick stored `claudio-bonfim`, a typed name stored no roster id; a taken roster name shows "já inscrito"; self-drop with confirmation; admin drop and undo; rename and link to a roster name; add by hand; reissued link claimed on another context, refused the second time, and the old device lost access; with a round 1 row inserted by hand, a new join got `joined_round` 2 and "entra na rodada 2" (the row was deleted afterwards); with `ROSTER_URL` pointed at an unreachable host, the join page offered only the name field and joining worked. The `127.0.0.1` context doesn't hydrate in `next dev` (dev resources are blocked cross-origin), so that join also proved the forms work without JavaScript.
  - Dev data left on the `dev` branch's `TEST` event: players Claudio Bonfim, Edu P06b, Jojo, Atrasado P06 (`joined_round` 2) and Sem Roster P06, plus their audit rows.
  - Follow-ups: rate-limit joins per IP (anyone with the code can add names); in `next dev`, admin pages log a "blocking-prerender-current-time" error from the `Date.now()` in `isAdmin()` (from P05, not this step; likely fixed by awaiting `connection()` before reading the clock).
