# P08 · Live views and timer

## Goal

Everyone sees the current round live: players see their seat and the timer on their phones, the projector shows all pairings, and the organizer controls the clock.

## Depends on

P07.

## Read first

- [docs/architecture.md](../architecture.md): Live updates and the timer.
- [docs/rules.md](../rules.md): Time and extra turns.

## Scope

### In

- `GET /api/e/[code]/state`: JSON snapshot (event, current round, timer fields, tables with seat names, the caller's own seat if their device cookie matches, server `now`). `Cache-Control: no-store`. Public data only, except the caller's own seat.
- A small client hook `useEventState(code)`: polls every 5 s, refetches on window focus and after mutations, keeps the last good snapshot on network errors and shows "sem conexão" quietly.
- Timer: computed from `started_at`, `paused_at`, `elapsed_before_pause_sec`, `duration_sec`, corrected by the server clock offset. Shows `mm:ss`; at 0 switches to overtime.
- Admin timer controls: Iniciar, Pausar, Retomar, +5 min; round status follows (`running`, `paused`, `overtime`).
- Player view at `/e/[code]`: round number, "Mesa N", seat (A1/B1/A2/B2), dupla, oponentes, timer; bye message; overtime message "Turno atual + 3 turnos extras" (2v2) or "+ 5" (1v1); waiting state between rounds.
- `/e/[code]/display`: all tables in large type + big timer, readable from across a room; no login.

### Out

- Reporting results and standings (P09).

## Deliverables

- State route, polling hook, timer component, admin controls, player view, display page.

## Acceptance checks

- `pnpm check` green.
- Two phones and the display show the same remaining time within 1 s.
- Pause/resume/+5 min reflect on all clients within one poll.
- At 0:00 every client shows overtime with the right extra-turn count per table kind.
- Display is readable at 3 m on a TV; player view fits 375 px.

## Notes

- Keep the payload small; tens of players polling every 5 s for ~4 hours must stay within free tiers.

## Log

- 2026-11-24: Started on `step/P08-live-views` from `main`.
- 2026-11-24: Built the step; `pnpm check` is green. No migration and no new dependencies. Decisions:
  - Pure timer in `src/core/timer.ts` with tests: elapsed and remaining time, the live status (a `running` round past its time reads `overtime`), `mm:ss`, extra turns per table kind, the admin transitions (`applyTimerAction`) and the clock offset. Field meanings are in `docs/architecture.md`. Pausing folds the elapsed time into whole seconds (`elapsed_before_pause_sec` is an integer), so a pause can shift the clock by under a second.
  - +5 min adds to the time left; in overtime it gives 5 minutes from now (not 5 minus the overtime played). Pausar also works in overtime.
  - The snapshot is built by `buildEventState` (`src/core/event-state.ts`, tested): drafts dropped, player ids stripped, the caller's seat found by their device cookie. `loadEventState` (`src/lib/event-state.ts`) serves both the route and the first render of the live pages.
  - Overtime is reached by time, not by an action, so the first snapshot after 0:00 stores `running` → `overtime` with a conditional update and a `system` audit entry.
  - Timer writes are optimistic: the update only lands if the stored clock still matches what the action read; a double click gets "A página está desatualizada".
  - Polling pauses while the tab is hidden (saves requests over a 4-hour event) and restarts on focus.
  - Moved `round-copy.ts` from `src/app/admin/e/[code]/` to `src/lib/` so the player and display views share the labels; added `overtimeMessage`. `DropButton` takes an `onDone` to refetch after a drop. The admin "Rodadas" section links to the display ("Telão").
  - Verified in the browser pane against `next dev` on the Neon `dev` branch: dropped Teste 12 and 13 (11 active), generated and re-rolled round 1 into two 2v2 tables, a 1v1 and a bye, and checked the state endpoint hid the draft. Published, claimed reissued links for Teste 11 (2v2, on `127.0.0.1`, 375 px) and Teste 08 (1v1, on `localhost`), and opened the display at 1920×1080. Iniciar, Pausar, +5 min while paused, Retomar and +5 min in overtime all showed the same clock on the admin, both phones and the display within one poll (readings within one second). Shortened the round's `duration_sec` in `dev` to reach 0: the 2v2 player saw "Turno atual + 3 turnos extras", the 1v1 player "+ 5", the display both, and the stored status moved to `overtime` with audit rows for every action. Stopping the server showed "sem conexão" with the clock still running.
  - Testing from `127.0.0.1` needs `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` (Next dev blocks the page scripts otherwise). I added it only for the test and did not commit it.
  - Dev data left on the `dev` branch's `TEST` event: round 1 published and running (+5 min), status `running`, Teste 12 and 13 dropped, new device tokens for Teste 08 and 11, plus audit rows.
  - Follow-ups: P09 closes rounds and reports results (the player view shows "Rodada N encerrada" between rounds); consider committing `allowedDevOrigins` for local two-context testing.
- 2026-11-27: The organizer merged PR 10; status set to `done`.
