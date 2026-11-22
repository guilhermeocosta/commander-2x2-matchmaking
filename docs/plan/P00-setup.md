# P00 · Setup

## Goal

Set the stage for Phase 0. No features: a repo, a dark pt-BR shell page, tooling, CI, and the docs that let any agent pick up the next step without prior context.

## Depends on

Nothing.

## Read first

- The approved design doc (Claude Doc "Commander 2x2 Matchmaker — Design Doc"), summarized in [docs/rules.md](../rules.md) and [docs/architecture.md](../architecture.md).

## Scope

### In

- Public repo `guilhermeocosta/commander-2x2-matchmaking`.
- Next.js 16 scaffold (App Router, `src/`, TypeScript, Tailwind v4), daisyUI 5 with the single `c2x2-dark` theme, `<html lang="pt-BR">`.
- A placeholder home page in pt-BR.
- Tooling: ESLint (+ Prettier config), Prettier, markdownlint, Vitest, `pnpm check`, GitHub Actions CI, Renovate, `.nvmrc`, `.env.example`.
- Docs: `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/rules.md`, `docs/architecture.md`, `docs/plan/` (status table, state machine, P00–P11 specs).

### Out

- Any feature code: no database, no pairing, no routes beyond `/`.
- Vercel, Neon and the domain (P01).

## Deliverables

- The files above, on branch `step/P00-setup`, in one PR.

## Acceptance checks

- `pnpm check` passes locally and in CI.
- `pnpm dev`: `/` renders dark, in pt-BR, with no light-mode styles.
- Every step file P01–P11 exists and follows the template.

## Notes

- `pnpm typecheck` runs `next typegen` first, because `LayoutProps` is a generated type.
- `AGENTS.md` keeps the `nextjs-agent-rules` block that `next dev` re-adds.

## Log

- 2026-11-22: Repo created and scaffolded; tooling, CI and docs written. Status → review.
