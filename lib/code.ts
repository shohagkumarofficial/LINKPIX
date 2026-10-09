import { randomInt } from "node:crypto";

// No 0/o/1/l/i so codes are easy to read out loud and type by hand.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const RESERVED = new Set([
  "api", "admin", "app", "static", "_next", "favicon", "robots", "sitemap",
  "health", "setup", "login", "logout", "assets", "public", "bot", "stats",
]);

export const CODE_PATTERN = /^[a-z0-9_-]{3,32}$/;

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function isReservedCode(code: string): boolean {
  return RESERVED.has(code);
}
