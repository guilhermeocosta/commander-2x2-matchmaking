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

- 2026-11-27: Started on `step/P09-results` from `main`.
- 2026-11-27: Built the step; `pnpm check` is green. No migration (the P04 `tables` columns `outcome`, `games_a/b`, `reported_by`, `reported_at` and `overridden` were enough) and no new dependencies. Decisions:
  - Pure rules in `src/core/report.ts` with tests: `resolveResult` (a 1v1 stores the games and the outcome from `oneVsOneOutcome`), `leftMidGameResult`, `reportPermission` (only a player seated at that table, while the round is open, and not after the admin set it), `resultStatus` and `tablesMissingResults`, plus `resultFormSchema` (Zod), shared by the player and admin actions.
  - Writes repeat the checks in the `UPDATE … WHERE` (round status, `overridden = false` for players), so a report racing "Encerrar rodada" or an override changes nothing. An admin result sets `overridden` and clears `reported_by` (as the schema comment says); the audit row keeps the previous outcome and reporter. Players can't change a table the admin set.
  - The state snapshot now carries each table's result (status, outcome, 1v1 games, the reporter's display name). The admin grid, the timer and "Encerrar rodada" share one poll (`LiveRoundAdmin`); the grid gets player ids from the server render for "Jogador saiu no meio do jogo" (the public snapshot stays id-free). Earlier rounds are listed under "Resultados da rodada N" and can still be fixed.
  - Standings are not in the 5 s snapshot: `GET /api/e/[code]/standings` serves them (computed by `eventStandings` in `src/core/event-standings.ts` from the closed rounds only) and `useStandings` refetches when a round closes, on focus, and every 30 s on the display between rounds. Players who dropped before their first round, and late joiners not in yet, are left out; dropped players who played show "(saiu)". OMW% shows "—" without opponents (a round-1 bye).
  - Closing is manual (players can fix a report until then), with a warning listing the tables without a result; those count as nothing until the admin sets them. "Saiu no meio do jogo" doesn't drop the player; the copy points to "Gerenciar".
  - Fixture: `src/core/event-standings.test.ts` is a 3-round event with a bye, a 1v1 1–1, a late joiner and a "saiu no meio do jogo", checked against hand-computed points, records and OMW%.
  - Verified in the browser pane against `next dev` on the Neon `dev` branch, with `localhost` and `127.0.0.1` as two player cookie jars (375 px): a late joiner (Atrasado P09) joined during round 1 and played rounds 2–3; Teste 11 reported Mesa 1, and a report with the table number edited to Mesa 2 was refused ("Você só pode reportar o resultado da sua mesa"); Teste 08 reported the 1v1 as 1–1 and it was stored as a draw with games 1–1; the admin overrode Mesa 1 (marked "Alterado pelo admin") and recorded "Teste 06 saiu" on Mesa 2 (Dupla B venceu); closing round 1 unlocked "Gerar rodada 2" and showed standings on the admin, the player tab and the display. In round 2 a player changed their report, the admin set a table first and that phone showed "Definido pela organização" without buttons, round 2 was closed with a table missing (warning shown), and that table was fixed after closing (standings updated). Round 3 was played with the timer running, closed, and "Encerrar evento" set the event to `finished`; the display shows "Classificação final" at 1920×1080. Audit rows: 6 `result_reported`, 5 `result_overridden`, 1 `result_player_left`, 3 `round_closed`, 1 `event_finished`.
  - As in P08, testing from `127.0.0.1` needed `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts`; added only for the test, not committed.
  - Dev data left on the `dev` branch's `TEST` event: rounds 1–3 closed with results, event `finished`, new player Atrasado P09 (joined round 2), new device tokens for Teste 08 and 11, plus audit rows. Reseed or create a new event before the next test.
  - Follow-ups: P10 exports from these results; consider committing `allowedDevOrigins` for local two-context testing; the "Encerrar rodada" success message disappears with the button once the round closes (the unlocked "Gerar rodada N+1" is the feedback).
- 2026-11-27: The organizer merged PR 11; status set to `done`.
