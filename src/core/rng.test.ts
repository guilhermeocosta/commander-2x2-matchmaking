import { describe, expect, it } from "vitest";
import { createRng, randomInt, shuffle } from "./rng";

describe("createRng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, a);
    const seqB = Array.from({ length: 20 }, b);
    expect(seqA).toEqual(seqB);
  });

  it("gives a different sequence for a different seed", () => {
    expect(Array.from({ length: 5 }, createRng(1))).not.toEqual(
      Array.from({ length: 5 }, createRng(2))
    );
  });

  it("returns floats in [0, 1)", () => {
    const rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("is stable across runs (pinned values)", () => {
    const rng = createRng(0);
    expect([rng(), rng(), rng()]).toEqual([
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
  });

  it("rejects a non-finite seed", () => {
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
  });
});

describe("randomInt", () => {
  it("stays in [0, n)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const x = randomInt(rng, 5);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(5);
    }
  });
});

describe("shuffle", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("is deterministic for a seed", () => {
    expect(shuffle(items, createRng(9))).toEqual(shuffle(items, createRng(9)));
  });

  it("keeps every item and leaves the input unchanged", () => {
    const copy = items.slice();
    const out = shuffle(items, createRng(9));
    expect(items).toEqual(copy);
    expect(out.slice().sort()).toEqual(copy);
  });

  it("handles empty and single-item arrays", () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(["x"], createRng(1))).toEqual(["x"]);
  });
});
