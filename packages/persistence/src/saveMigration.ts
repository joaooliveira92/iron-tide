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
import { createCampaignSnapshotEnvelope, verifyCampaignSnapshotEnvelope } from "@bluewave/campaign";
import type { CampaignState } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { Result } from "effect";
import { CURRENT_COMPATIBILITY_VERSION } from "./compatibility.js";
import { readSaveMetadata } from "./fileDecode.js";
import { BACKUP_PREFIX, MIGRATING_SUFFIX } from "./recovery.js";
import { LEGACY_SIG_FILE, SAVE_MANIFEST_FILE, writeSaveManifest } from "./manifest.js";
import { decodeSaveHeader } from "./schemas.js";
import { toStorableSnapshot } from "./snapshotSerialization.js";
import { loadByIdResult } from "./store.js";

export interface SaveMigrationStep {
  readonly from: string;
  readonly to: string;
}

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

export function detectSaveVersion(raw: unknown): string | null {
  const decoded = decodeSaveHeader(raw);
  return Result.isSuccess(decoded) ? decoded.success.snapshot.compatibilityVersion : null;
}

export function restampState(state: CampaignState, to: string): CampaignState {
  const snapshot = { ...state.snapshot, compatibilityVersion: to };
  const envelope = createCampaignSnapshotEnvelope(to, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

function verifyMigratedState(state: CampaignState): boolean {
  if (!verifyCampaignSnapshotEnvelope(state.envelope, state.snapshot)) return false;
  const expected = sha256Hex(
    canonicalSerialize({ snapshot: state.snapshot, envelope: state.envelope }),
  );
  return expected === state.rawHash;
}

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

  const loaded = loadByIdResult(dirname(savePath), basename(savePath), from);
  if (Result.isFailure(loaded)) {
    return {
      status: "refused",
      kind: "malformed",
      reason: loaded.failure.message || "save did not load",
    };
  }
  const state = loaded.success.state;
  const metadata = readSaveMetadata(join(savePath, METADATA_FILE));
  if (metadata === null) {
    return {
      status: "refused",
      kind: "malformed",
      reason: `${METADATA_FILE} is missing or does not match its schema`,
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
  const tmpPath = `${savePath}${MIGRATING_SUFFIX}`;
  const backup = join(
    dirname(savePath),
    `${BACKUP_PREFIX}migrated_${basename(savePath)}.from-${from}`,
  );
  if (existsSync(tmpPath)) rmSync(tmpPath, { recursive: true, force: true });
  if (existsSync(backup)) {
    return { status: "refused", kind: "unknown", reason: `backup path already exists: ${backup}` };
  }

  let moved = false;
  try {
    mkdirSync(tmpPath, { recursive: true });
    for (const entry of readdirSync(savePath)) {
      if (
        entry === CAMPAIGN_FILE ||
        entry === METADATA_FILE ||
        entry === LEGACY_SIG_FILE ||
        entry === SAVE_MANIFEST_FILE
      )
        continue;
      renameSync(join(savePath, entry), join(tmpPath, entry));
    }
    writeFileSync(join(tmpPath, CAMPAIGN_FILE), serialized, "utf8");
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
    writeSaveManifest(tmpPath);

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
