/**
 * Signed admin session tokens and constant-time password comparison. Pure functions: the secret
 * and the clock are passed in, so this module reads no env vars and is unit-tested directly.
 * `src/lib/auth.ts` wires it to cookies and `SESSION_SECRET`.
 *
 * Token format: `v1.<expiresAtSeconds>.<base64url HMAC-SHA256("v1.admin.<expiresAtSeconds>")>`.
 */
import { timingSafeEqual } from "node:crypto";

export const SESSION_TTL_SEC = 12 * 60 * 60;
/** Shorter secrets are refused, so a weak or empty `SESSION_SECRET` can't sign sessions. */
export const MIN_SECRET_LENGTH = 32;

const VERSION = "v1";
const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

function signingInput(expiresAt: number): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${VERSION}.admin.${expiresAt}`);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error("Session secret is too short");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** A token valid from `nowMs` for `ttlSec` seconds. */
export async function signSession(
  secret: string,
  nowMs: number,
  ttlSec: number = SESSION_TTL_SEC
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = Math.floor(nowMs / 1000) + ttlSec;
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, signingInput(expiresAt));
  return {
    token: `${VERSION}.${expiresAt}.${toBase64Url(signature)}`,
    expiresAt: new Date(expiresAt * 1000),
  };
}

/** True only for an untampered, unexpired token signed with `secret`. Never throws. */
export async function verifySession(
  token: string | undefined,
  secret: string,
  nowMs: number
): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresRaw, signatureRaw] = parts;
  if (version !== VERSION || !/^\d{1,12}$/.test(expiresRaw)) return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(signatureRaw)) return false;
  const expiresAt = Number(expiresRaw);
  if (expiresAt * 1000 <= nowMs) return false;
  try {
    const key = await hmacKey(secret);
    const signature = Buffer.from(signatureRaw, "base64url");
    // Reject non-canonical encodings (the last character carries unused bits).
    if (signature.toString("base64url") !== signatureRaw) return false;
    // crypto.subtle.verify compares in constant time.
    return await crypto.subtle.verify("HMAC", key, signature, signingInput(expiresAt));
  } catch {
    return false;
  }
}

/**
 * Compares two passwords in constant time. Both are hashed first so the comparison doesn't leak
 * the expected length either. An empty expected password never matches.
 */
export async function passwordsMatch(given: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(given)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}
