/**
 * Event codes: what players type to join. Four characters from an alphabet without the
 * look-alikes 0/O, 1/I/L, so a code read off a projector is typed right the first time.
 */

export const EVENT_CODE_LENGTH = 4;
export const EVENT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * A random code. `randomInt(max)` must return an integer in `[0, max)`; pass a CSPRNG
 * (e.g. `node:crypto` `randomInt`) in production and a seeded one in tests.
 */
export function generateEventCode(randomInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < EVENT_CODE_LENGTH; i++) {
    code += EVENT_CODE_ALPHABET[randomInt(EVENT_CODE_ALPHABET.length)];
  }
  return code;
}

/** True for a code this module could have generated. */
export function isGeneratedEventCode(code: string): boolean {
  return new RegExp(`^[${EVENT_CODE_ALPHABET}]{${EVENT_CODE_LENGTH}}$`).test(code);
}
