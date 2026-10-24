import {
  canonicalSerialize,
  compareCodePoints,
  createEnvelope,
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
