import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { SaveMetadataSchema, type PointerFile } from "./schemas.js";

export class RecoveryManager {
  static revert(saveDir: string, previousSaveId: string): boolean {
    const pointerPath = join(saveDir, "pointer.json");

    let predecessor: string | undefined;
    try {
      const metaPath = join(saveDir, previousSaveId, "metadata.json");
      if (existsSync(metaPath)) {
        const meta = Schema.decodeUnknownSync(SaveMetadataSchema)(
          JSON.parse(readFileSync(metaPath, "utf8")),
        );
        predecessor = meta.previousSaveId;
      }
    } catch {
      predecessor = undefined;
    }

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
