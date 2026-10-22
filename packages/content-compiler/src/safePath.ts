import { normalize } from "node:path";

export function safePath(file: string): string {
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
