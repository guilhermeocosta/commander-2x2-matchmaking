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
- With the seeded `TEST` event (13 players): round 1 has two 2v2 tables, one 1v1 and one bye.
- Re-roll produces a different seating; same seed reproduces the same seating.
- Swapping two players updates seats and warnings.
- The print page prints legibly on A4 (screen stays dark).

## Notes

- Print CSS is the only place a light background is allowed, because paper is white.

## Log

- 2026-11-24: Started on `step/P07-rounds` from `main`.
