# Rules the app enforces

These are the event rules for Phase 0. They come from the format rules on [commander2x2.org/regras](https://commander2x2.org/regras) and from decisions made in the approved design doc. If code and this file disagree, this file wins; change it only with the organizer's approval.

## Event defaults

- 3 rounds per event.
- 50 minutes per round.
- Rounds are **Swiss**: round 1 is random, rounds 2 and 3 group players by points.

## Table layout

`N` is the number of active players in the round being paired. It is recalculated every round, so drops and late joins are handled automatically.

| `N mod 4` | Tables                             |
| --------- | ---------------------------------- |
| 0         | All 2v2                            |
| 1         | 2v2 tables + 1 bye                 |
| 2         | 2v2 tables + one 1v1 table         |
| 3         | 2v2 tables + one 1v1 table + 1 bye |

- 2v2: teammates sit in opposite corners; turn order A1, B1, A2, B2.
- 1v1: best of 3, 20 life. Seats A1 and B1 only.
- Fewer than 4 active players: the round can't be paired; the admin is told why.

## Pairing priorities

Highest first. Lower priorities only break ties between seatings that are equal on the higher ones.

1. **Never team a 2-0 player with a 0-2 player** when any other seating exists.
2. **Points spread inside a table** as small as possible (Swiss brackets, top-down; leftover players pair down into the next bracket).
3. **No second bye and no second 1v1** for the same player in an event.
4. **Avoid repeated teammates** within the event.
5. **Points gap between teammates** as small as possible.
6. **Avoid repeated opponents** within the event.

Inside a table, teams are chosen to avoid repeating a teammate first, then to make the points gap between teammates as small as possible.

Assignment of the special seats:

- **Bye:** the lowest player in the standings who hasn't had a bye. Round 1: random.
- **1v1:** the next two lowest players who haven't played 1v1, avoiding a rematch. Round 1: random.

Every pairing is generated from a stored **seed**, so it can be reproduced. The admin can re-roll (new seed) or swap two players before publishing. The engine reports a **warning** whenever it had to break priority 3, 4 or 6.

> Decided 2026-11-22 by the organizer: avoiding a repeated teammate ranks above the teammates' points gap. Former teammates share results, so they often have the same points; with the gap first, teammates repeated far more often.

## Scoring

| Outcome | Points | Counts as              |
| ------- | ------ | ---------------------- |
| Win     | 3      | a win, a match played  |
| Draw    | 1      | a draw, a match played |
| Loss    | 0      | a loss, a match played |
| Bye     | 3      | a win, a match played  |

- Both teammates get their team's result.
- A 1v1 match weighs the same as a 2v2 match.
- A bye counts toward the 2-win threshold for publishing a decklist.

## Time and extra turns

- When the 50 minutes end, the round enters **overtime**: the current turn plus 3 extra turns at 2v2 tables, plus 5 at the 1v1 table.
- A 2v2 game still unfinished after extra turns is a **draw**.
- A 1v1 match follows the Magic Tournament Rules: an unfinished game counts as a drawn game, and the player who won more games wins the match.

| 1v1 games (A–B) | Match result |
| --------------- | ------------ |
| 2–0, 2–1, 1–0   | A wins       |
| 0–2, 1–2, 0–1   | B wins       |
| 1–1, 0–0        | Draw         |

- Players record the draw like any other result; the admin can override.

## Results

- Any player seated at a table can report its result. There is no confirmation step in Phase 0.
- The admin sees every result live and can override any of them, at any time.
- A round closes when every table has a result (the admin can also close it).
- Every write is logged in the audit log.

## Drops and late joins

- A player who **drops** is left out of the next pairing. Their past results stay and still count toward their opponents' tiebreakers.
- A player who **leaves in the middle of a game** makes their team lose that game.
- A **late joiner** enters the next round that hasn't been paired yet, with 0 points.
- Rounds missed by joining late count as **nothing**: no loss and no match played.
- Every player who attended gets +1 attendance in the season export, late joiners included.

## Event standings

1. Points.
2. Opponents' match-win %: for each opponent faced (byes excluded), their match-win % with a floor of 33%; averaged.
3. A random draw from the event seed.

Match-win % = (wins × 3 + draws × 1) ÷ (matches played × 3), byes counting as wins and as matches played.

## Season export

After the event, the app produces an updated copy of the site's `leaderboard.json` for the current season:

- Each attending player: `eventsAttended + 1`, plus `wins`, `draws`, `losses` per round played (byes as wins).
- Players matched to the roster by `rosterId`; new players get a kebab-case id from their name and are flagged for review.
- `updatedAt` set to the event date; player order and `tiebreakRoll` kept.
- A list of players with 2 or more wins (decklists to collect).
