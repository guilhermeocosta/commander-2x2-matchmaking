import { describe, expect, it } from "vitest";

import {
  EVENT_CODE_ALPHABET,
  EVENT_CODE_LENGTH,
  generateEventCode,
  isGeneratedEventCode,
} from "./event-code";
import { createRng } from "./rng";

describe("event codes", () => {
  it("leaves out ambiguous characters", () => {
    for (const c of "0O1IL") expect(EVENT_CODE_ALPHABET).not.toContain(c);
    expect(new Set(EVENT_CODE_ALPHABET).size).toBe(EVENT_CODE_ALPHABET.length);
  });

  it("generates 4-character codes from the alphabet", () => {
    const rng = createRng(42);
    const randomInt = (max: number) => Math.floor(rng() * max);
    for (let i = 0; i < 500; i++) {
      const code = generateEventCode(randomInt);
      expect(code).toHaveLength(EVENT_CODE_LENGTH);
      expect(isGeneratedEventCode(code)).toBe(true);
      // Also satisfies the database check (events_code_format).
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
    }
  });

  it("uses every index of the alphabet", () => {
    expect(generateEventCode(() => 0)).toBe("AAAA");
    expect(generateEventCode((max) => max - 1)).toBe("9999");
  });

  it("rejects codes with ambiguous or lowercase characters", () => {
    for (const bad of ["AB0C", "ABOC", "AB1C", "ABIC", "ABLC", "abcd", "ABC", "ABCDE"]) {
      expect(isGeneratedEventCode(bad)).toBe(false);
    }
  });
});
