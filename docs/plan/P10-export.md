# P10 · Season export

## Goal

After the event, the organizer gets an updated `leaderboard.json` ready to commit to the site repo, plus the list of decklists to collect.

## Depends on

P09.

## Read first

- [docs/rules.md](../rules.md): Season export, Scoring.
- The site's schema: `src/schemas/leaderboard.ts` in `guilhermeocosta/commander-2x2` (fields `updatedAt`, `year`, `players[]` with `id`, `name`, `avatar`, `stats`, optional `tiebreakRoll`).

## Scope

### In

- `src/core/export.ts`: `applyEventToLeaderboard(leaderboard, eventResults, eventDate)` → new leaderboard. +1 `eventsAttended` per attending player; `wins`/`draws`/`losses` per round played (bye = win); new players appended with a kebab-case id from their name (unique), `avatar: null`; existing order and `tiebreakRoll` untouched; `updatedAt` = event date. Validated with a Zod copy of the site schema.
- Tests: existing player, new player, id collision, late joiner (fewer matches), bye counted as win, untouched players unchanged.
- Admin "Exportar" section (enabled when the event is `finished`): fetches the current file (roster URL, uncached), shows the new JSON with "Copiar" and "Baixar", lists new players flagged for review, and lists players with ≥ 2 wins ("Decklists para coletar").

### Out

- Writing to the site repo automatically (the organizer or an agent opens the PR by hand).

## Deliverables

- Export function + tests, admin export section.

## Acceptance checks

- `pnpm check` green.
- Exported JSON for the seeded event, dropped into the site repo, passes the site's `pnpm build`.
- Diff against the input touches only attending players, new players and `updatedAt`.

## Notes

- Keep the JSON formatting compatible with the site's Prettier (2-space indent, trailing newline).

## Log

- 2026-11-27: Started on `step/P10-export` from `main`.
