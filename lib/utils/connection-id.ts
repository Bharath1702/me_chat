import { randomInt } from "node:crypto";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I / O
const ALPHANUM = `${LETTERS}23456789`; // no 0 / 1

function pick(alphabet: string, count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/**
 * Generates an ID like "AHN-7K2M" using a cryptographically secure RNG.
 * ~24^3 * 32^4 ≈ 1.4e10 combinations; uniqueness is enforced by the DB index.
 */
export function generateConnectionId(): string {
  return `${pick(LETTERS, 3)}-${pick(ALPHANUM, 4)}`;
}
