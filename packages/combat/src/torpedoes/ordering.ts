// DESIGN-40 §28 — canonical torpedo ordering (INC-7, AC-20). Torpedo resolution
// orders:
//
//   1. tactical sides;                         (side id, stable sort)
//   2. firing ships by identifier;
//   3. launchers by identifier;
//   4. tubes by tube identifier;
//   5. torpedo tracks by launch minute, substep, and track identifier;
//   6. contacts by target identifier;
//   7. damage packages by impact minute, substep, and package identifier;
//   8. flooding sources by compartment and source identifier;
//   9. system effects by stable system identifier.
//
// Database insertion order, UI order, localized names, rendering order, and
// wall-clock time MUST NOT affect outcomes. The engine therefore sorts EVERY
// collection it processes with the comparators in this module, and the records
// emitted carry ordering-friendly ids so the shared BattleLedger.canonicalEvent
// Order reproduces the same sequence. Plain `<`/`>` comparisons only — no
// localeCompare (the no-locale-read contract).
import { type TorpedoRecord } from "./records.js";

/** Plain deterministic string compare (no locale, no OS dependence). */
export function compareStableStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Level 1: tactical sides by identifier. */
export function compareSides(a: string, b: string): number {
  return compareStableStrings(a, b);
}

/** Levels 1-3: firing ship, then launcher by identifier (side first when
 *  the sideOf accessor is supplied). */
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

/** Level 4: tubes fire in ascending tube-identifier order (numeric). */
export function compareTubes(a: number, b: number): number {
  return a - b;
}

/** Level 5: torpedo tracks by launch minute, launch substep, then track id. */
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

/** Level 6: contacts by target identifier (contact id). */
export function compareTargetContacts(a: string, b: string): number {
  return compareStableStrings(a, b);
}

/** Level 7: damage packages by impact minute, substep, then package id. */
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

/** Level 8: flooding sources by compartment, then source identifier. */
export function compareFloodingSources(
  a: { compartmentId: string; sourceId: string },
  b: { compartmentId: string; sourceId: string },
): number {
  return (
    compareStableStrings(a.compartmentId, b.compartmentId) ||
    compareStableStrings(a.sourceId, b.sourceId)
  );
}

/** Level 9: system effects by stable system identifier. */
export function compareSystemEffects(
  a: { stableSystemId: string },
  b: { stableSystemId: string },
): number {
  return compareStableStrings(a.stableSystemId, b.stableSystemId);
}

// The §28 level a record kind belongs to (for the full-record comparator).
type TorpedoRecordOrderingLevel = 4 | 5 | 6 | 7 | 8 | 9;

function recordOrderingLevel(kind: TorpedoRecord["kind"]): TorpedoRecordOrderingLevel {
  switch (kind) {
    case "LAUNCH":
      return 4; // level 4: tubes by tube identifier (a launch attempt is per-tube)
    case "TRACK":
      return 5; // level 5: tracks by launch minute/substep/track id
    case "HIT_RESOLUTION":
    case "DETONATION":
    case "DETECTION":
      return 6; // level 6: contacts by target identifier
    case "DAMAGE":
    case "CHAIN_REACTION":
      return 7; // level 7: damage/explosion packages by impact minute/substep/package id
    case "FLOODING_SOURCE":
      return 8; // level 8: flooding sources by compartment/source id
    case "MACHINERY":
    case "SYSTEM_SHOCK":
    case "TUBE_HAZARD":
      return 9; // level 9: system effects by stable system id
  }
}

// The canonical torpedo track id embeds the (minute, substep) launch tuple:
//   "<battleId>:<minute>:<substep>:torpedo:<launcher>:tube<N>".
function launchTupleOf(trackId: string): { launchMinute: number; launchSubstep: number } {
  const parts = trackId.split(":");
  const minute = Number(parts[1]);
  const substep = Number(parts[2]);
  return {
    launchMinute: Number.isInteger(minute) ? minute : 0,
    launchSubstep: Number.isInteger(substep) ? substep : 0,
  };
}

/**
 * AC-20: the §28 comparator over emitted torpedo records. Primary keys are the
 * battle minute and substep (the records' emission instant); within an instant
 * the §28 level sequence decides. Every branch is a pure function of the
 * records' own stable id fields (never insertion order, wall-clock, or locale).
 */
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
      // LEVEL 4: the launch record's targetId is "tube" + zero-padded index.
      const tubeA = tubeOrdinalOf(a.targetId);
      const tubeB = tubeOrdinalOf(b.targetId);
      if (tubeA !== tubeB) return tubeA - tubeB;
      break;
    }
    case "TRACK": {
      // LEVEL 5: launch minute, substep, then the track id (sourceId).
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
      // LEVEL 6: contacts by target identifier, then the track (sourceId).
      return (
        compareStableStrings(a.targetId, b.targetId) ||
        compareStableStrings(a.sourceId, b.sourceId) ||
        compareStableStrings(a.recordId, b.recordId)
      );
    }
    case "DAMAGE":
    case "CHAIN_REACTION": {
      // LEVEL 7: impact minute/substep/package id (the emitted minute/substep
      // ARE the impact instant; the package id is the record's targetId).
      return (
        a.battleMinute - b.battleMinute ||
        a.substep - b.substep ||
        compareStableStrings(a.targetId, b.targetId) ||
        compareStableStrings(a.recordId, b.recordId)
      );
    }
    case "FLOODING_SOURCE": {
      // LEVEL 8: compartment (sourceId) then source id (targetId).
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
      // LEVEL 9: stable system id (targetId).
      return (
        compareSystemEffects({ stableSystemId: a.targetId }, { stableSystemId: b.targetId }) ||
        compareStableStrings(a.recordId, b.recordId)
      );
    }
  }
  return compareStableStrings(a.recordId, b.recordId);
}

function tubeOrdinalOf(targetId: string): number {
  // targetId is "tube" + zero-padded tube index (engine wiring).
  const m = /^tube0*(\d+)$/.exec(targetId);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}
