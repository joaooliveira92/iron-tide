import { existsSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { systemClock, type PersistenceClock } from "./clock.js";
import { readSaveMetadata } from "./fileDecode.js";
import type { PointerFile } from "./schemas.js";

export class RecoveryManager {
  static revert(
    saveDir: string,
    previousSaveId: string,
    clock: PersistenceClock = systemClock,
  ): boolean {
    const pointerPath = join(saveDir, "pointer.json");

    const metaPath = join(saveDir, previousSaveId, "metadata.json");
    const predecessor = existsSync(metaPath)
      ? readSaveMetadata(metaPath)?.previousSaveId
      : undefined;

    const pointerContent: PointerFile = {
      activeSaveId: previousSaveId,
      ...(predecessor !== undefined ? { previousSaveId: predecessor } : {}),
      recoveredAt: clock.nowIso(),
    };

    try {
      const tmpPath = `${pointerPath}.tmp`;
      writeFileSync(tmpPath, JSON.stringify(pointerContent, null, 2), "utf8");
      renameSync(tmpPath, pointerPath);
      return true;
    } catch {
      return false;
    }
  }
}

export const TEMP_SAVE_PREFIX = ".tmp_";
export const BACKUP_PREFIX = ".bak_";
export const MIGRATING_SUFFIX = ".migrating";
export const POINTER_TEMP_FILE = "pointer.json.tmp";

export function sweepStaleTemp(saveDir: string): void {
  if (!existsSync(saveDir)) return;
  for (const entry of readdirSync(saveDir, { withFileTypes: true })) {
    const stale = entry.isDirectory()
      ? entry.name.startsWith(TEMP_SAVE_PREFIX) || entry.name.endsWith(MIGRATING_SUFFIX)
      : entry.name === POINTER_TEMP_FILE;
    if (stale) rmSync(join(saveDir, entry.name), { recursive: true, force: true });
  }
}

export function cleanup(tempPath: string): void {
  if (existsSync(tempPath)) {
    rmSync(tempPath, { recursive: true, force: true });
  }
}
