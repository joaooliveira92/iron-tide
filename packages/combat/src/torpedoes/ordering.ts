import { type TorpedoRecord } from "./records.js";

export function compareStableStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareSides(a: string, b: string): number {
  return compareStableStrings(a, b);
}

export function compareLaunchCommandOrder(
  a: { shipId: string; launcherId: string },
  b: { shipId: string; launcherId: string },
  sideOf?: (shipId: string) => string,
): number {
  if (sideOf) {
    const bySide = compareSides(sideOf(a.shipId) ?? "", sideOf(b.shipId) ?? "");
    if (bySide !== 0) return bySide;
  }
  const byShip = compareStableStrings(a.shipId, b.shipId);
  if (byShip !== 0) return byShip;
  return compareStableStrings(a.launcherId, b.launcherId);
}

export function compareTubes(a: number, b: number): number {
  return a - b;
}

export function compareTrackRunOrder(
  a: { launchMinute: number; launchSubstep: number; torpedoTrackId: string },
  b: { launchMinute: number; launchSubstep: number; torpedoTrackId: string },
): number {
  return (
    a.launchMinute - b.launchMinute ||
    a.launchSubstep - b.launchSubstep ||
    compareStableStrings(a.torpedoTrackId, b.torpedoTrackId)
  );
}

export function compareTargetContacts(a: string, b: string): number {
  return compareStableStrings(a, b);
}

export function compareDamagePackages(
  a: { impactMinute: number; impactSubstep: number; packageId: string },
  b: { impactMinute: number; impactSubstep: number; packageId: string },
): number {
  return (
    a.impactMinute - b.impactMinute ||
    a.impactSubstep - b.impactSubstep ||
    compareStableStrings(a.packageId, b.packageId)
  );
}

export function compareFloodingSources(
  a: { compartmentId: string; sourceId: string },
  b: { compartmentId: string; sourceId: string },
): number {
  return (
    compareStableStrings(a.compartmentId, b.compartmentId) ||
    compareStableStrings(a.sourceId, b.sourceId)
  );
}

export function compareSystemEffects(
  a: { stableSystemId: string },
  b: { stableSystemId: string },
): number {
  return compareStableStrings(a.stableSystemId, b.stableSystemId);
}

type TorpedoRecordOrderingLevel = 4 | 5 | 6 | 7 | 8 | 9;

function recordOrderingLevel(kind: TorpedoRecord["kind"]): TorpedoRecordOrderingLevel {
  switch (kind) {
    case "LAUNCH":
      return 4;
    case "TRACK":
      return 5;
    case "HIT_RESOLUTION":
    case "DETONATION":
    case "DETECTION":
      return 6;
    case "DAMAGE":
    case "CHAIN_REACTION":
      return 7;
    case "FLOODING_SOURCE":
      return 8;
    case "MACHINERY":
    case "SYSTEM_SHOCK":
    case "TUBE_HAZARD":
      return 9;
  }
}

function launchTupleOf(trackId: string): { launchMinute: number; launchSubstep: number } {
  const parts = trackId.split(":");
  const minute = Number(parts[1]);
  const substep = Number(parts[2]);
  return {
    launchMinute: Number.isInteger(minute) ? minute : 0,
    launchSubstep: Number.isInteger(substep) ? substep : 0,
  };
}

export function torpedoRecordOrder(a: TorpedoRecord, b: TorpedoRecord): number {
  const byMinute = a.battleMinute - b.battleMinute;
  if (byMinute !== 0) return byMinute;
  const bySubstep = a.substep - b.substep;
  if (bySubstep !== 0) return bySubstep;
  const la = recordOrderingLevel(a.kind);
  const lb = recordOrderingLevel(b.kind);
  if (la !== lb) return la - lb;

  switch (a.kind) {
    case "LAUNCH": {
      const tubeA = tubeOrdinalOf(a.targetId);
      const tubeB = tubeOrdinalOf(b.targetId);
      if (tubeA !== tubeB) return tubeA - tubeB;
      break;
    }
    case "TRACK": {
      const ka = launchTupleOf(a.sourceId);
      const kb = launchTupleOf(b.sourceId);
      return (
        ka.launchMinute - kb.launchMinute ||
        ka.launchSubstep - kb.launchSubstep ||
        compareStableStrings(a.sourceId, b.sourceId)
      );
    }
    case "HIT_RESOLUTION":
    case "DETONATION":
    case "DETECTION": {
      return (
        compareStableStrings(a.targetId, b.targetId) ||
        compareStableStrings(a.sourceId, b.sourceId) ||
        compareStableStrings(a.recordId, b.recordId)
      );
    }
    case "DAMAGE":
    case "CHAIN_REACTION": {
      return (
        a.battleMinute - b.battleMinute ||
        a.substep - b.substep ||
        compareStableStrings(a.targetId, b.targetId) ||
        compareStableStrings(a.recordId, b.recordId)
      );
    }
    case "FLOODING_SOURCE": {
      return (
        compareFloodingSources(
          { compartmentId: a.sourceId, sourceId: a.targetId },
          { compartmentId: b.sourceId, sourceId: b.targetId },
        ) || compareStableStrings(a.recordId, b.recordId)
      );
    }
    case "MACHINERY":
    case "SYSTEM_SHOCK":
    case "TUBE_HAZARD": {
      return (
        compareSystemEffects({ stableSystemId: a.targetId }, { stableSystemId: b.targetId }) ||
        compareStableStrings(a.recordId, b.recordId)
      );
    }
  }
  return compareStableStrings(a.recordId, b.recordId);
}

function tubeOrdinalOf(targetId: string): number {
  const m = /^tube0*(\d+)$/.exec(targetId);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}
