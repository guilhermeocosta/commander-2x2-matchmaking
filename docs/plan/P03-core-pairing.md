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
  - `warnings`: every broken priority 3, 4 or 6 (e.g. "repeated teammate: X and Y"); numbering per the 2026-11-22 rules change in the Log.
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

- 2026-11-22: Started on `step/P03-core-pairing` from `main` (a previous attempt stopped before writing code).
- 2026-11-22: Built `src/core/pairing.ts` with `pairing.test.ts` (unit) and `pairing.simulation.test.ts` (simulated events N = 4..40 × 4 seeds × 3 rounds with draws, drops and late joins; brute-force optimality check; benchmark). 119 core tests run in about 2 s; the slowest pairing (N = 40) takes about 4 ms. No new dependencies. Decisions:
  - API: `pairRound({ players, history, seed })` takes `players` as `{ playerId, points }` in standings order (a `Standing[]` fits) and a `PairingHistory` of `teammates`/`opponents` pairs plus `byes`/`oneVsOnes`, built from past rounds by `pairingHistory(rounds)`. Seats count whether or not a result was reported. It returns `TableRecord[]` (2v2 tables strongest first, then the 1v1 table, then the bye; `outcome: null`) and structured `PairingWarning`s (`second-bye`, `second-1v1`, `repeated-teammate`, `repeated-opponent`, with player ids). P07 turns them into pt-BR copy.
  - For P07 swaps: `pairingWarnings(tables, history)` and `seatingCost(tables, players, history)` re-evaluate an edited round with the same rules.
  - Round 1 is detected by an empty history: the order is shuffled from the seed, so the seating, the bye and the 1v1 are all random.
  - Bye and 1v1 are picked before the search by `assignSpecialSeats`, exactly as in the rules (lowest without one; 1v1 avoids a rematch). Priority 3 is still in the cost so `seatingCost` covers a whole round, but the search never moves those players.
  - Cost tuple, compared lexicographically: `[2-0/0-2 teammates, Σ spread², Σ teammate gap², second bye/1v1, repeated teammates, repeated opponents]`. The first entry enforces "never 2-0 with 0-2 when any other seating exists" absolutely; it is zero whenever spread allows, so it does not override priority 1 in practice. Spread and gap are squared so one very mixed table costs more than two slightly mixed ones.
  - Teammates: `chooseTeams` picks the split with the smallest teammate gap, then the fewest repeated teammates and opponents. For sorted points a ≤ b ≤ c ≤ d that is always {a, b} vs {c, d}. "The two closest-points players" read literally could pair the middle two and leave a 6 with a 0, so the split is chosen on both gaps.
  - Search: Swiss start (brackets top-down, shuffled from the seed inside each bracket, leftovers pairing down), then first-improvement hill climbing over swaps between tables. It runs at most 8 restarts × 25 passes, so it always ends. For N = 8..13 the brute-force test confirms it finds the optimal cost in every simulated round.
  - Question for the organizer (rules order, not a bug): former teammates share results, so they often have the same points, and priority 2 (smallest teammate gap) outranks priority 4 (no repeated teammate). In simulated events of 16+ players with draws, drops and late joins this gives about 0.14 repeated teammates per pairing, all forced by the rules' order. With priority 4 moved above the teammate gap (keeping the 2-0/0-2 rule and priority 1 on top), it falls below 0.02. If you want that, change `docs/rules.md` and move one entry in `splitCost`/`SeatingCost`.
  - Follow-ups: P07 renders warnings in pt-BR and checks `MIN_PLAYERS` before calling `pairRound` (it throws a `RangeError` below 4 players).
- 2026-11-22: The organizer answered the rules question: avoiding a repeated teammate now ranks above the teammates' points gap. `docs/rules.md` is updated with the new order: 2-0/0-2 teammates → spread → second bye/1v1 → repeated teammate → teammate gap → repeated opponent. Inside a table, teams are chosen to avoid a repeat first, then by the smallest gap. `SeatingCost`, `splitCost` and `chooseTeams` follow it, and warnings now cover priorities 3, 4 and 6. Added the 3, 3, 0, 0 test, where former teammates at 3 points are split 3+0 vs 3+0. Rerun of the simulation (16+ players, 300 pairings): 0 repeated teammates, down from 41 (about 0.14 per pairing). The bound is tightened to under 0.02. Repeated opponents: 97. The brute-force check (N = 8..13) still finds the optimal cost, and the slowest pairing takes about 4 ms.
