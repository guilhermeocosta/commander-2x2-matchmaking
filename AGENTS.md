# AGENTS.md

Guidance for coding agents (and humans) working in this repository. Keep it short; details live in the linked docs.

## What this is

The matchmaker for **Commander 2x2**, a two-versus-two Magic: The Gathering Commander format played in São Paulo. It runs events: players join from their phones, the app pairs Swiss rounds, runs the round timer, collects results and computes standings. This repo is **Phase 0**, a proof of concept for the 2026-12-12 event. Read [README.md](README.md) for the goals.

## Before you write code

1. Open [docs/plan/README.md](docs/plan/README.md). Work happens in **steps** (`P00`–`P11`) with a status table and a state machine. Follow its rules to pick, start, finish or redo a step.
2. Read your step's file (`docs/plan/PNN-*.md`) and every file listed under **Read first**.
3. Stay inside the step's scope. Anything else you notice goes in the step's **Log** as a follow-up, not in your diff.

## Commands

```bash
pnpm install         # pnpm only; Node version from .nvmrc
pnpm dev             # dev server at http://localhost:3000
pnpm typecheck       # next typegen + tsc
pnpm lint            # eslint, warnings fail
pnpm format          # prettier --write (format:check in CI)
pnpm lint:md         # markdownlint
pnpm test            # vitest
pnpm build           # next build
pnpm check           # all of the above, as CI runs them
pnpm security        # pnpm audit + osv-scanner + gitleaks (brew install osv-scanner gitleaks)
```

CI runs two workflows on every PR: `ci.yml` (typecheck, lint, format check, markdown lint, tests, build) and `security.yml` (gitleaks, `pnpm audit`, osv-scanner; also weekly). Run `pnpm check` before you open a PR, and `pnpm security` too when the PR touches dependencies.

## Conventions

- **Language:** all user-facing copy in Brazilian Portuguese (pt-BR). URLs, routes, file names, identifiers, DB tables and columns, code comments, docs in `docs/` and commit messages in English.
- **Domain words:** use the names in [CONTEXT.md](CONTEXT.md). A teammate is a `teammate` in code and a _dupla_ in copy, never a "partner" (Partner is a Magic keyword).
- **Theme:** dark only. There is one daisyUI theme, `c2x2-dark`, in `src/app/globals.css`. Never add a light theme, a theme toggle or `dark:` variants.
- **Styling:** daisyUI component classes (`card`, `btn`, `badge`, `table`) and Tailwind utilities. Theme colors are tokens; don't hardcode hex values in components.
- **Domain logic** (pairing, standings, results, export) lives in `src/core/` as pure TypeScript with **no imports from Next, React or the database**, and has Vitest tests next to it (`*.test.ts`).
- **Formatting:** Prettier with double quotes, semicolons, width 100, `es5` trailing commas. Don't hand-format; run `pnpm format`.
- **Dependencies:** add one only when a step calls for it or there is a clear reason; note it in the step's Log. Follow the dependency rules under **Security**.
- **Commits and PRs:** Conventional Commits. One branch and one PR per step: branch `step/PNN-<slug>`, PR title `feat(pNN): <summary>` (or `chore(pNN)` / `docs(pNN)`). PRs are squash-merged.

## Security

This is a public repo that will hold an admin password and a database. These rules are guardrails, not suggestions. If one blocks you, stop and set your step to `blocked` with the reason; never work around it.

### Secrets

- Never commit secrets, tokens, passwords or connection strings. Real values live only in Vercel env vars and your untracked `.env.local`. `.env.example` holds names and comments, never values.
- Don't read, print or log `.env*` files or secret values (the repo's `.claude/settings.json` denies reading them). Never paste a secret into a PR, a step Log, an issue or a test.
- Secrets are server-only: never put one in a `NEXT_PUBLIC_*` variable or import a secret-reading module from a Client Component. Use the `server-only` package in modules that read secrets.
- If you find a committed secret, stop and tell the organizer: it has to be rotated, not just deleted.

### Dependencies (supply chain)

- pnpm only. Never `npm install`, `npx` or `yarn` (denied in `.claude/settings.json`).
- Before adding a package: it must be needed by the step, maintained, widely used, and its latest release at least 3 days old. Prefer the platform or a few lines of code over a tiny package.
- Don't loosen `pnpm-workspace.yaml`: no `true` in `allowBuilds`, no lowering `minimumReleaseAge`, no new `trustPolicyExclude` or `minimumReleaseAgeExclude` entries, unless the organizer approves. Each exception needs a comment with its reason.
- If the install fails a supply-chain check, don't bypass it: pick an older version, wait, or ask.
- After any dependency change, run `pnpm security`; it must report nothing. Fix a vulnerable transitive dependency with a pinned `overrides` entry and a comment.

### CI and workflows

- Don't weaken `.github/workflows/*`: keep actions pinned to full commit SHAs (with the version in a comment), keep `permissions` read-only unless a job needs more, never use `pull_request_target`, never echo secrets.
- Never disable, skip or delete a check to make a PR green.

### Application code

- Every admin page and Server Action calls `isAdmin()` on the server. Never trust the client for who someone is.
- Validate every input from the browser (forms, Server Actions, route params) with Zod on the server.
- Players may only act on their own seat; enforce it on the server with their device token.
- Use the ORM's parameterized queries; never build SQL from strings.
- Treat external data (the roster JSON) as untrusted: parse it with Zod and fail safely.
- Don't log personal data or secrets. Error messages shown to users must not leak internals.

## Gotchas

- Next.js 16 has breaking changes from older versions. Read the bundled docs (see the block below) before using an API you're unsure of.
- `LayoutProps` / `PageProps` are generated types: `pnpm typecheck` runs `next typegen` first.
- Never commit `.env*` files except `.env.example`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
