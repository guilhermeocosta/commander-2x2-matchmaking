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
- 2026-11-28: Built the step; `pnpm check` is green. No migration and no new dependencies. Decisions:
  - Target shape: the site's `main` (`updatedAt`, `year`, `players[]`). Site PR #62 ("semester seasons", open) **would change it**: `leaderboard.json` becomes `{ currentSeason, seasons: [{ id, name, dates, goalPoints?, potPerEntry?, players }] }`. Both the export and P06's `parseRoster` read top-level `players`, so whichever lands after #62 must target the current season's `players`. The export fails safely on that shape ("formato esperado"), it doesn't write anything wrong.
  - `src/core/export.ts`: `eventResults` (attending = due to play at least one round, the same rule as the standings: late joiners and dropped players included, a player who left before round 1 or joined after the last round is not), `applyEventToLeaderboard`, `decklistsToCollect` (≥ 2 wins, byes included), `kebabId` and `formatLeaderboard` (`JSON.stringify` with 2 spaces + newline, which the site's Prettier accepts as is).
  - The Zod copy of the site schema is **strict**: an unknown field fails the export instead of being dropped silently. The input is validated but its own objects are kept (Zod would rebuild them in schema key order), so untouched players serialize byte-identically.
  - Matching is by `roster_id` only; the site's name wins over the display name. A roster id no longer in the file is appended with that id (reason "id do ranking que saiu do arquivo"); unmatched players get `kebabId(name)`, then `-2`, `-3`… on collision. All appended players are listed for review.
  - Admin: "Exportar" card at the bottom of `/admin/e/[code]`. The button is disabled until the event is `finished`; "Gerar arquivo" is a Server Action (`isAdmin()`, Zod on the code, status checked again) that downloads `leaderboard.json` with `cache: "no-store"` (shared `downloadLeaderboard` in `src/lib/roster.ts`; GitHub's raw CDN may still serve a copy a few minutes old, so the page shows the source file's `updatedAt`). It shows counts, new players to review, "Decklists para coletar", and the JSON with "Copiar" and "Baixar". Fetching on click, not on page load, keeps GitHub out of every admin render.
  - Verified in the browser pane (375 px) against `next dev` on the Neon `dev` branch, `TEST` event (finished in P09). To exercise matched players I linked Jogador Teste 01 → `arthur` and Jogador Teste 05 → `jose-coutinho` via "Gerenciar" (dev data only). Export: 2 updated, 10 new, decklists Teste 10 (3-0-0), Teste 11 (3-0-0), Teste 04 (2-0-1). Players linked to the roster who dropped before round 1 (Claudio Bonfim, Edu P06b, Jojo) were correctly left out. The exported file's SHA-256 matched the site's `main` file rebuilt with only those changes: `updatedAt`, `arthur` (+1 event, 0-0-3), `jose-coutinho` (+1 event, 1-1-1) and 10 appended players; every other player is byte-identical.
  - Site check: cloned `guilhermeocosta/commander-2x2` (`main` at 101eae5) into a scratch folder, replaced `src/data/leaderboard.json` with the export, `pnpm install --frozen-lockfile && pnpm build` passed (`astro check` included) and `prettier --check` on the file passed. Nothing was pushed to the site.
  - Follow-ups: adapt the export and `parseRoster` to the seasons shape if site PR #62 merges; the organizer still commits the file to the site by hand (out of scope).
- 2026-11-28: The organizer merged PR 12; status set to `done`.
