# P02 · Core: results and standings

## Goal

Pure, tested functions for table outcomes, per-player match results and event standings. No pairing yet.

## Depends on

P00.

## Read first

- [docs/rules.md](../rules.md): Scoring, Time and extra turns, Drops and late joins, Event standings.
- [CONTEXT.md](../../CONTEXT.md).

## Scope

### In

- `src/core/types.ts`: shared types (`PlayerId`, `TableKind`, `Team`, `Outcome`, `RoundRecord` describing each table of a past round: kind, seats, outcome, 1v1 games).
- `src/core/rng.ts`: seeded PRNG (mulberry32 or similar) + `shuffle(array, rng)`; deterministic for a given seed.
- `src/core/results.ts`:
  - `oneVsOneOutcome(gamesA, gamesB)` → `"A" | "B" | "draw"` per the MTR table.
  - `playerResults(rounds)` → per player and round: `win | draw | loss | bye`, from table outcomes (both teammates share the result; bye = win).
- `src/core/standings.ts`:
  - `points` (3/1/0, bye = 3), `matchWinPct` (byes count as wins and matches), opponents' match-win % with a 33% floor per opponent, byes excluded, averaged.
  - `standings(players, rounds, seed)` → ordered list with rank, points, record (W-D-L), OMW%. Final tiebreak: seeded random. Late joiners' missed rounds count as nothing.
- Tests for every rule above, including: 1v1 2-1/1-0/1-1/0-0, bye as win, late joiner with 2 rounds, a player who dropped still counting for opponents, OMW floor.

### Out

- Pairing (P03). Any I/O, Next, React or DB code.

## Deliverables

- `src/core/{types,rng,results,standings}.ts` and `*.test.ts` next to them.

## Acceptance checks

- `pnpm check` green; `pnpm test` runs the new tests.
- `src/core` has no imports from `next`, `react` or `@/db`.
- Same seed → same standings order, across runs.

## Notes

- Keep types small and serializable; P04 maps DB rows into them.

## Log

- 2026-11-22: Built `src/core/{types,rng,results,standings}.ts` with tests (49 cases); no new dependencies. Decisions for P03/P04:
  - `RoundRecord = { round, tables: TableRecord[] }`; `TableRecord = { kind: "2v2" | "1v1" | "bye", seats: Seat[], outcome: "A" | "B" | "draw" | null, games?: { a, b } }`; `Seat = { playerId, team, position: 1 | 2 }`. A bye has one seat (A1); `outcome` is ignored for it.
  - `outcome: null` means not reported: the table counts as nothing until it has a result. For 1v1, a set `outcome` wins (admin override); otherwise it is derived from `games` via `oneVsOneOutcome`.
  - `playerResults` returns `Record<PlayerId, PlayerRoundResult[]>` sorted by round, each with `kind`, `result`, `teammates` and `opponents`, so P03 can read past byes, 1v1s, teammates and opponents from it. It throws on malformed tables or a player seated twice in a round.
  - OMW counts every opponent of every match (two per 2v2, one per 1v1; repeats count again), floor 0.33, and is 0 for a player with no opponents. Ties within 1e-9 go to the seeded draw.
  - `standings(players, rounds, seed)` ranks only `players` (pass dropped players to show them), while everyone in `rounds` feeds tiebreakers. The seeded draw shuffles the sorted ids with mulberry32, so input order doesn't matter. Seed is a number reduced to uint32.
  - Test builders live in `src/core/test-helpers.ts` for reuse in P03.
- 2026-11-22: PR #3 merged by the organizer; status set to `done`.
