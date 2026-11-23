/**
 * Seeded pseudo-random numbers, so every pairing and tiebreak can be reproduced from the
 * event's stored seed.
 */

/** Returns a float in [0, 1). */
export type Rng = () => number;

/**
 * mulberry32: a small, fast 32-bit PRNG. Same seed, same sequence, on every platform.
 * The seed is reduced to an unsigned 32-bit integer.
 */
export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) throw new RangeError("seed must be a finite number");
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, n). */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates shuffle. Returns a new array; the input is not changed. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
