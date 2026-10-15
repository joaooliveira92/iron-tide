import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { SaveMetadataSchema, type PointerFile } from "./schemas.js";

export class RecoveryManager {
  /**
   * Restores the pointer to an earlier save, preserving the recovered save's
   * own predecessor (from its metadata) so the chain survives a revert (TODO
   * #8). If that metadata is missing/corrupt the predecessor is dropped — the
   * recovered save becomes the chain head.
   */
  static revert(saveDir: string, previousSaveId: string): boolean {
    const pointerPath = join(saveDir, "pointer.json");

    // Reconstruct the chain from the target save's persisted predecessor. If we
    // cannot read it cleanly we proceed without a predecessor (documented
    // chain-truncation on corrupt metadata) rather than fabricating one.
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
