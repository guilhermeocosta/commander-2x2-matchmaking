# P07 · Rounds: generate, review, publish, print

## Goal

The organizer generates a round with the pairing engine, reviews it, adjusts it if needed, publishes it, and prints it.

## Depends on

P03 (engine) and P06 (players).

## Read first

- [docs/rules.md](../rules.md): Table layout, Pairing priorities.
- `src/core/pairing.ts`, `src/core/standings.ts`, `src/db/queries.ts`.

## Scope

### In

- Admin "Rodadas" section: "Gerar rodada N" (enabled when the previous round is closed, or for round 1 when there are ≥ 4 active players).
- Server side: load active players + history from the DB, compute standings (P02), call `pairRound` (P03) with a new seed, store the round as `draft` with its tables and seats.
- Draft review: tables with seats (A1, B1, A2, B2), points per player, engine warnings; actions **Publicar**, **Sortear de novo** (new seed, replaces the draft), **Trocar jogadores** (pick two players, swap their seats; recompute warnings).
- Publish sets the round to `published` (players can now see it in P08).
- `/admin/e/[code]/print/[round]`: a print-friendly page (white background allowed via print CSS only) listing tables and seats; "Imprimir" button.
- Event status: `open` → `running` when round 1 is published; after round 3 closes, the admin can finish the event (`finished`).
- Audit log entries for generate, re-roll, swap, publish.

### Out

- Timer, player views, results (P08, P09).

## Deliverables

- Round generation + review UI, swap, publish, print page.

## Acceptance checks

- `pnpm check` green.
- With the seeded `TEST` event and 11 active players (drop two of its 13): round 1 has two 2v2 tables, one 1v1 and one bye.
- Re-roll produces a different seating; same seed reproduces the same seating.
- Swapping two players updates seats and warnings.
- The print page prints legibly on A4 (screen stays dark).

## Notes

- Print CSS is the only place a light background is allowed, because paper is white.

## Log

- 2026-11-24: Started on `step/P07-rounds` from `main`.
- 2026-11-24: Built the step; `pnpm check` is green. No migration and no new dependencies. Decisions:
  - Pure rules in `src/core/rounds.ts` with tests: who plays a round (`joined_round`, `dropped_after_round`), the "Gerar rodada N" gate, `canFinishEvent`, `planRound` (standings → `pairRound`), `swapPlayers` (any two seated players, across 2v2, 1v1 and bye; the layout can't change), `roundWarnings` (the engine's warnings plus a 2-0 teamed with a 0-2, the case the engine can be forced into at 6–7 players), and `seatsMatchPlayers`.
  - Writes: `insertDraftRound`, `replaceDraftTables` (re-roll and swap) and `publishRound` each run in one `db.batch`, a transaction on Neon HTTP, with ids generated up front. A re-roll or swap on a round that is no longer a draft deletes nothing, hits the unique table number and rolls back. Publishing round 1 moves the event from `open` to `running` in the same batch. Warnings are recomputed from the stored tables on every render, not stored.
  - Drops and late joins now count from the latest round past `draft` (`getLatestPairedRoundNumber`), answering the P06 question: a drop or join while round N is a draft applies to round N. The draft then shows a warning and "Publicar" is refused until it is re-rolled.
  - After a swap the stored seed no longer reproduces the seating; the swap is in the audit log (`round_players_swapped`). Audit actions are listed in `docs/architecture.md`.
  - "Encerrar evento" is shown but disabled until round 3 closes (P09 closes rounds); the action checks the same guard on the server.
  - Print page `/admin/e/[code]/print/[round]`: tables with seats in turn order, then players A–Z with their table (page 2), on A4. `@media print` in `globals.css` is the only light styling.
  - **Spec discrepancy:** the acceptance check says 13 players give two 2v2 tables, a 1v1 and a bye, but `docs/rules.md` (and the seed script) give three 2v2 tables and a bye for 13 (13 mod 4 = 1). Two 2v2 + 1v1 + bye is 11 players. Both layouts are covered by tests and were checked in the browser.
  - Verified in the browser pane against `next dev` on the Neon `dev` branch: dropped the five P06 test players through the app (13 active); generated round 1 (three 2v2 + bye); re-roll changed the seating; dropping two players showed the stale-draft warning, and re-rolling gave two 2v2 + 1v1 + bye; swapped the bye player with a 1v1 player; published (event → "Em andamento", "Gerar rodada 2" disabled until round 1 closes). Then closed round 1 with results directly in the `dev` database (P09 does this in the app), generated round 2 with points shown, and a swap raised two "já jogaram em dupla" warnings. 375 px has no horizontal scroll; the print page is legible with the print rules applied (black on white, controls hidden). Same seed → same seating is covered by a test.
  - Dev data left on the `dev` branch's `TEST` event: no rounds, status `open`, the 13 seeded players active, the five P06 players dropped, plus audit rows.
  - Follow-ups: round result entry and closing (P09) unlock "Gerar rodada 2" and "Encerrar evento"; the admin player list counts late joiners as "ativos" (P06 behavior).
- 2026-11-24: The organizer confirmed the spec discrepancy above: the acceptance check now says 11 active players (two 2v2 tables, one 1v1 and one bye), matching `docs/rules.md`.
- 2026-11-24: Same fix in `docs/plan/P11-dry-run.md`, at the organizer's request: the dry run uses 11 participants (11 mod 4 = 3: two 2v2 tables, a 1v1 and a bye). No other doc repeats the 13-player claim; the seed (13 players) and `docs/rules.md` are unchanged.
