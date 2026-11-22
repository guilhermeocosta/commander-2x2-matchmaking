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
