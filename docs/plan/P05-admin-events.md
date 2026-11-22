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
