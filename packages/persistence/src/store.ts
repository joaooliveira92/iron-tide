import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import type { CampaignState } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex, verifyEnvelope } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema } from "effect";
import { CompatibilityChecker, CURRENT_COMPATIBILITY_VERSION } from "./compatibility.js";
import {
  CANCELLED_CODE,
  CORRUPT_SAVE_CODE,
  MISSING_SAVE_CODE,
  UNSIGNED_SAVE_CODE,
} from "./errors.js";
import { cleanup } from "./recovery.js";
import {
  PointerFileSchema,
  SaveHeaderSchema,
  SaveMetadataSchema,
  SigFileSchema,
  StorableCampaignStateSchema,
  type PointerFile,
  type SaveMetadata,
  type SigFile,
} from "./schemas.js";
import {
  fromStorableSnapshot,
  type StorableCampaignSnapshot,
  toStorableSnapshot,
} from "./snapshotSerialization.js";

export {
  CANCELLED_CODE,
  CORRUPT_SAVE_CODE,
  MISSING_SAVE_CODE,
  UNSIGNED_SAVE_CODE,
} from "./errors.js";

export type { SaveMetadata } from "./schemas.js";

export interface SaveResult {
  savePath: string;
  hash: string;
  metadata: SaveMetadata;
}

const SAVE_ID_PATTERN = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidSaveId(saveId: string): boolean {
  return SAVE_ID_PATTERN.test(saveId);
}

function isContainedIn(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function createAbortError(): Error {
  const error = new Error("Save operation was cancelled");
  error.name = "AbortError";
  return error;
}

export interface SaveExtras {
  readonly monthInput?: unknown;
}

export type MonthInputLoad =
  | { readonly status: "absent" }
  | { readonly status: "present"; readonly value: unknown }
  | { readonly status: "corrupt" };

const MONTH_INPUT_FILE = "month-input.json";

export class SaveStore {
  constructor(
    private readonly currentCompatibilityVersion: string = CURRENT_COMPATIBILITY_VERSION,
  ) {}

  save(
    state: CampaignState,
    saveDir: string,
    signal?: AbortSignal,
    extras: SaveExtras = {},
  ): SaveResult {
    if (signal?.aborted) {
      throw createAbortError();
    }

    const saveId = `${Date.now()}-${randomUUID()}`;
    const savePath = join(saveDir, saveId);
    const tmpDir = join(saveDir, `.tmp_${saveId}`);

    const { rawHash: _rh, ...stateForHash } = state;
    const storableState = { ...state, snapshot: toStorableSnapshot(state.snapshot) };
    const serialized = canonicalSerialize(storableState);
    const stateHash = sha256Hex(canonicalSerialize(stateForHash));
    const serializedHash = sha256Hex(serialized);
    const snapshotHash = sha256Hex(canonicalSerialize(toStorableSnapshot(state.snapshot)));
    const previousSaveId = this.getActiveSaveId(saveDir) ?? undefined;
    const monthInput =
      extras.monthInput === undefined ? undefined : canonicalSerialize(extras.monthInput);

    const sig: SigFile = {
      serializedHash,
      stateHash,
      compatibilityVersion: state.snapshot.compatibilityVersion,
    };
    const metadata: SaveMetadata = {
      saveId,
      previousSaveId,
      timestamp: new Date().toISOString(),
      turnNumber: state.snapshot.turnNumber,
      campaignId: state.snapshot.campaignId,
      snapshotHash,
      compatibilityVersion: state.snapshot.compatibilityVersion,
      contentArtifactHash: serializedHash,
      campaignName: state.snapshot.campaignId,
      nationId: (() => {
        const slot = state.snapshot.slots.find((s) => s.type === "playable");
        return (slot ?? state.snapshot.slots[0])?.nationId;
      })(),
      campaignDate: (() => {
        const totalMonths = state.snapshot.startMonth - 1 + state.snapshot.turnNumber;
        const year = state.snapshot.startYear + Math.floor(totalMonths / 12);
        const month = (totalMonths % 12) + 1;
        return { year, month };
      })(),
      ...(monthInput === undefined ? {} : { monthInputHash: sha256Hex(monthInput) }),
    };

    let published = false;
    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(join(tmpDir, "campaign.json"), serialized, "utf8");
      writeFileSync(join(tmpDir, "campaign.sig.json"), JSON.stringify(sig, null, 2), "utf8");
      writeFileSync(join(tmpDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
      if (monthInput !== undefined)
        writeFileSync(join(tmpDir, MONTH_INPUT_FILE), monthInput, "utf8");

      if (signal?.aborted) {
        cleanup(tmpDir);
        throw createAbortError();
      }

      renameSync(tmpDir, savePath);
      published = true;

      if (signal?.aborted) {
        rmSync(savePath, { recursive: true, force: true });
        throw createAbortError();
      }

      updatePointer(saveDir, saveId, previousSaveId);

      return { savePath, hash: stateHash, metadata };
    } catch (err) {
      cleanup(tmpDir);
      if (published && existsSync(savePath)) {
        rmSync(savePath, { recursive: true, force: true });
      }
      throw err;
    }
  }

  load(
    saveDir: string,
    diagnostics: DiagnosticCollector,
    signal?: AbortSignal,
  ): CampaignState | null {
    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    if (!existsSync(saveDir)) {
      diagnostics.addError(MISSING_SAVE_CODE, `Save directory not found: ${saveDir}`, {
        stage: "persistence.load",
      });
      return null;
    }

    const pointerPath = join(saveDir, "pointer.json");
    if (!existsSync(pointerPath)) {
      diagnostics.addError(
        MISSING_SAVE_CODE,
        `No pointer file found in save directory: ${saveDir}`,
        {
          stage: "persistence.load",
        },
      );
      return null;
    }

    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    let pointer: PointerFile;
    try {
      pointer = Schema.decodeUnknownSync(PointerFileSchema)(
        JSON.parse(readFileSync(pointerPath, "utf8")),
      );
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Pointer file is corrupt or unreadable", {
        stage: "persistence.load",
      });
      return null;
    }

    return this.loadById(saveDir, pointer.activeSaveId, diagnostics, signal);
  }

  loadMonthInput(
    saveDir: string,
    saveId: string,
    diagnostics: DiagnosticCollector,
  ): MonthInputLoad {
    const stage = { stage: "persistence.loadMonthInput" };
    if (!isValidSaveId(saveId)) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save id is not a valid identifier", stage);
      return { status: "corrupt" };
    }
    const savePath = join(saveDir, saveId);
    if (!isContainedIn(saveDir, savePath)) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save id escapes the save directory", stage);
      return { status: "corrupt" };
    }
    let metadata: SaveMetadata;
    try {
      metadata = Schema.decodeUnknownSync(SaveMetadataSchema)(
        JSON.parse(readFileSync(join(savePath, "metadata.json"), "utf8")),
      );
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, `Save ${saveId} has no readable metadata`, stage);
      return { status: "corrupt" };
    }
    if (metadata.monthInputHash === undefined) return { status: "absent" };
    let text: string;
    try {
      text = readFileSync(join(savePath, MONTH_INPUT_FILE), "utf8");
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, `Save ${saveId} lost its month input`, stage);
      return { status: "corrupt" };
    }
    if (sha256Hex(text) !== metadata.monthInputHash) {
      diagnostics.addError(
        CORRUPT_SAVE_CODE,
        `Save ${saveId} month input does not match its hash`,
        stage,
      );
      return { status: "corrupt" };
    }
    try {
      return { status: "present", value: JSON.parse(text) as unknown };
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, `Save ${saveId} month input is not JSON`, stage);
      return { status: "corrupt" };
    }
  }

  loadById(
    saveDir: string,
    saveId: string,
    diagnostics: DiagnosticCollector,
    signal?: AbortSignal,
  ): CampaignState | null {
    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    if (!isValidSaveId(saveId)) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save id is not a valid identifier", {
        stage: "persistence.load",
      });
      return null;
    }

    if (!existsSync(saveDir)) {
      diagnostics.addError(MISSING_SAVE_CODE, `Save directory not found: ${saveDir}`, {
        stage: "persistence.load",
      });
      return null;
    }

    const savePath = join(saveDir, saveId);
    if (!isContainedIn(saveDir, savePath)) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save id escapes the save directory", {
        stage: "persistence.load",
      });
      return null;
    }

    const campaignPath = join(savePath, "campaign.json");
    const sigPath = join(savePath, "campaign.sig.json");

    if (!existsSync(campaignPath)) {
      diagnostics.addError(CORRUPT_SAVE_CODE, `Save data file not found: ${campaignPath}`, {
        stage: "persistence.load",
      });
      return null;
    }

    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    let campaignJson: string;
    try {
      campaignJson = readFileSync(campaignPath, "utf8");
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Failed to read save data file", {
        stage: "persistence.load",
      });
      return null;
    }

    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(campaignJson);
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save data file contains invalid JSON", {
        stage: "persistence.load",
      });
      return null;
    }

    const headerResult = Schema.decodeUnknownResult(SaveHeaderSchema)(raw);
    if (!Result.isSuccess(headerResult)) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save data is missing required fields", {
        stage: "persistence.load",
      });
      return null;
    }

    if (
      !CompatibilityChecker.check(
        headerResult.success.snapshot.compatibilityVersion,
        diagnostics,
        this.currentCompatibilityVersion,
      )
    ) {
      return null;
    }

    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    const parsedResult = Schema.decodeUnknownResult(StorableCampaignStateSchema)(raw);
    if (!Result.isSuccess(parsedResult)) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save data is structurally invalid", {
        stage: "persistence.load",
      });
      return null;
    }

    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    let state: CampaignState;
    try {
      state = {
        ...parsedResult.success,
        snapshot: fromStorableSnapshot(
          parsedResult.success.snapshot as unknown as StorableCampaignSnapshot,
        ),
      };
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save data snapshot is malformed", {
        stage: "persistence.load",
      });
      return null;
    }

    if (signal?.aborted) {
      diagnostics.addError(CANCELLED_CODE, "Load operation was cancelled", {
        stage: "persistence.load",
      });
      return null;
    }

    const { rawHash: _rawHash, ...stateForHash } = state;
    const computedRawHash = sha256Hex(canonicalSerialize(stateForHash));
    if (computedRawHash !== state.rawHash) {
      diagnostics.addError(
        CORRUPT_SAVE_CODE,
        "Save data hash mismatch: content has been modified",
        {
          stage: "persistence.load",
        },
      );
      return null;
    }

    if (!this.validateSignature(sigPath, sha256Hex(campaignJson), state, diagnostics)) {
      return null;
    }

    if (!verifyEnvelope(state["envelope"], state["snapshot"])) {
      diagnostics.addError(
        CORRUPT_SAVE_CODE,
        "Save envelope verification failed: snapshot does not match envelope",
        {
          stage: "persistence.load",
        },
      );
      return null;
    }

    return state;
  }

  private validateSignature(
    sigPath: string,
    rawSerializedHash: string,
    state: CampaignState,
    diagnostics: DiagnosticCollector,
  ): boolean {
    if (!existsSync(sigPath)) {
      diagnostics.addWarning(
        UNSIGNED_SAVE_CODE,
        "Save has no signature file; loaded as legacy with no independent on-disk tamper verification",
        { stage: "persistence.load" },
      );
      return true;
    }

    let sig: SigFile;
    try {
      sig = Schema.decodeUnknownSync(SigFileSchema)(JSON.parse(readFileSync(sigPath, "utf8")));
    } catch {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save signature file is invalid", {
        stage: "persistence.load",
      });
      return false;
    }
    if (sig.serializedHash !== rawSerializedHash) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save signature does not match serialized content", {
        stage: "persistence.load",
      });
      return false;
    }
    if (sig.stateHash !== state.rawHash) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save signature does not match state", {
        stage: "persistence.load",
      });
      return false;
    }
    if (sig.compatibilityVersion !== state.snapshot.compatibilityVersion) {
      diagnostics.addError(CORRUPT_SAVE_CODE, "Save signature version does not match state", {
        stage: "persistence.load",
      });
      return false;
    }
    return true;
  }

  list(saveDir: string): SaveMetadata[] {
    if (!existsSync(saveDir)) {
      return [];
    }

    const entries = readdirSync(saveDir, { withFileTypes: true });
    const saves: SaveMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirName = entry.name;
      if (dirName.startsWith(".tmp_")) continue;

      const metaPath = join(saveDir, dirName, "metadata.json");
      const sigPath = join(saveDir, dirName, "campaign.sig.json");

      if (existsSync(metaPath)) {
        try {
          const meta = Schema.decodeUnknownSync(SaveMetadataSchema)(
            JSON.parse(readFileSync(metaPath, "utf8")),
          );
          saves.push(meta);
          continue;
        } catch {}
      }

      if (existsSync(sigPath)) {
        try {
          const sig = Schema.decodeUnknownSync(SigFileSchema)(
            JSON.parse(readFileSync(sigPath, "utf8")),
          );
          saves.push({
            saveId: dirName,
            timestamp: "",
            turnNumber: 0,
            campaignId: "",
            snapshotHash: "",
            compatibilityVersion: sig.compatibilityVersion,
            contentArtifactHash: sig.serializedHash,
          });
        } catch {}
      }
    }

    const chainRank = new Map<string, number>();
    const activeSaveId = this.getActiveSaveId(saveDir);
    if (activeSaveId !== null) chainRank.set(activeSaveId, 0);
    const previousSaveId = this.getPreviousSaveId(saveDir);
    if (previousSaveId !== null && !chainRank.has(previousSaveId)) chainRank.set(previousSaveId, 1);

    saves.sort((a, b) => {
      const byTimestamp = b.timestamp.localeCompare(a.timestamp);
      if (byTimestamp !== 0) return byTimestamp;
      const byChain = (chainRank.get(a.saveId) ?? 2) - (chainRank.get(b.saveId) ?? 2);
      if (byChain !== 0) return byChain;
      return b.saveId.localeCompare(a.saveId);
    });
    return saves;
  }

  isCurrent(state: CampaignState, saveDir: string): boolean {
    try {
      const activeId = this.getActiveSaveId(saveDir);
      if (activeId === null) return false;
      const active = this.list(saveDir).find((save) => save.saveId === activeId);
      if (active === undefined) return false;
      const storable = { ...state, snapshot: toStorableSnapshot(state.snapshot) };
      return active.contentArtifactHash === sha256Hex(canonicalSerialize(storable));
    } catch {
      return false;
    }
  }

  getActiveSaveId(saveDir: string): string | null {
    const pointerPath = join(saveDir, "pointer.json");
    if (!existsSync(pointerPath)) return null;
    try {
      const pointer = Schema.decodeUnknownSync(PointerFileSchema)(
        JSON.parse(readFileSync(pointerPath, "utf8")),
      );
      return pointer.activeSaveId;
    } catch {
      return null;
    }
  }

  getPreviousSaveId(saveDir: string): string | null {
    const pointerPath = join(saveDir, "pointer.json");
    if (!existsSync(pointerPath)) return null;
    try {
      const pointer = Schema.decodeUnknownSync(PointerFileSchema)(
        JSON.parse(readFileSync(pointerPath, "utf8")),
      );
      return pointer.previousSaveId ?? null;
    } catch {
      return null;
    }
  }
}

function updatePointer(saveDir: string, activeSaveId: string, previousSaveId?: string): void {
  const pointerPath = join(saveDir, "pointer.json");
  const pointer: PointerFile = {
    activeSaveId,
    ...(previousSaveId !== undefined ? { previousSaveId } : {}),
  };
  const tmpPath = `${pointerPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(pointer, null, 2), "utf8");
  renameSync(tmpPath, pointerPath);
}
