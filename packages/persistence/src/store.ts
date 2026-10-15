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

// The PERSISTENCE_* codes are defined in `errors.ts` (tagged-error vocabulary)
// and re-exported here to keep the existing module import path working.
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

// Save ids are created by `save()` as `<epochMs>-<uuid>`; treat any inbound id
// as opaque and validate it before it touches the filesystem (TODO #3).
const SAVE_ID_PATTERN = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidSaveId(saveId: string): boolean {
  return SAVE_ID_PATTERN.test(saveId);
}

// Defense-in-depth containment: the resolved save path must remain inside
// `saveDir` so an ID like an absolute path or `..` can never escape it.
function isContainedIn(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

// A cancellation that crosses an IPC/async boundary is detected by
// `error.name === "AbortError"`; a bare `new Error("AbortError")` has name
// "Error" and misses that check (TODO #13).
function createAbortError(): Error {
  const error = new Error("Save operation was cancelled");
  error.name = "AbortError";
  return error;
}

/** Extra artifacts a save can carry beside the campaign state. */
export interface SaveExtras {
  /**
   * What the month that produced this state executed on (the player's command envelopes, their outcomes, the content
   * the engine was given), so a replay can run the same month again. Any JSON value; the caller owns its shape.
   */
  readonly monthInput?: unknown;
}

/** Result of `loadMonthInput`: absent on saves that predate month inputs or do not close a month. */
export type MonthInputLoad =
  | { readonly status: "absent" }
  | { readonly status: "present"; readonly value: unknown }
  | { readonly status: "corrupt" };

const MONTH_INPUT_FILE = "month-input.json";

export class SaveStore {
  /**
   * `currentCompatibilityVersion` defaults to the active release constant; tests
   * inject another to exercise the refusal path (ship-part-model ticket 10).
   */
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
    // Written form only: state's Map-valued snapshot fields (nations, designs,
    // designFamilies, activeCandidates) convert to plain Records so they survive
    // JSON.stringify. The stateHash below stays over the original `state`/
    // `stateForHash` (real Maps) so it matches the rawHash the campaign compiler
    // already computed and what load() recomputes after reconstituting Maps.
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
      // The hash of the serialized on-disk artifact, matching the name.
      contentArtifactHash: serializedHash,
      // INC-13: additive optional campaign-list display fields (no migration;
      // legacy saves simply omit them and the list renders "—").
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

    // `published` guards the outer catch: once the directory has been renamed
    // to savePath, tmpDir no longer exists (cleanup is a no-op) and a failure
    // must remove the published-but-not-yet-active save instead.
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

      // Atomic publication as a complete unit (TODO #4): build every artifact
      // inside tmpDir, then rename the whole directory. tmpDir and savePath
      // share saveDir as parent, so the rename never crosses filesystems.
      renameSync(tmpDir, savePath);
      published = true;

      if (signal?.aborted) {
        // The save is fully written but is not yet the active save. Remove it
        // and leave the pointer untouched — never roll a pointer back that we
        // never advanced (TODO #5/#6).
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

  /**
   * Loads a specific save by id, bypassing the active pointer. Lets callers
   * (e.g. replay verification) reach a save's *predecessor* — the snapshot a
   * turn was executed against — rather than only ever the current active save.
   */
  /**
   * The month input a save was written with (see `SaveExtras.monthInput`), checked against the hash in its metadata.
   * "absent" when the save has none; "corrupt" (with a diagnostic) when the file is missing, unreadable or altered.
   */
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

    // Reject any id that could escape saveDir before a single fs operation
    // (TODO #3).
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

    // Stage 1 — parse as `unknown` and validate only the minimal header, so the
    // compatibility version can be checked BEFORE materializing the
    // version-specific schema. This guarantees structurally-obsolete saves get
    // the stable compatibility diagnostic rather than a mislabeled corruption
    // diagnostic (TODO #14).
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

    // Stage 2 — runtime-structural validation of the accepted compatibility
    // version (TODO #9). The deep value-fidelity is then enforced by the
    // envelope + rawHash checks below.
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

    // Stage 3 — reconstitute the Records written by toStorableSnapshot back into
    // real Maps (nations, designs, designFamilies, activeCandidates) before any
    // hash/envelope verification below, so those checks run over the same shape
    // (real Maps) the campaign compiler used when it originally computed
    // rawHash/envelope.
    let state: CampaignState;
    try {
      state = {
        ...parsedResult.success,
        // Accepted narrowing (ticket INC-3): `StorableSnapshotSchema` validates
        // the snapshot's container shape only and leaves deeply-typed leaves
        // permissive (schemas.ts NOTE); deep value-fidelity is enforced by the
        // envelope + rawHash checks below, and `fromStorableSnapshot` reads the
        // same shape `toStorableSnapshot` wrote, so this is the boundary seam.
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

    // Integrity gate A — semantic state hash must equal the persisted rawHash.
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

    // Integrity gate B — validate the signature file, never trust it blindly
    // (TODO #1/#5). Returns false (with the diagnostic) when the load must be
    // refused. A save with NO signature file is a legacy save written before the
    // signature existed (or a turn-zero campaign): it is loaded with a warning,
    // not rejected, so existing saves are not broken. Note this knowingly
    // accepts signature *deletion* (indistinguishable from a true legacy save) —
    // the independent-tamper guarantee holds for any save that still carries a
    // signature (ADR-0032).
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

  /**
   * Integrity gate B — validates `campaign.sig.json` against the on-disk
   * serialized bytes and the reconstituted semantic state. Returns `true` if the
   * save may load. A save with no signature file is a legacy save: it emits a
   * warning and loads (returning `true`). A present-but-invalid or mismatching
   * signature hard-rejects (returning `false`, plus an error diagnostic).
   */
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

      // Metadata and signature fallback are independent gates (TODO #11): a
      // directory with no/invalid metadata but a valid signature still lists.
      if (existsSync(metaPath)) {
        try {
          const meta = Schema.decodeUnknownSync(SaveMetadataSchema)(
            JSON.parse(readFileSync(metaPath, "utf8")),
          );
          saves.push(meta);
          continue;
        } catch {
          // Fall through to the signature fallback.
        }
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
            // The signature file does not carry a snapshot hash (only the
            // on-disk serialized hash and the whole-campaign state hash), so a
            // degraded record that lacks metadata cannot honestly report one.
            // Leave it empty rather than mislabel it with the state hash (the
            // exact wrong value ticket 03 eliminated from the save path).
            snapshotHash: "",
            compatibilityVersion: sig.compatibilityVersion,
            contentArtifactHash: sig.serializedHash,
          });
        } catch {
          // Skip invalid save directories.
        }
      }
    }

    // Deterministic newest-first ordering. Primary key is the wall-clock
    // timestamp, but equal timestamps (two saves written within the same
    // millisecond — construction commands write extra saves at the same
    // revision) must NOT fall back to the OS `readdirSync` order, which is
    // platform-dependent. Tie-break by the save chain: the active save is
    // the truly-newest, its (immediate) predecessor second, orphans last —
    // then saveId descending as the final total order (saveId embeds the
    // creation timestamp), so the result is identical on every platform for
    // the same package (F6).
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

  /**
   * True when the ACTIVE save in `saveDir` holds exactly `state`. Compares the full
   * serialized content hash (`contentArtifactHash`), which covers the Map-valued
   * snapshot fields (nations, designs, …). The state's own `rawHash` does NOT: it is
   * computed over the in-memory form, where those Maps contribute nothing, so two states
   * that differ only in a nation's treasury share a `rawHash`. Never throws — an absent,
   * unreadable or foreign package is simply "not current".
   */
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

  /**
   * The save id that was active immediately before the current one — i.e.
   * the snapshot the active save's turn was executed against. `null` if the
   * active save is the first save in this directory (no predecessor) or the
   * pointer is missing/corrupt.
   */
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

// `previousSaveId` is read once at the start of save() so that the pointer and
// the save's own metadata record the same predecessor (TODO #7). The update is
// a single write+atomic-rename; within a single synchronous process two saves
// cannot interleave here. Cross-process safety is handled by the app-level
// persistence owner (single IPC queue) per ADR-….
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
