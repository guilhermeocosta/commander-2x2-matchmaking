/**
 * Player device tokens. A token is 32 random bytes (base64url) kept only in the player's
 * httpOnly cookie; the database stores its SHA-256 (hex), so a leaked row can't act as the
 * player. Pure functions, unit-tested; `src/lib/player-session.ts` wires them to cookies.
 */
import { createHash, randomBytes } from "node:crypto";

/** The token as it appears in a cookie or a reissue link. */
export const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isDeviceToken(value: unknown): value is string {
  return typeof value === "string" && DEVICE_TOKEN_PATTERN.test(value);
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** One cookie per event, so joining a second event doesn't replace the first. */
export function deviceCookieName(eventCode: string): string {
  return `c2x2_p_${eventCode}`;
}
