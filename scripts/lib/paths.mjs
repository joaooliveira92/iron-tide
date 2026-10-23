import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function toPosixPath(value, pathApi = path) {
  return pathApi.sep === "\\" ? value.replace(/\\/gu, "/") : value;
}

export function repoRelativePath(root, absolute, pathApi = path) {
  const relative = toPosixPath(pathApi.relative(root, absolute), pathApi);
  if (relative === "") return ".";
  if (relative === ".." || relative.startsWith("../") || pathApi.isAbsolute(relative)) return null;
  return relative;
}

export function isEntryPoint(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return realpathSync.native(fileURLToPath(metaUrl)) === realpathSync.native(path.resolve(argv1));
  } catch {
    return false;
  }
}
