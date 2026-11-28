# P11 · Dry run and runbook

## Goal

Prove the app can run the 2026-12-12 event: a full simulated event on real phones, fixes for what breaks, and a one-page runbook for event day.

## Depends on

P10.

## Read first

- Every step's Log (follow-ups to close or consciously defer).
- [docs/rules.md](../rules.md).

## Scope

### In

- Organizer-assisted dry run on production (a throwaway event): 11 participants across real phones and browser tabs, so round 1 has two 2v2 tables, a 1v1 and a bye. Cover: QR join, roster pick and new name, a late join before round 2, a drop before round 3, re-roll and swap, timer pause/+5/overtime, reports from phones, one admin override, 1v1 1–1 draw, standings, finish, export.
- Fix blocking bugs found (small, scoped commits; anything large goes back to its step as a redo).
- `docs/runbook.md` (pt-BR): before the event (create event, test login, charge phone, hotspot, Companion installed as fallback, printer), each round (generate → review → publish → print → start timer → watch results → close), failure plan (continue on paper, enter results later as overrides), after the event (finish, export, open the site PR, collect decklists).
- Delete the dry-run event data after the run (or mark it clearly as a test).

### Out

- New features. Anything not needed for 2026-12-12.

## Deliverables

- Fixes, `docs/runbook.md`, a Log entry with the dry-run findings.

## Acceptance checks

- `pnpm check` green.
- The dry run completes all three rounds and the export without manual DB edits.
- The organizer has read the runbook and agrees it's enough.

## Notes

- Freeze after this step: only critical fixes before the event.

## Log

- 2026-11-28: Started on `step/P11-dry-run` from `main`.
- 2026-11-28: Preparation. Production `/api/health` returns `{"ok":true,"db":"up"}` from `gru1`, and the Vercel status on `main`'s head (`7b7f2a5`, P10) is `success`. The only migration is `0000_init`, applied to production in P04, so nothing is pending. Wrote `docs/dry-run.md` (pt-BR script: 11 participants plus a late joiner, every in-scope check, cleanup) and a draft `docs/runbook.md`. The round time is fixed at 50 minutes in the app, so the script reaches overtime quickly with one `UPDATE events SET round_duration_sec = 120` on the test event before round 3 (time only, no results), or by waiting. The app has no event delete; the script names the event `[TESTE] …` and gives a checked `DELETE FROM events WHERE code = …` (cascades to players, rounds, tables, seats and audit rows). Waiting for the organizer's dry run.
