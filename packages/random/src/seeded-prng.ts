import { hashWithContext, sha256Hex } from "@bluewave/deterministic";

export function splitSeed(seed: string, domain: string): string {
  return hashWithContext(domain, seed);
}

export function drawFromSeed(seed: string): number {
  const hash = sha256Hex(seed);
  const intVal = parseInt(hash.slice(0, 8), 16);
  return intVal / 0x100000000;
}
