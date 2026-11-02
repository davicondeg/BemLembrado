import { createHash, randomInt } from "node:crypto";

export function generateLinkCode(): string {
  return `APP-${randomInt(0, 1_000_000).toString().padStart(6, "0")}`;
}

export function hashLinkCode(code: string, pepper: string): string {
  return createHash("sha256").update(`${code.toUpperCase()}:${pepper}`).digest("hex");
}
