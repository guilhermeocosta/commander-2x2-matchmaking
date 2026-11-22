# Commander 2x2 · Matchmaking

Aplicativo web para rodar os eventos de **Commander 2x2** em São Paulo: inscrição dos jogadores pelo celular, pareamento suíço das mesas 2x2 (com bye e mesa 1x1), cronômetro da rodada, envio de resultados e classificação. Vai ficar em [matchmaking.commander2x2.org](https://matchmaking.commander2x2.org). O site da comunidade é o [commander2x2.org](https://commander2x2.org).

## Goals

This repo is **Phase 0**: the smallest app that runs one real event end to end, replacing MTG Companion at the 2026-12-12 event. It must:

- Let the admin create an event and players join from their phones without an account.
- Pair Swiss rounds of 2v2 tables, with byes and a 1v1 table when the player count isn't a multiple of 4.
- Run a 50-minute round timer with extra turns.
- Let players report results and the admin override any of them.
- Compute event standings and export an updated `leaderboard.json` for the site.

Later phases (MVP and beyond) will own the season ranking, add player accounts, and more. See [docs/plan/README.md](docs/plan/README.md).

## Docs

| File                                         | What it covers                                                |
| -------------------------------------------- | ------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                       | Conventions and how to work on a step (for agents and humans) |
| [CONTEXT.md](CONTEXT.md)                     | Domain glossary                                               |
| [docs/rules.md](docs/rules.md)               | Format rules the app enforces                                 |
| [docs/architecture.md](docs/architecture.md) | Stack, data model, routes, infra                              |
| [docs/plan/README.md](docs/plan/README.md)   | Step list, status table and state machine                     |
| [SECURITY.md](SECURITY.md)                   | How to report a vulnerability; security checks in place       |

## Development

```bash
pnpm install       # Node from .nvmrc, pnpm from packageManager
pnpm dev           # http://localhost:3000
pnpm check         # typecheck, lint, format, markdown lint, tests, build
```

Copy `.env.example` to `.env.local` once a step needs environment variables.
