import {
  canonicalSerialize,
  compareCodePoints,
  createEnvelope,
  hashWithContext,
  sha256Hex,
  verifyEnvelope,
  type CanonicalEnvelope,
} from "@bluewave/deterministic";

import type { CampaignSnapshot, NationState } from "./state.js";

function recordOf<V>(map: ReadonlyMap<string, V>, project: (value: V) => unknown = (v) => v) {
  const record: Record<string, unknown> = {};
  for (const key of [...map.keys()].sort(compareCodePoints)) {
    record[key] = project(map.get(key)!);
  }
  return record;
}

function hashableNation(nation: NationState): unknown {
  return {
    ...nation,
    research: {
      ...nation.research,
      activeCandidates: recordOf(nation.research.activeCandidates),
    },
  };
}

export function hashableCampaignSnapshot(snapshot: CampaignSnapshot): unknown {
  return {
    ...snapshot,
    nations: recordOf(snapshot.nations, hashableNation),
    designs: recordOf(snapshot.designs),
    designFamilies: recordOf(snapshot.designFamilies),
  };
}

export function hashCampaignSnapshot(snapshot: CampaignSnapshot): string {
  return sha256Hex(canonicalSerialize(hashableCampaignSnapshot(snapshot)));
}

export const UNIFIED_SNAPSHOT_HASH_CONTEXT = "bluewave/campaign/snapshot/v1";

const SNAPSHOT_HASH_FIELDS: Readonly<Record<keyof CampaignSnapshot, true>> = {
  version: true,
  turnNumber: true,
  campaignId: true,
  startYear: true,
  startMonth: true,
  slots: true,
  world: true,
  nations: true,
  wars: true,
  politics: true,
  intelligence: true,
  designs: true,
  designFamilies: true,
  strategicWeather: true,
  prestigeRules: true,
  careerResult: true,
  rulesetVersion: true,
  compatibilityVersion: true,
};

const SNAPSHOT_HASH_FIELD_NAMES = Object.keys(SNAPSHOT_HASH_FIELDS) as (keyof CampaignSnapshot)[];

function plainSnapshotValue(value: unknown): unknown {
  if (value instanceof Map) {
    const entries = [...value].map(([key, item]) => [
      plainSnapshotValue(key),
      plainSnapshotValue(item),
    ]);
    entries.sort((a, b) => compareCodePoints(canonicalSerialize(a[0]), canonicalSerialize(b[0])));
    return { $map: entries };
  }
  if (value instanceof Set) {
    return {
      $set: [...value]
        .map(plainSnapshotValue)
        .sort((a, b) => compareCodePoints(canonicalSerialize(a), canonicalSerialize(b))),
    };
  }
  if (Array.isArray(value)) return value.map(plainSnapshotValue);
  if (typeof value === "object" && value !== null) {
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) record[key] = plainSnapshotValue(item);
    return record;
  }
  return value;
}

export function snapshotHashSubject(snapshot: CampaignSnapshot): Record<string, unknown> {
  const subject: Record<string, unknown> = {};
  for (const field of SNAPSHOT_HASH_FIELD_NAMES) subject[field] = snapshot[field];
  return subject;
}

export function missingSnapshotHashFields(snapshot: CampaignSnapshot): string[] {
  const covered = new Set(Object.keys(snapshotHashSubject(snapshot)));
  return Object.keys(snapshot).filter((field) => !covered.has(field));
}

export function unifiedSnapshotHash(snapshot: CampaignSnapshot): string {
  return hashWithContext(
    canonicalSerialize(plainSnapshotValue(snapshotHashSubject(snapshot))),
    UNIFIED_SNAPSHOT_HASH_CONTEXT,
  );
}

export function createCampaignSnapshotEnvelope(
  compatibilityVersion: string,
  snapshot: CampaignSnapshot,
): CanonicalEnvelope {
  return createEnvelope(
    "campaign-snapshot",
    compatibilityVersion,
    hashableCampaignSnapshot(snapshot),
  );
}

export function verifyCampaignSnapshotEnvelope(
  envelope: CanonicalEnvelope,
  snapshot: CampaignSnapshot,
): boolean {
  return (
    verifyEnvelope(envelope, hashableCampaignSnapshot(snapshot)) ||
    verifyLegacyMapBlindEnvelope(envelope, snapshot)
  );
}

export function verifyLegacyMapBlindEnvelope(
  envelope: CanonicalEnvelope,
  snapshot: CampaignSnapshot,
): boolean {
  return verifyEnvelope(envelope, snapshot);
}
