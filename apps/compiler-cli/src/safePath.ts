//apps/compiler-cli/src/safePath.ts
import { normalize } from "node:path";

/**
 * Rejects a relative content path that escapes its root (`..` segments) before
 * it is normalized, because `normalize("a/../b")` collapses to `b` and would
 * hide the traversal. Split out of `commands.ts` so path discovery modules can
 * use it without pulling the engine module graph.
 */
export function safePath(file: string): string {
  // must check raw before normalize() collapses a/../b -> b
  if (file.split(/[/\\]+/).includes("..")) {
    throw new Error(`Path traversal detected: ${file}`);
  }
  const normalized = normalize(file);
  const segments = normalized.split(/[/\\]+/);
  if (segments.includes("..")) {
    throw new Error(`Path traversal detected: ${file}`);
  }
  return normalized;
}
