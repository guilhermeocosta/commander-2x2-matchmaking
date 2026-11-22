# P09 · Results and standings

## Goal

Players report their table's result from their phones; the organizer sees every result live, fixes any of them, closes the round, and everyone sees the standings.

## Depends on

P08.

## Read first

- [docs/rules.md](../rules.md): Results, Scoring, Time and extra turns, Event standings.
- `src/core/results.ts`, `src/core/standings.ts`.

## Scope

### In

- Player report form on `/e/[code]` (only for a table the device's player sits at):
  - 2v2: "Dupla A venceu", "Dupla B venceu", "Empate".
  - 1v1: games won by each player (0–2); outcome derived with `oneVsOneOutcome`.
  - Players at the table can change the result until the round closes; after that only the admin.
- Admin results grid: every table with status (sem resultado, reportado, alterado pelo admin), who reported, an override control, and "Encerrar rodada" (warns if tables lack results).
- "Jogador saiu no meio do jogo": admin sets that table's outcome to the other team's win.
- Standings page (player view tab + admin section + display between rounds): rank, name, points, W-D-L, OMW%.
- Audit log entries for every report and override.

### Out

- Export (P10). Result confirmation/disputes (not in Phase 0).

## Deliverables

- Report form, admin grid + override + close round, standings views.

## Acceptance checks

- `pnpm check` green.
- A player can't report for a table they don't sit at (server-side check).
- 1v1 1–1 is stored as a draw; 1–0 as a win.
- Admin override replaces a player's report and is marked as such.
- Standings after a seeded 3-round event match a hand-computed expectation (add it as a test fixture if practical).

## Notes

- Reporting must work with one tap on a phone in a noisy store: big buttons, clear confirmation.

## Log
