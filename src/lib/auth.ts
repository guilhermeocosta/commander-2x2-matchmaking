import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { MIN_SECRET_LENGTH, passwordsMatch, signSession, verifySession } from "./session";

/**
 * The single admin gate. Every admin page and Server Action goes through `isAdmin()` (or
 * `requireAdmin()`), so accounts can replace this module later without touching callers.
 * Reads `ADMIN_PASSWORD` and `SESSION_SECRET`; never logs or returns them.
 */

export const ADMIN_COOKIE = "c2x2_admin";
export const LOGIN_PATH = "/admin/login";

function sessionSecret(): string | undefined {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : undefined;
}

/**
 * Checks the password and, on success, sets the signed session cookie. Returns false (and sets
 * nothing) on a wrong password or when the server isn't configured. Server Actions only.
 */
export async function login(password: string): Promise<boolean> {
  const secret = sessionSecret();
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!secret || !(await passwordsMatch(password, expected))) return false;

  const { token, expiresAt } = await signSession(secret, Date.now());
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return true;
}

/** Clears the session cookie. Server Actions only. */
export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/** True when the request carries a valid, unexpired admin session. Memoized per request. */
export const isAdmin = cache(async (): Promise<boolean> => {
  // Read the cookie before anything else: it marks the caller as request-time, so Next never
  // prerenders an admin page (or its redirect) at build time, even when the env is unset there.
  const store = await cookies();
  // With Cache Components, a dev prerender can still reach the clock below after `cookies()`
  // and reports "blocking-prerender-current-time". `connection()` stops prerendering here, so
  // `Date.now()` only ever runs for a real request.
  await connection();
  const secret = sessionSecret();
  if (!secret) return false;
  return verifySession(store.get(ADMIN_COOKIE)?.value, secret, Date.now());
});

/** Redirects to the login page unless the request is from the admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect(LOGIN_PATH);
}
