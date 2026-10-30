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
import { verifyCampaignSnapshotEnvelope } from "@bluewave/campaign";
import type { CampaignState } from "@bluewave/campaign";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type { Diagnostic } from "@bluewave/diagnostics";
import { Effect, Result } from "effect";
import { systemClock, type PersistenceClock } from "./clock.js";
import { CompatibilityChecker, CURRENT_COMPATIBILITY_VERSION } from "./compatibility.js";
import {
  PersistenceInvalidOptionError,
  PersistenceIoError,
  PersistenceCancelledError,
  PersistenceCompatibilityMismatchError,
  PersistenceCorruptSaveError,
  PersistenceMissingSaveError,
  PersistenceLegacySaveError,
} from "./errors.js";
import {
  readPointerFile,
  readPointerFileResult,
  readSaveMetadata,
  readSigFile,
} from "./fileDecode.js";
import { LEGACY_SIG_FILE, writeSaveManifest, verifySaveManifest } from "./manifest.js";
import {
  BACKUP_PREFIX,
  cleanup,
  POINTER_TEMP_FILE,
  sweepStaleTemp,
  TEMP_SAVE_PREFIX,
} from "./recovery.js";
import {
  decodeSaveHeader,
  decodeStorableCampaignState,
  type PointerFile,
  type SaveMetadata,
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
  LEGACY_SAVE_CODE,
} from "./errors.js";

export type { SaveMetadata } from "./schemas.js";

export interface SaveResult {
  savePath: string;
  hash: string;
  metadata: SaveMetadata;
  warnings: readonly Diagnostic[];
}

type PointerReadFailure = PersistenceIoError | PersistenceCorruptSaveError;

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

const SAVE_STAGE = "persistence.save";
const LIST_STAGE = "persistence.list";
const POINTER_STAGE = "persistence.pointer";
const IS_CURRENT_STAGE = "persistence.isCurrent";

function ioError(stage: string, cause: unknown): PersistenceIoError {
  return new PersistenceIoError({
    message: cause instanceof Error ? cause.message : String(cause),
    stage,
  });
}

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

export interface SaveStoreOptions {
  readonly retainSaves?: number;
  readonly clock?: PersistenceClock;
}

export class SaveStore {
  private readonly retainSaves: number | undefined;
  private readonly clock: PersistenceClock;

  constructor(
    private readonly currentCompatibilityVersion: string = CURRENT_COMPATIBILITY_VERSION,
    options: SaveStoreOptions = {},
  ) {
    if (
      options.retainSaves !== undefined &&
      (!Number.isSafeInteger(options.retainSaves) || options.retainSaves < 2)
    ) {
      throw new PersistenceInvalidOptionError({
        message: "retainSaves must be a safe integer of at least 2",
        stage: "persistence.options",
      });
    }
    this.retainSaves = options.retainSaves;
    this.clock = options.clock ?? systemClock;
  }

  prune(saveDir: string, retain: number): void {
    const protectedIds = new Set<string>();
    const active = this.getActiveSaveId(saveDir);
    const previous = this.getPreviousSaveId(saveDir);
    if (active !== null) protectedIds.add(active);
    if (previous !== null) protectedIds.add(previous);
    let kept = protectedIds.size;
    for (const save of this.list(saveDir)) {
      if (protectedIds.has(save.saveId)) continue;
      if (kept < retain && isValidSaveId(save.saveId)) {
        kept += 1;
        continue;
      }
      if (!isValidSaveId(save.saveId)) continue;
      rmSync(join(saveDir, save.saveId), { recursive: true, force: true });
    }
  }

  save(
    state: CampaignState,
    saveDir: string,
    signal?: AbortSignal,
    extras: SaveExtras = {},
  ): SaveResult {
    if (signal?.aborted) {
      throw createAbortError();
    }

    sweepStaleTemp(saveDir);

    const saveId = `${this.clock.nowMillis()}-${this.clock.uuid()}`;
    const savePath = join(saveDir, saveId);
    const tmpDir = join(saveDir, `${TEMP_SAVE_PREFIX}${saveId}`);

    const { rawHash: _rh, ...stateForHash } = state;
    const storableState = { ...state, snapshot: toStorableSnapshot(state.snapshot) };
    const serialized = canonicalSerialize(storableState);
    const stateHash = sha256Hex(canonicalSerialize(stateForHash));
    const serializedHash = sha256Hex(serialized);
    const snapshotHash = sha256Hex(canonicalSerialize(toStorableSnapshot(state.snapshot)));
    const pointerRead = this.pointerResult(saveDir);
    const pointerUnreadable = Result.isFailure(pointerRead);
    const previousSaveId = Result.isSuccess(pointerRead)
      ? (pointerRead.success?.activeSaveId ?? undefined)
      : undefined;
    const warnings: Diagnostic[] = pointerUnreadable
      ? [pointerRead.failure.toDiagnostic("warning")]
      : [];
    const monthInput =
      extras.monthInput === undefined ? undefined : canonicalSerialize(extras.monthInput);

    const metadata: SaveMetadata = {
      saveId,
      previousSaveId,
      timestamp: this.clock.nowIso(),
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
      writeFileSync(join(tmpDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
      if (monthInput !== undefined)
        writeFileSync(join(tmpDir, MONTH_INPUT_FILE), monthInput, "utf8");
      writeSaveManifest(tmpDir);

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
      if (this.retainSaves !== undefined && !pointerUnreadable) {
        this.prune(saveDir, this.retainSaves);
      }

      return { savePath, hash: stateHash, metadata, warnings };
    } catch (err) {
      cleanup(tmpDir);
      cleanup(join(saveDir, POINTER_TEMP_FILE));
      if (published && existsSync(savePath)) {
        rmSync(savePath, { recursive: true, force: true });
      }
      throw err;
    }
  }

  saveEffect(
    state: CampaignState,
    saveDir: string,
    extras: SaveExtras = {},
    signal?: AbortSignal,
  ): Effect.Effect<SaveResult, PersistenceCancelledError | PersistenceIoError> {
    return Effect.try({
      try: () => this.save(state, saveDir, signal, extras),
      catch: (cause) =>
        signal?.aborted === true
          ? new PersistenceCancelledError({
              message: "Save operation was cancelled",
              stage: SAVE_STAGE,
            })
          : ioError(SAVE_STAGE, cause),
    }).pipe(Effect.withSpan("persistence.save"));
  }

  listEffect(saveDir: string): Effect.Effect<SaveMetadata[], PersistenceIoError> {
    return Effect.try({
      try: () => this.list(saveDir),
      catch: (cause) => ioError(LIST_STAGE, cause),
    }).pipe(Effect.withSpan("persistence.list"));
  }

  isCurrentEffect(
    state: CampaignState,
    saveDir: string,
  ): Effect.Effect<boolean, PointerReadFailure> {
    return Effect.suspend(() => Effect.fromResult(this.isCurrentResult(state, saveDir))).pipe(
      Effect.withSpan(IS_CURRENT_STAGE),
    );
  }

  activeSaveIdEffect(saveDir: string): Effect.Effect<string | null, PointerReadFailure> {
    return Effect.suspend(() =>
      Effect.fromResult(
        Result.map(this.pointerResult(saveDir), (pointer) => pointer?.activeSaveId ?? null),
      ),
    ).pipe(Effect.withSpan("persistence.activeSaveId"));
  }

  previousSaveIdEffect(saveDir: string): Effect.Effect<string | null, PointerReadFailure> {
    return Effect.suspend(() =>
      Effect.fromResult(
        Result.map(this.pointerResult(saveDir), (pointer) => pointer?.previousSaveId ?? null),
      ),
    ).pipe(Effect.withSpan("persistence.previousSaveId"));
  }

  load(saveDir: string, signal?: AbortSignal): Effect.Effect<LoadedSave, LoadFailure> {
    const currentVersion = this.currentCompatibilityVersion;
    return Effect.suspend(() =>
      Effect.fromResult(loadResult(saveDir, currentVersion, signal)),
    ).pipe(Effect.withSpan("persistence.load"));
  }

  loadMonthInput(
    saveDir: string,
    saveId: string,
  ): Effect.Effect<MonthInputLoad, PersistenceCorruptSaveError> {
    return Effect.suspend(() => Effect.fromResult(loadMonthInputResult(saveDir, saveId))).pipe(
      Effect.withSpan("persistence.loadMonthInput"),
    );
  }

  loadById(
    saveDir: string,
    saveId: string,
    signal?: AbortSignal,
  ): Effect.Effect<LoadedSave, LoadFailure> {
    const currentVersion = this.currentCompatibilityVersion;
    return Effect.suspend(() =>
      Effect.fromResult(loadByIdResult(saveDir, saveId, currentVersion, signal)),
    ).pipe(Effect.withSpan("persistence.loadById"));
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
      if (dirName.startsWith(TEMP_SAVE_PREFIX) || dirName.startsWith(BACKUP_PREFIX)) continue;

      const metaPath = join(saveDir, dirName, "metadata.json");
      const sigPath = join(saveDir, dirName, LEGACY_SIG_FILE);

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
        continue;
      }

      const campaignPath = join(saveDir, dirName, "campaign.json");
      if (!existsSync(campaignPath)) continue;
      try {
        const campaignJson = readFileSync(campaignPath, "utf8");
        const decoded = decodeSaveHeader(JSON.parse(campaignJson));
        if (Result.isSuccess(decoded)) {
          saves.push({
            saveId: dirName,
            timestamp: "",
            turnNumber: 0,
            campaignId: "",
            snapshotHash: "",
            compatibilityVersion: decoded.success.snapshot.compatibilityVersion,
            contentArtifactHash: sha256Hex(campaignJson),
          });
        }
      } catch {
        continue;
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
    const current = this.isCurrentResult(state, saveDir);
    return Result.isSuccess(current) ? current.success : false;
  }

  getActiveSaveId(saveDir: string): string | null {
    const decoded = this.pointerResult(saveDir);
    return Result.isSuccess(decoded) ? (decoded.success?.activeSaveId ?? null) : null;
  }

  getPreviousSaveId(saveDir: string): string | null {
    const decoded = this.pointerResult(saveDir);
    return Result.isSuccess(decoded) ? (decoded.success?.previousSaveId ?? null) : null;
  }

  private isCurrentResult(
    state: CampaignState,
    saveDir: string,
  ): Result.Result<boolean, PointerReadFailure> {
    const pointerRead = this.pointerResult(saveDir);
    if (Result.isFailure(pointerRead)) {
      const failure = pointerRead.failure;
      return Result.fail(
        failure._tag === "PERSISTENCE_CORRUPT_SAVE"
          ? new PersistenceCorruptSaveError({ message: failure.message, stage: IS_CURRENT_STAGE })
          : new PersistenceIoError({ message: failure.message, stage: IS_CURRENT_STAGE }),
      );
    }
    const pointer = pointerRead.success;
    if (pointer === null) return Result.succeed(false);

    let saves: SaveMetadata[];
    try {
      saves = this.list(saveDir);
    } catch (cause) {
      return Result.fail(ioError(IS_CURRENT_STAGE, cause));
    }

    const active = saves.find((save) => save.saveId === pointer.activeSaveId);
    if (active === undefined) {
      return Result.fail(
        new PersistenceCorruptSaveError({
          message: `Active save ${pointer.activeSaveId} is not readable`,
          stage: IS_CURRENT_STAGE,
        }),
      );
    }

    const storable = { ...state, snapshot: toStorableSnapshot(state.snapshot) };
    return Result.succeed(active.contentArtifactHash === sha256Hex(canonicalSerialize(storable)));
  }

  private pointerResult(saveDir: string): Result.Result<PointerFile | null, PointerReadFailure> {
    const decoded = readPointerFileResult(join(saveDir, "pointer.json"));
    if (Result.isSuccess(decoded)) return Result.succeed(decoded.success);

    const failure = decoded.failure;
    if (failure.reason === "missing") return Result.succeed(null);
    if (failure.reason === "unreadable") {
      return Result.fail(
        new PersistenceIoError({ message: failure.message, stage: POINTER_STAGE }),
      );
    }
    return Result.fail(
      new PersistenceCorruptSaveError({
        message: "Pointer file is corrupt or unreadable",
        stage: POINTER_STAGE,
      }),
    );
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
  const sigPath = join(savePath, LEGACY_SIG_FILE);

  const manifest = verifySaveManifest(savePath);
  if (manifest.status === "invalid") return Result.fail(corruptSave(manifest.message));

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

  const headerResult = decodeSaveHeader(raw);
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
  if (manifest.status === "legacy") {
    warnings.push(
      new PersistenceLegacySaveError({
        message:
          "Save was written before the integrity manifest; loaded as legacy without a complete-file check",
        stage: LOAD_STAGE,
      }).toDiagnostic(),
    );
    const legacy = validateLegacySignatureResult(sigPath, sha256Hex(campaignJson), state);
    if (Result.isFailure(legacy)) return Result.fail(legacy.failure);
  }

  if (!verifyCampaignSnapshotEnvelope(state["envelope"], state["snapshot"])) {
    return Result.fail(
      corruptSave("Save envelope verification failed: snapshot does not match envelope"),
    );
  }

  return Result.succeed({ state, warnings });
}

function validateLegacySignatureResult(
  sigPath: string,
  rawSerializedHash: string,
  state: CampaignState,
): Result.Result<void, PersistenceCorruptSaveError> {
  if (!existsSync(sigPath)) return Result.succeed(undefined);
  const sig = readSigFile(sigPath);
  if (sig === null) return Result.fail(corruptSave("Legacy save integrity record is invalid"));
  if (sig.serializedHash !== rawSerializedHash) {
    return Result.fail(corruptSave("Legacy save integrity record does not match its content"));
  }
  if (sig.stateHash !== state.rawHash) {
    return Result.fail(corruptSave("Legacy save integrity record does not match its state"));
  }
  if (sig.compatibilityVersion !== state.snapshot.compatibilityVersion) {
    return Result.fail(corruptSave("Legacy save integrity record version does not match"));
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
  const tmpPath = join(saveDir, POINTER_TEMP_FILE);
  writeFileSync(tmpPath, JSON.stringify(pointer, null, 2), "utf8");
  renameSync(tmpPath, pointerPath);
}
