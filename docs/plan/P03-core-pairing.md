# P03 · Core: pairing engine

## Goal

A pure, deterministic pairing engine that seats one round following the rules' priorities, with simulation tests that prove it across realistic events.

## Depends on

P02 (uses its types, RNG and standings).

## Read first

- [docs/rules.md](../rules.md): Table layout, Pairing priorities.
- `src/core/types.ts`, `src/core/rng.ts`, `src/core/standings.ts`.

## Scope

### In

- `src/core/pairing.ts`:
  - `tableLayout(n)` → counts of 2v2, 1v1, bye per `n mod 4`; error below 4 players.
  - `pairRound({ players, history, seed })` → `{ tables, warnings }`, where `players` are the active players with their standings and `history` lists past teammates, opponents, byes and 1v1s.
  - Bye and 1v1 assignment from the bottom of the standings, skipping players who already had one (random in round 1).
  - Seating search: start from standings order (brackets, pair down), then local search over swaps with several restarts from the seed. Cost is lexicographic in the rules' priority order: points spread per table → teammate points gap → second bye/1v1 → repeated teammate → repeated opponent.
  - Teammates inside a table: the two closest-points players; seats A1/A2 vs B1/B2.
  - `warnings`: every broken priority 3–5 (e.g. "repeated teammate: X and Y").
- Simulation tests: N = 4..40, 3 rounds, random results, some drops and late joins, many seeds. Assert: layout matches `N mod 4`; every active player seated exactly once; no second bye/1v1 when avoidable; no warning-free repeated teammate; round 2–3 tables never mix 2-0 with 0-2 when an alternative exists; same seed → same output.
- A small benchmark test: N = 40 pairs in < 500 ms.

### Out

- DB, UI, admin swaps (P07 does swaps by editing the engine's output).

## Deliverables

- `src/core/pairing.ts`, `src/core/pairing.test.ts` (and helpers for simulation if needed).

## Acceptance checks

- `pnpm check` green.
- Simulation tests pass for all N and seeds in the suite.
- No imports from `next`, `react` or `@/db` in `src/core`.

## Notes

- Lexicographic cost: compare tuples, not weighted sums, so a lower priority can never outweigh a higher one.
- Teammate selection is an open item in the rules; keep it in one small function so it's easy to change.

## Log
