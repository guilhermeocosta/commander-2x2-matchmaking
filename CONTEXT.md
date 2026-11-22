# CONTEXT.md: ubiquitous language

The shared vocabulary of Commander 2x2: the words players use, the pt-BR words in the UI, and the names in the code. When you name something in code, use the **In code** column. When you write UI copy, use the **UI (pt-BR)** column.

The format's source of truth is the rules page on [commander2x2.org/regras](https://commander2x2.org/regras). The rules this app enforces are in [docs/rules.md](docs/rules.md).

## Watch out: "partner" means two things

- **Partner (the keyword)** is a Magic ability. It has nothing to do with pairing.
- **Your teammate** is your **dupla**. Never call a teammate a "partner" in code or copy: use `teammate` / `team` in English identifiers and _dupla_ in pt-BR.

## The format

| UI (pt-BR)                 | English           | In code                         | Meaning                                                                               |
| -------------------------- | ----------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| Dupla                      | Team              | `team: "A" \| "B"`              | Two players on the same side for one round. Teams are re-drawn every round.           |
| Aliado                     | Teammate          | `teammate`                      | Your teammate this round.                                                             |
| Oponente                   | Opponent          | `opponent`                      | Each player on the other team.                                                        |
| Mesa                       | Table             | `Table`                         | Four players, two teams, teammates in opposite corners. Turn order A1 – B1 – A2 – B2. |
| Assento                    | Seat              | `Seat` (`team`, `position`)     | A player's place at a table: A1, A2, B1 or B2.                                        |
| Mesa 1x1                   | 1v1 table         | `kind: "1v1"`                   | Used when the player count leaves 2 or 3 extra players. Best of 3, 20 life.           |
| Bye                        | Bye               | `kind: "bye"`                   | A player who sits out a round. Scores as a win.                                       |
| Rodada                     | Round             | `Round`                         | One game per table, 50 minutes plus extra turns.                                      |
| Turnos extras              | Extra turns       | `overtime`                      | After time: current turn + 3 (2v2) or + 5 (1v1).                                      |
| Vitória / Empate / Derrota | Win / Draw / Loss | `outcome: "A" \| "B" \| "draw"` | A table's result, per team. Each player gets their team's result.                     |

## Events

| UI (pt-BR)          | English      | In code             | Meaning                                                                                   |
| ------------------- | ------------ | ------------------- | ----------------------------------------------------------------------------------------- |
| Evento              | Event        | `Event`             | One tournament day: 3 rounds by default.                                                  |
| Código do evento    | Event code   | `code`              | Short code players type or scan to join (4 characters).                                   |
| Jogador (no evento) | Event player | `EventPlayer`       | A person at one event, identified by a device token. No account needed.                   |
| Desistência         | Drop         | `droppedAfterRound` | The player leaves the event and is not paired again.                                      |
| Entrada atrasada    | Late join    | `joinedRound`       | A player who joins after round 1 enters the next round that hasn't been paired yet.       |
| Classificação       | Standings    | `standings`         | Event ranking: points, then opponents' match-win %, then a seeded random draw.            |
| Admin               | Admin        | `isAdmin()`         | The organizer. Creates events, publishes pairings, controls the timer, overrides results. |
| Telão               | Display      | `/e/[code]/display` | The projector page with pairings and timer.                                               |

## Season ranking (Hall da Fama)

The 2026 ranking lives in the site repo, in `src/data/leaderboard.json`. Phase 0 reads it for the player roster and exports an updated copy after the event.

| UI (pt-BR)   | English        | In code                 | Meaning                                                                             |
| ------------ | -------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| Hall da Fama | Season ranking | `LeaderboardData`       | The annual ranking on commander2x2.org.                                             |
| Jogador      | Season player  | `rosterId` (kebab-case) | A player in `leaderboard.json`, e.g. `guilherme-costa`.                             |
| Pontuação    | Score          | —                       | `eventsAttended × 1 + wins × 3 + draws × 1`. Computed by the site, not by this app. |
