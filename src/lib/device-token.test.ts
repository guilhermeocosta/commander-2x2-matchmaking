import { describe, expect, it } from "vitest";

import { deviceCookieName, hashDeviceToken, isDeviceToken, newDeviceToken } from "./device-token";

describe("device tokens", () => {
  it("are 43-character base64url strings, different every time", () => {
    const a = newDeviceToken();
    const b = newDeviceToken();
    expect(isDeviceToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("rejects anything else", () => {
    expect(isDeviceToken(undefined)).toBe(false);
    expect(isDeviceToken("")).toBe(false);
    expect(isDeviceToken("a".repeat(42))).toBe(false);
    expect(isDeviceToken("a".repeat(42) + "+")).toBe(false);
  });

  it("hash to 64 hex characters, deterministically", () => {
    const token = newDeviceToken();
    expect(hashDeviceToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeviceToken(token)).toBe(hashDeviceToken(token));
    expect(hashDeviceToken(token)).not.toBe(hashDeviceToken(newDeviceToken()));
  });

  it("use one cookie per event", () => {
    expect(deviceCookieName("TEST")).toBe("c2x2_p_TEST");
  });
});
