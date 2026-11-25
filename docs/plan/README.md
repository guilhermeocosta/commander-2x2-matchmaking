# Phase 0 plan

Phase 0 is split into small, self-contained **steps**. Each step fits one agent with a fresh context: its file says what to read, what to build, and how to check it. This file is the **single source of truth for status**.

Target: run the 2026-12-12 event (3 rounds) end to end in the app. The Hall da Fama final after it stays on paper.

## Status

| Step                       | Title                                    | Status | Depends on | Needs the organizer           |
| -------------------------- | ---------------------------------------- | ------ | ---------- | ----------------------------- |
| [P00](P00-setup.md)        | Setup                                    | done   | —          | —                             |
| [P01](P01-infra.md)        | Infra and deploy                         | done   | P00        | Yes: Vercel, Neon, Cloudflare |
| [P02](P02-core-rules.md)   | Core: results and standings              | done   | P00        | —                             |
| [P03](P03-core-pairing.md) | Core: pairing engine                     | done   | P02        | —                             |
| [P04](P04-database.md)     | Database                                 | done   | P01        | —                             |
| [P05](P05-admin-events.md) | Admin login and events                   | done   | P04        | —                             |
| [P06](P06-players.md)      | Players: join, drop, late join           | done   | P05        | —                             |
| [P07](P07-rounds.md)       | Rounds: generate, review, publish, print | review | P03, P06   | —                             |
| [P08](P08-live-views.md)   | Live views and timer                     | todo   | P07        | —                             |
| [P09](P09-results.md)      | Results and standings                    | todo   | P08        | —                             |
| [P10](P10-export.md)       | Season export                            | todo   | P09        | —                             |
| [P11](P11-dry-run.md)      | Dry run and runbook                      | todo   | P10        | Yes: phones, testers          |

## Dependency graph

```text
P00 ─┬─ P01 ── P04 ── P05 ── P06 ─┐
     │                            ├── P07 ── P08 ── P09 ── P10 ── P11
     └─ P02 ── P03 ───────────────┘
```

After P00, the two tracks (`P01 → P06` and `P02 → P03`) can run in parallel. They join at P07.

## State machine

```text
todo ──► in_progress ──► review ──► done
  ▲           │             │
  │           ▼             │
  └──────── blocked ◄───────┘ (any state can go to blocked)
  ▲                         │
  └──── redo (organizer) ◄──┘
```

| Transition              | Who       | Rule                                                                                                                                  |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `todo → in_progress`    | agent     | Only when every dependency is `done`. Create branch `step/PNN-<slug>` from `main`. Set the status in this table in your first commit. |
| `in_progress → review`  | agent     | Every acceptance check in the step file passes and `pnpm check` is green. Open a PR titled `feat(pNN): …` (or `chore`/`docs`).        |
| `review → done`         | organizer | The PR is merged. The organizer (or the agent, when asked) sets `done` on `main`.                                                     |
| `any → blocked`         | agent     | Something only the organizer can do or decide (accounts, DNS, a rule question). Write the reason in the step's Log and stop.          |
| `blocked → in_progress` | agent     | The blocker is resolved (recorded in the Log).                                                                                        |
| `review/done → todo`    | organizer | Redo. The reason goes in the step's Log. The next agent starts from the Log.                                                          |

## How to work a step

1. Check this table: the step is `todo` (or `blocked` with the blocker resolved) and its dependencies are `done`.
2. Read [AGENTS.md](../../AGENTS.md), the step file, and everything under its **Read first**.
3. Build only what is in **Scope → In**. Put anything else in the **Log** as a follow-up.
4. Run every **Acceptance check**. Fix until they pass. If you changed dependencies, `pnpm security` must report nothing.
5. Append a dated line to the step's **Log**: what you did, decisions you made, follow-ups.
6. Set the status to `review` in this table, in the same PR as the code.

## How to assess a step

- Status `review`: read the PR and the step's Log; run the acceptance checks yourself; merge or send back with a Log line.
- Status `done`: the acceptance checks must still pass on `main`. If a later step broke one, that later step is not done.

## Step file template

Every step file has the same sections: **Goal · Depends on · Read first · Scope (In / Out) · Deliverables · Acceptance checks · Notes · Log**.
