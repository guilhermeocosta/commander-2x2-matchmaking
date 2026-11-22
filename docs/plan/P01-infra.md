# P01 · Infra and deploy

## Goal

The app is live at `https://matchmaking.commander2x2.org`, deployed from `main` by Vercel, with a Neon Postgres database reachable from the app.

## Depends on

P00.

## Read first

- [docs/architecture.md](../architecture.md): Stack, Environment variables.

## Scope

### In

- Organizer actions (the agent writes exact click-by-click instructions in the PR description and sets the step to `blocked` until they're done):
  1. Vercel dashboard → Add New → Project → import `guilhermeocosta/commander-2x2-matchmaking` (framework: Next.js, defaults).
  2. Project → Storage → Create → Neon (free plan) → connect to the project for all environments. This injects `DATABASE_URL`.
  3. Project → Settings → Domains → add `matchmaking.commander2x2.org`.
  4. Cloudflare → `commander2x2.org` → DNS → add `CNAME matchmaking → cname.vercel-dns.com`, proxy status **DNS only**.
- Code: `GET /api/health` returning `{ ok: true, db: "up" }` after `select 1`, or HTTP 503 with `db: "down"`. Use `@neondatabase/serverless` directly (no ORM yet).
- `.env.example` documents `DATABASE_URL`.

### Out

- Schema, migrations, ORM (P04). Admin secrets (P05).

## Deliverables

- `src/app/api/health/route.ts`.
- PR description with the organizer's checklist.

## Acceptance checks

- `pnpm check` green.
- `https://matchmaking.commander2x2.org/` shows the dark placeholder page over HTTPS.
- `https://matchmaking.commander2x2.org/api/health` returns `{ "ok": true, "db": "up" }`.
- A PR gets a Vercel preview deployment.

## Notes

- Vercel Hobby is for non-commercial use; the app itself is not monetized.
- The health route must not be cached (`dynamic` / `no-store`; check the Next.js 16 docs in `node_modules/next/dist/docs/`).

## Log

- 2026-11-22: Added `GET /api/health` (`src/app/api/health/route.ts`) and `src/lib/db.ts` (`server-only`, returns a Neon `sql` tag or null when `DATABASE_URL` is unset). Cache Components is on, so the route calls `await connection()` instead of `export const dynamic` and sends `Cache-Control: no-store`; the build lists it as dynamic (`ƒ`). DB errors are swallowed, never logged or returned. New deps (exact pins): `@neondatabase/serverless@1.2.1` (DB driver named in the spec), `server-only@0.0.1` (guards the secret-reading module); `pnpm security` clean. Checked locally with no `DATABASE_URL`: HTTP 503 `{"ok":false,"db":"down"}`. `.env.example` and the env table in `docs/architecture.md` now say `DATABASE_URL` is used from P01.
- 2026-11-22: **Blocked**: waiting for the organizer's Vercel import, Neon integration, Vercel domain and Cloudflare CNAME (checklist in the PR). Then the agent checks the production URL and `/api/health` and sets `review`.
- 2026-11-22: Organizer set up Vercel, Neon (Free, `sa-east-1`, preview branches on, prefix `DATABASE`), function region `gru1` and the Cloudflare record. Checked: `https://matchmaking.commander2x2.org/` serves the placeholder over HTTPS from `gru1`. Still open: the record resolves to Cloudflare IPs (`server: cloudflare`), so it is proxied, not DNS only; `/api/health` is 404 on production until this PR merges to `main`.
- 2026-11-22: Organizer switched the record to DNS only. Checked: `matchmaking` CNAME → `cname.vercel-dns.com`; the domain is served by Vercel from `gru1` with its own Let's Encrypt certificate; the PR got a Vercel preview deployment; CI and Security green. Blocker resolved, status `review`. The organizer chose to merge before checking `/api/health` (previews sit behind Vercel login), so `{"ok":true,"db":"up"}` is checked on production right after the merge.
