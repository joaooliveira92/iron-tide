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
import {
  canonicalSerialize,
  compareCodePoints,
  sha256Hex,
  verifyEnvelope,
} from "@bluewave/deterministic";
import type { Diagnostic } from "@bluewave/diagnostics";
import { Effect, Result, Schema } from "effect";
import { CompatibilityChecker, CURRENT_COMPATIBILITY_VERSION } from "./compatibility.js";
import {
  PersistenceCancelledError,
  PersistenceCompatibilityMismatchError,
  PersistenceCorruptSaveError,
  PersistenceMissingSaveError,
  PersistenceUnsignedSaveError,
} from "./errors.js";
import { readPointerFile, readSaveMetadata, readSigFile } from "./fileDecode.js";
import { cleanup } from "./recovery.js";
import {
  decodeStorableCampaignState,
  SaveHeaderSchema,
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
  | { readonly status: "present"; readonly value: unknown };

export interface LoadedSave {
  readonly state: CampaignState;
  readonly warnings: readonly Diagnostic[];
}

export type LoadFailure =
  | PersistenceCorruptSaveError
  | PersistenceMissingSaveError
  | PersistenceCancelledError
  | PersistenceCompatibilityMismatchError;

const MONTH_INPUT_FILE = "month-input.json";
const LOAD_STAGE = "persistence.load";
const MONTH_INPUT_STAGE = "persistence.loadMonthInput";

function corruptSave(message: string): PersistenceCorruptSaveError {
  return new PersistenceCorruptSaveError({ message, stage: LOAD_STAGE });
}

function missingSave(message: string): PersistenceMissingSaveError {
  return new PersistenceMissingSaveError({ message, stage: LOAD_STAGE });
}

function cancelledLoad(): PersistenceCancelledError {
  return new PersistenceCancelledError({
    message: "Load operation was cancelled",
    stage: LOAD_STAGE,
  });
}

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

  load(saveDir: string, signal?: AbortSignal): Effect.Effect<LoadedSave, LoadFailure> {
    const currentVersion = this.currentCompatibilityVersion;
    return Effect.suspend(() => Effect.fromResult(loadResult(saveDir, currentVersion, signal)));
  }

  loadMonthInput(
    saveDir: string,
    saveId: string,
  ): Effect.Effect<MonthInputLoad, PersistenceCorruptSaveError> {
    return Effect.suspend(() => Effect.fromResult(loadMonthInputResult(saveDir, saveId)));
  }

  loadById(
    saveDir: string,
    saveId: string,
    signal?: AbortSignal,
  ): Effect.Effect<LoadedSave, LoadFailure> {
    const currentVersion = this.currentCompatibilityVersion;
    return Effect.suspend(() =>
      Effect.fromResult(loadByIdResult(saveDir, saveId, currentVersion, signal)),
    );
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

      const meta = existsSync(metaPath) ? readSaveMetadata(metaPath) : null;
      if (meta !== null) {
        saves.push(meta);
        continue;
      }

      const sig = existsSync(sigPath) ? readSigFile(sigPath) : null;
      if (sig !== null) {
        saves.push({
          saveId: dirName,
          timestamp: "",
          turnNumber: 0,
          campaignId: "",
          snapshotHash: "",
          compatibilityVersion: sig.compatibilityVersion,
          contentArtifactHash: sig.serializedHash,
        });
      }
    }

    const chainRank = new Map<string, number>();
    const activeSaveId = this.getActiveSaveId(saveDir);
    if (activeSaveId !== null) chainRank.set(activeSaveId, 0);
    const previousSaveId = this.getPreviousSaveId(saveDir);
    if (previousSaveId !== null && !chainRank.has(previousSaveId)) chainRank.set(previousSaveId, 1);

    saves.sort((a, b) => {
      const byTimestamp = compareCodePoints(b.timestamp, a.timestamp);
      if (byTimestamp !== 0) return byTimestamp;
      const byChain = (chainRank.get(a.saveId) ?? 2) - (chainRank.get(b.saveId) ?? 2);
      if (byChain !== 0) return byChain;
      return compareCodePoints(b.saveId, a.saveId);
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
    return readPointerFile(pointerPath)?.activeSaveId ?? null;
  }

  getPreviousSaveId(saveDir: string): string | null {
    const pointerPath = join(saveDir, "pointer.json");
    if (!existsSync(pointerPath)) return null;
    return readPointerFile(pointerPath)?.previousSaveId ?? null;
  }
}

export function loadResult(
  saveDir: string,
  currentVersion: string = CURRENT_COMPATIBILITY_VERSION,
  signal?: AbortSignal,
): Result.Result<LoadedSave, LoadFailure> {
  if (signal?.aborted) return Result.fail(cancelledLoad());

  if (!existsSync(saveDir)) {
    return Result.fail(missingSave(`Save directory not found: ${saveDir}`));
  }

  const pointerPath = join(saveDir, "pointer.json");
  if (!existsSync(pointerPath)) {
    return Result.fail(missingSave(`No pointer file found in save directory: ${saveDir}`));
  }

  const pointer = readPointerFile(pointerPath);
  if (pointer === null) {
    return Result.fail(corruptSave("Pointer file is corrupt or unreadable"));
  }

  return loadByIdCore(saveDir, pointer.activeSaveId, currentVersion);
}

export function loadByIdResult(
  saveDir: string,
  saveId: string,
  currentVersion: string = CURRENT_COMPATIBILITY_VERSION,
  signal?: AbortSignal,
): Result.Result<LoadedSave, LoadFailure> {
  if (signal?.aborted) return Result.fail(cancelledLoad());
  return loadByIdCore(saveDir, saveId, currentVersion);
}

function loadByIdCore(
  saveDir: string,
  saveId: string,
  currentVersion: string,
): Result.Result<LoadedSave, LoadFailure> {
  if (!isValidSaveId(saveId)) {
    return Result.fail(corruptSave("Save id is not a valid identifier"));
  }

  if (!existsSync(saveDir)) {
    return Result.fail(missingSave(`Save directory not found: ${saveDir}`));
  }

  const savePath = join(saveDir, saveId);
  if (!isContainedIn(saveDir, savePath)) {
    return Result.fail(corruptSave("Save id escapes the save directory"));
  }

  const campaignPath = join(savePath, "campaign.json");
  const sigPath = join(savePath, "campaign.sig.json");

  if (!existsSync(campaignPath)) {
    return Result.fail(corruptSave(`Save data file not found: ${campaignPath}`));
  }

  let campaignJson: string;
  try {
    campaignJson = readFileSync(campaignPath, "utf8");
  } catch {
    return Result.fail(corruptSave("Failed to read save data file"));
  }

  let raw: unknown;
  try {
    raw = JSON.parse(campaignJson);
  } catch {
    return Result.fail(corruptSave("Save data file contains invalid JSON"));
  }

  const headerResult = Schema.decodeUnknownResult(SaveHeaderSchema)(raw);
  if (!Result.isSuccess(headerResult)) {
    return Result.fail(corruptSave("Save data is missing required fields"));
  }

  const compatibility = CompatibilityChecker.check(
    headerResult.success.snapshot.compatibilityVersion,
    currentVersion,
  );
  if (Result.isFailure(compatibility)) return Result.fail(compatibility.failure);

  const parsedResult = decodeStorableCampaignState(raw);
  if (!Result.isSuccess(parsedResult)) {
    return Result.fail(corruptSave("Save data is structurally invalid"));
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
    return Result.fail(corruptSave("Save data snapshot is malformed"));
  }

  const { rawHash: _rawHash, ...stateForHash } = state;
  const computedRawHash = sha256Hex(canonicalSerialize(stateForHash));
  if (computedRawHash !== state.rawHash) {
    return Result.fail(corruptSave("Save data hash mismatch: content has been modified"));
  }

  const warnings: Diagnostic[] = [];
  const signature = validateSignatureResult(sigPath, sha256Hex(campaignJson), state, warnings);
  if (Result.isFailure(signature)) return Result.fail(signature.failure);

  if (!verifyEnvelope(state["envelope"], state["snapshot"])) {
    return Result.fail(
      corruptSave("Save envelope verification failed: snapshot does not match envelope"),
    );
  }

  return Result.succeed({ state, warnings });
}

function validateSignatureResult(
  sigPath: string,
  rawSerializedHash: string,
  state: CampaignState,
  warnings: Diagnostic[],
): Result.Result<void, PersistenceCorruptSaveError> {
  if (!existsSync(sigPath)) {
    warnings.push(
      new PersistenceUnsignedSaveError({
        message:
          "Save has no signature file; loaded as legacy with no independent on-disk tamper verification",
        stage: LOAD_STAGE,
      }).toDiagnostic(),
    );
    return Result.succeed(undefined);
  }

  const sig = readSigFile(sigPath);
  if (sig === null) return Result.fail(corruptSave("Save signature file is invalid"));
  if (sig.serializedHash !== rawSerializedHash) {
    return Result.fail(corruptSave("Save signature does not match serialized content"));
  }
  if (sig.stateHash !== state.rawHash) {
    return Result.fail(corruptSave("Save signature does not match state"));
  }
  if (sig.compatibilityVersion !== state.snapshot.compatibilityVersion) {
    return Result.fail(corruptSave("Save signature version does not match state"));
  }
  return Result.succeed(undefined);
}

export function loadMonthInputResult(
  saveDir: string,
  saveId: string,
): Result.Result<MonthInputLoad, PersistenceCorruptSaveError> {
  const corrupt = (message: string) =>
    Result.fail(new PersistenceCorruptSaveError({ message, stage: MONTH_INPUT_STAGE }));

  if (!isValidSaveId(saveId)) return corrupt("Save id is not a valid identifier");
  const savePath = join(saveDir, saveId);
  if (!isContainedIn(saveDir, savePath)) return corrupt("Save id escapes the save directory");
  const metadata = readSaveMetadata(join(savePath, "metadata.json"));
  if (metadata === null) return corrupt(`Save ${saveId} has no readable metadata`);
  if (metadata.monthInputHash === undefined) return Result.succeed({ status: "absent" });
  let text: string;
  try {
    text = readFileSync(join(savePath, MONTH_INPUT_FILE), "utf8");
  } catch {
    return corrupt(`Save ${saveId} lost its month input`);
  }
  if (sha256Hex(text) !== metadata.monthInputHash) {
    return corrupt(`Save ${saveId} month input does not match its hash`);
  }
  try {
    const value: unknown = JSON.parse(text);
    return Result.succeed({ status: "present", value });
  } catch {
    return corrupt(`Save ${saveId} month input is not JSON`);
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
