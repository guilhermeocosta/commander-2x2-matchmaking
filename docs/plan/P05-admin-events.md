# P05 · Admin login and events

## Goal

The organizer can log in, see the list of events, create one, and open its (still mostly empty) control panel.

## Depends on

P04.

## Read first

- [docs/architecture.md](../architecture.md): Routes, Identity and security.
- `src/db/schema.ts`, `src/db/queries.ts`.

## Scope

### In

- `src/lib/auth.ts`: `login(password)`, `logout()`, `isAdmin()`; httpOnly, secure, SameSite=Lax cookie signed with HMAC-SHA256 (`SESSION_SECRET`, Web Crypto), 12-hour expiry; constant-time password compare.
- `/admin/login` (pt-BR form), `/admin` (event list + "Novo evento" form: nome, data; rounds 3 and 50 minutes fixed), `/admin/e/[code]` (shell with the event header and empty sections: Jogadores, Rodadas, Classificação).
- Event code: 4 characters from an unambiguous alphabet (no 0/O/1/I/L), unique.
- Every admin page and Server Action checks `isAdmin()`; unauthenticated → redirect to `/admin/login`.
- Audit log entries for login and event creation.
- `.env.example`: `ADMIN_PASSWORD`, `SESSION_SECRET`.

### Out

- Players, rounds, timer, results.

## Deliverables

- Auth lib, three admin routes, Server Actions, audit writes.

## Acceptance checks

- `pnpm check` green.
- Wrong password shows an error in pt-BR; right password lands on `/admin`.
- Creating an event shows it in the list with its code; `/admin/e/[code]` opens.
- Visiting any `/admin` page without the cookie redirects to login; calling a Server Action without it fails.
- All copy pt-BR; dark theme only.

## Notes

- Keep `isAdmin()` the only gate, so accounts can replace it later.

## Log

- 2026-11-22: Started on `step/P05-admin-events` from `main`.
- 2026-11-22: Built `src/lib/session.ts` (pure HMAC-SHA256 tokens via Web Crypto, 12-hour expiry, canonical base64url check, constant-time password compare; unit-tested) and `src/lib/auth.ts` (server-only `login`, `logout`, `isAdmin`, `requireAdmin`; httpOnly, Secure, SameSite=Lax cookie `c2x2_admin`). Event codes come from `src/core/event-code.ts` (alphabet without 0/O/1/I/L); `createEventWithNewCode` retries on a unique violation. Routes `/admin/login`, `/admin`, `/admin/e/[code]`; Server Actions validate with Zod; audit entries `login`, `login_failed`, `event_created`. No new dependencies. Decisions:
  - Admin pages use `export const instant = false` and gate before rendering. `isAdmin()` reads `cookies()` before the env, otherwise `next build` prerendered `/admin` as a static, cacheable 307 (fixed). Under `next start` a logged-out visit gets the static root shell plus a streamed redirect (HTTP 200, no admin data in the body); `next dev` answers 307. A proxy could give a real 307 but would be a second gate.
  - `loginAction` and `logoutAction` don't call `isAdmin()` (login can't; logout is harmless).
  - Verified in the browser pane against `next start` with the Neon dev branch at 375 px: wrong password shows "Senha incorreta."; the organizer logged in and landed on `/admin`; creating "Teste P05" listed it as `Q278`; `/admin/e/Q278` opens; logged-out `/admin` and `/admin/e/TEST` end on login; a forged cookie is rejected. Not verified in the browser: submitting "Novo evento" after logging out in another tab (the action calls `isAdmin()` first and redirects).
  - Follow-ups: rate-limit failed logins; the `Q278` test event stays on the dev branch.
