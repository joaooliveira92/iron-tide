// Offline save-format migration (ship-part-model SPM-R21, ticket 11d).
//
// This is NOT a runtime load path. ADR-0113 and ADR-0154 §11 keep the product's
// reject-on-mismatch policy: a save whose compatibility version is not current is
// refused before it is decoded. The migration here is the version-keyed transform
// the policy reserves (ADR-0113 §6) and the offline developer tool exercises it to
// bring development fixtures forward.
//
// The transform detects the source version explicitly, applies one registered step
// per supported prior version, refuses unsupported or future versions, preserves
// stable player-owned identity (it rewrites no field but the version and the
// integrity envelope), invents no default, validates the migrated result before
// publication, writes atomically leaving the original recoverable, and is
// idempotent (a current save is a no-op).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type { CampaignState } from "@bluewave/campaign";
import {
  canonicalSerialize,
  createEnvelope,
  sha256Hex,
  verifyEnvelope,
} from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema } from "effect";
import { CURRENT_COMPATIBILITY_VERSION } from "./compatibility.js";
import { SaveHeaderSchema } from "./schemas.js";
import { toStorableSnapshot } from "./snapshotSerialization.js";
import { SaveStore } from "./store.js";

/** One supported prior version and the version it migrates to. */
export interface SaveMigrationStep {
  readonly from: string;
  readonly to: string;
}

/**
 * The supported migrations. The 2.0.0 (part-model), 3.0.0 (S-1 readiness) and
 * 3.1.0 (economy #138, additive optional fields) changes all re-stamp the version
 * over permissive leaves with no guessed value, so a 1.2.0, 2.0.0 or 3.0.0
 * development fixture is brought straight forward (its stored economy is kept as
 * saved: the migration never recomputes a base or a catalogue);
 * 1.0.0 and 1.1.0 predate fields that cannot be reconstructed without inventing
 * gameplay-affecting defaults, so they stay a documented rejection (ADR-0113 §5,
 * ADR-0129).
 *
 * S-2 (4.0.0, ADR-0239): none. Every nation gains a required prestige and the snapshot a required
 * prestige value set, with no default, so no earlier save can be brought forward without inventing
 * gameplay values. Every earlier version is a documented refusal (ADR-0113 §5).
 */
export const SAVE_MIGRATIONS: readonly SaveMigrationStep[] = [];

export type SaveMigrationKind = "current" | "migrated" | "future" | "unknown" | "malformed";

export type MigrateSaveDirectoryResult =
  | {
      readonly status: "migrated";
      readonly from: string;
      readonly to: string;
      readonly backup: string;
    }
  | { readonly status: "current"; readonly from: string; readonly to: string }
  | {
      readonly status: "refused";
      readonly kind: Exclude<SaveMigrationKind, "current" | "migrated">;
      readonly reason: string;
    };

const CAMPAIGN_FILE = "campaign.json";
const SIG_FILE = "campaign.sig.json";
const METADATA_FILE = "metadata.json";

const parseVersion = (value: string): readonly [number, number, number] | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value);
  return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
};

const isFuture = (from: string, current: string): boolean => {
  const a = parseVersion(from);
  const b = parseVersion(current);
  if (a === null || b === null) return false;
  for (let i = 0; i < 3; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
};

/** The explicit source version of a stored save, or `null` when the header is malformed. */
export function detectSaveVersion(raw: unknown): string | null {
  const decoded = Schema.decodeUnknownResult(SaveHeaderSchema)(raw);
  return Result.isSuccess(decoded) ? decoded.success.snapshot.compatibilityVersion : null;
}

/**
 * Re-stamp a decoded campaign state at `to`. The only field that changes is the
 * compatibility version, so every player-owned value is preserved exactly; the
 * envelope and `rawHash` are recomputed over the in-memory (Map-valued) snapshot,
 * matching `SaveStore.save`, so the migrated state passes the normal integrity gates.
 */
export function restampState(state: CampaignState, to: string): CampaignState {
  const snapshot = { ...state.snapshot, compatibilityVersion: to };
  const envelope = createEnvelope("campaign-snapshot", to, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

/** Re-check the migrated state's envelope and raw hash before publication. */
function verifyMigratedState(state: CampaignState): boolean {
  if (!verifyEnvelope(state.envelope, state.snapshot)) return false;
  const expected = sha256Hex(
    canonicalSerialize({ snapshot: state.snapshot, envelope: state.envelope }),
  );
  return expected === state.rawHash;
}

/**
 * Migrate one save directory in place, atomically. The source state is loaded
 * through the real store at its own version (so it is validated normally), the
 * migrated artifacts are built in a sibling temp directory, and the original is
 * moved aside to a `.tmp_migrated_*` backup before the temp directory takes its
 * place — so the original stays recoverable if anything fails and a second run is
 * a no-op.
 */
export function migrateSaveDirectory(
  savePath: string,
  current: string = CURRENT_COMPATIBILITY_VERSION,
  migrations: readonly SaveMigrationStep[] = SAVE_MIGRATIONS,
): MigrateSaveDirectoryResult {
  const campaignPath = join(savePath, CAMPAIGN_FILE);
  if (!existsSync(campaignPath)) {
    return {
      status: "refused",
      kind: "malformed",
      reason: `no ${CAMPAIGN_FILE} under ${savePath}`,
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(campaignPath, "utf8"));
  } catch {
    return { status: "refused", kind: "malformed", reason: `${CAMPAIGN_FILE} is not valid JSON` };
  }
  const from = detectSaveVersion(raw);
  if (from === null) {
    return {
      status: "refused",
      kind: "malformed",
      reason: `${CAMPAIGN_FILE} has no compatibility version`,
    };
  }
  if (from === current) return { status: "current", from, to: current };
  if (isFuture(from, current)) {
    return {
      status: "refused",
      kind: "future",
      reason: `save version "${from}" is newer than the current engine version "${current}"`,
    };
  }
  if (!migrations.some((step) => step.from === from && step.to === current)) {
    return {
      status: "refused",
      kind: "unknown",
      reason: `no migration is registered from "${from}" to "${current}"`,
    };
  }

  // Load the source save through the real store at its own version. This validates
  // its schema, signature and hashes and reconstructs the in-memory Maps the
  // recomputed envelope/rawHash need; an unreadable save is refused, not migrated.
  const diagnostics = new DiagnosticCollector();
  const state = new SaveStore(from).loadById(dirname(savePath), basename(savePath), diagnostics);
  if (state === null) {
    return {
      status: "refused",
      kind: "malformed",
      reason: diagnostics.errors.map((d) => d.message).join("; ") || "save did not load",
    };
  }
  const migrated = restampState(state, current);
  if (!verifyMigratedState(migrated)) {
    return {
      status: "refused",
      kind: "malformed",
      reason: "migrated save failed self-verification",
    };
  }

  const serialized = canonicalSerialize({
    ...migrated,
    snapshot: toStorableSnapshot(migrated.snapshot),
  });
  const serializedHash = sha256Hex(serialized);
  const snapshotHash = sha256Hex(canonicalSerialize(migrated.snapshot));
  const tmpPath = `${savePath}.migrating`;
  // The backup keeps the `.tmp_` prefix `SaveStore.list` already ignores, so a
  // migrated-from directory never appears as a duplicate save in the UI.
  const backup = join(dirname(savePath), `.tmp_migrated_${basename(savePath)}.from-${from}`);
  if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true, force: true });
  if (existsSync(backup)) {
    return { status: "refused", kind: "unknown", reason: `backup path already exists: ${backup}` };
  }

  let moved = false;
  try {
    mkdirSync(tmpPath, { recursive: true });
    for (const entry of readdirSync(savePath)) {
      if (entry === CAMPAIGN_FILE || entry === SIG_FILE || entry === METADATA_FILE) continue;
      renameSync(join(savePath, entry), join(tmpPath, entry));
    }
    writeFileSync(join(tmpPath, CAMPAIGN_FILE), serialized, "utf8");
    writeFileSync(
      join(tmpPath, SIG_FILE),
      JSON.stringify(
        { serializedHash, stateHash: migrated.rawHash, compatibilityVersion: current },
        null,
        2,
      ),
      "utf8",
    );
    const metadata = JSON.parse(readFileSync(join(savePath, METADATA_FILE), "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(
      join(tmpPath, METADATA_FILE),
      JSON.stringify(
        {
          ...metadata,
          snapshotHash,
          compatibilityVersion: current,
          contentArtifactHash: serializedHash,
        },
        null,
        2,
      ),
      "utf8",
    );

    renameSync(savePath, backup);
    moved = true;
    renameSync(tmpPath, savePath);
    return { status: "migrated", from, to: current, backup };
  } catch (error) {
    if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true, force: true });
    if (moved && !existsSync(savePath) && existsSync(backup)) renameSync(backup, savePath);
    throw error;
  }
}
