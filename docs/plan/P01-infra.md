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
