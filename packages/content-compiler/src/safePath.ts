import { normalize } from "node:path";

/**
 * Convert host path separators to `/`. Canonical content paths are
 * `/`-separated on every host so a path comparison, a diagnostic, or the
 * compiled surface never depends on the platform separator (determinism).
 */
export function toPosixPath(file: string): string {
  return file.split("\\").join("/");
}

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
  const normalized = normalize(file);
  const segments = normalized.split(/[/\\]+/);
  if (segments.includes("..")) {
    throw new Error(`Path traversal detected: ${file}`);
  }
  // Canonical content paths are `/`-separated on every host (determinism):
  // `normalize` yields `\` on Windows, which must never leak into a path
  // comparison, a diagnostic, or the compiled surface.
  return toPosixPath(normalized);
}
