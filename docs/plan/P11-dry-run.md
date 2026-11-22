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

- Organizer-assisted dry run on production (a throwaway event): 13 participants across real phones and browser tabs, so round 1 has two 2v2 tables, a 1v1 and a bye. Cover: QR join, roster pick and new name, a late join before round 2, a drop before round 3, re-roll and swap, timer pause/+5/overtime, reports from phones, one admin override, 1v1 1–1 draw, standings, finish, export.
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
