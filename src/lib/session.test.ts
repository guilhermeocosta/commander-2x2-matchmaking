import { describe, expect, it } from "vitest";

import { passwordsMatch, SESSION_TTL_SEC, signSession, verifySession } from "./session";

const secret = "test-secret-that-is-at-least-32-characters-long";
const otherSecret = "another-test-secret-also-at-least-32-chars";
const now = Date.UTC(2026, 11, 12, 13, 0, 0);

describe("signSession / verifySession", () => {
  it("accepts a fresh token", async () => {
    const { token, expiresAt } = await signSession(secret, now);
    expect(token).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime()).toBe(now + SESSION_TTL_SEC * 1000);
    expect(await verifySession(token, secret, now)).toBe(true);
  });

  it("expires after 12 hours", async () => {
    const { token } = await signSession(secret, now);
    expect(await verifySession(token, secret, now + SESSION_TTL_SEC * 1000 - 1000)).toBe(true);
    expect(await verifySession(token, secret, now + SESSION_TTL_SEC * 1000)).toBe(false);
    expect(await verifySession(token, secret, now + 13 * 60 * 60 * 1000)).toBe(false);
  });

  it("rejects a token signed with another secret", async () => {
    const { token } = await signSession(otherSecret, now);
    expect(await verifySession(token, secret, now)).toBe(false);
  });

  it("rejects a token whose expiry was extended", async () => {
    const { token } = await signSession(secret, now);
    const [v, exp, sig] = token.split(".");
    const forged = [v, String(Number(exp) + 24 * 60 * 60), sig].join(".");
    expect(await verifySession(forged, secret, now + 20 * 60 * 60 * 1000)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { token } = await signSession(secret, now);
    const flip = (c: string) => (c === "A" ? "B" : "A");
    const mid = token.length - 10;
    const middle = token.slice(0, mid) + flip(token[mid]) + token.slice(mid + 1);
    expect(await verifySession(middle, secret, now)).toBe(false);
    for (const c of ["A", "B", "C", "D"]) {
      const lastChanged = token.slice(0, -1) + c;
      if (lastChanged !== token) expect(await verifySession(lastChanged, secret, now)).toBe(false);
    }
  });

  it("rejects malformed tokens", async () => {
    const { token } = await signSession(secret, now);
    const [, exp, sig] = token.split(".");
    for (const bad of [
      undefined,
      "",
      "garbage",
      `v2.${exp}.${sig}`,
      `v1.${exp}`,
      `v1.${exp}.${sig}.extra`,
      `v1.-1.${sig}`,
      `v1.${exp}.not+base64/`,
      "x".repeat(500),
    ]) {
      expect(await verifySession(bad, secret, now)).toBe(false);
    }
  });

  it("refuses short secrets", async () => {
    await expect(signSession("short", now)).rejects.toThrow();
    const { token } = await signSession(secret, now);
    expect(await verifySession(token, "", now)).toBe(false);
  });
});

describe("passwordsMatch", () => {
  it("matches only the exact password", async () => {
    expect(await passwordsMatch("correct horse", "correct horse")).toBe(true);
    expect(await passwordsMatch("correct hors", "correct horse")).toBe(false);
    expect(await passwordsMatch("Correct horse", "correct horse")).toBe(false);
    expect(await passwordsMatch("", "correct horse")).toBe(false);
  });

  it("never matches an unset password", async () => {
    expect(await passwordsMatch("", "")).toBe(false);
    expect(await passwordsMatch("anything", "")).toBe(false);
  });
});
