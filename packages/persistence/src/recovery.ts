import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSaveMetadata } from "./fileDecode.js";
import type { PointerFile } from "./schemas.js";

export class RecoveryManager {
  static revert(saveDir: string, previousSaveId: string): boolean {
    const pointerPath = join(saveDir, "pointer.json");

    const metaPath = join(saveDir, previousSaveId, "metadata.json");
    const predecessor = existsSync(metaPath)
      ? readSaveMetadata(metaPath)?.previousSaveId
      : undefined;

    const pointerContent: PointerFile = {
      activeSaveId: previousSaveId,
      ...(predecessor !== undefined ? { previousSaveId: predecessor } : {}),
      recoveredAt: new Date().toISOString(),
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

export function cleanup(tempPath: string): void {
  if (existsSync(tempPath)) {
    rmSync(tempPath, { recursive: true, force: true });
  }
}
