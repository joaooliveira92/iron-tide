// The desktop main process's stable atomic-write primitive (extracted from
// `sidecarStores.ts`): write a temp sibling, then `renameSync` over the target
// so a reader never sees a partial file. A failed write removes the temp and
// rethrows, so no `.tmp` is left behind (ENGINEERING-CONTRACT.md §Cancellation
// and cleanup, §Security).
import { renameSync, rmSync, writeFileSync } from "node:fs";

/**
 * Writes `contents` to `path` atomically. The temp file is `<path>.tmp`; on any
 * failure it is removed before the error propagates.
 */
export function atomicWrite(path: string, contents: string): void {
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, contents, "utf8");
    renameSync(tmp, path);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
}
