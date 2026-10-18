import { normalize } from "node:path";

/**
 * Rejects a relative content path that escapes its root (`..` segments) before
 * it is normalized, because `normalize("a/../b")` collapses to `b` and would
 * hide the traversal. Shared by the compiler CLI and the content discovery
 * modules so a traversal cannot reach the compiler through either surface.
 */
export function safePath(file: string): string {
  // must check raw before normalize() collapses a/../b -> b
  if (file.split(/[/\\]+/).includes("..")) {
    throw new Error(`Path traversal detected: ${file}`);
  }
  const normalized = normalize(file).replaceAll("\\", "/");
  const segments = normalized.split(/[/\\]+/);
  if (segments.includes("..")) {
    throw new Error(`Path traversal detected: ${file}`);
  }
  return normalized;
}
