import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { MinuteResult } from "./engine.js";
import type { MinuteRun } from "./minuteStages.js";

export function buildMinuteResult(run: MinuteRun): MinuteResult {
  const {
    battleId,
    minute,
    ledger,
    units,
    resolvedMovements,
    afterContacts,
    byKey,
    before,
    collisionRecord,
    gunneryStates,
    weatherComponents,
    damageStates,
    torpedoStates,
    torpedoTracks,
    torpedoRecords,
    smokeClouds,
    smokeRecords,
    airCombatRecords,
    airCombatSummary,
    airDefenseRecords,
    airDefenseStates,
    salvos,
  } = run;
  const events = ledger.sorted();
  const hasTorpedoSurface =
    torpedoTracks !== undefined || (torpedoRecords !== undefined && torpedoRecords.length > 0);
  const snapshot = {
    battleId,
    minute,
    units: units.map((u) => ({
      assetId: u.assetId,
      position: resolvedMovements[u.assetId]!.position,
      heading: resolvedMovements[u.assetId]!.heading,
      currentSpeed: resolvedMovements[u.assetId]!.currentSpeed,
    })),
    contacts: afterContacts.map((c) => ({
      contactId: c.contactId,
      assetId: c.assetId,
      position: c.position,
      course: c.course,
      speed: c.speed,
      confidence: c.confidence,
      stale: c.stale,
    })),
    collisionEmpty: collisionRecord.empty,
    droppedContacts: before.filter((id) => !byKey.has(id)),
    events: events.map((e) => ({
      minute: e.minute,
      substep: e.substep,
      eventPriority: e.eventPriority,
      eventType: e.eventType,
      eventId: e.eventId,
    })),
    ...(hasTorpedoSurface
      ? {
          torpedo: {
            tracks: (torpedoTracks ?? []).map((t) => ({
              torpedoTrackId: t.torpedoTrackId,
              currentPosition: t.currentPosition,
              distanceTraveledUm: t.distanceTraveledUm,
              armed: t.armed,
              terminalResult: t.terminalResult,
              trackHash: t.trackHash,
            })),
            ...(torpedoStates
              ? {
                  launchers: Object.keys(torpedoStates)
                    .sort()
                    .map((launcherId) => {
                      const st = torpedoStates![launcherId]!;
                      return {
                        launcherId,
                        loadedPerTube: st.loadedPerTube,
                        stateHash: st.stateHash,
                      };
                    }),
                }
              : {}),
            ...(torpedoRecords && torpedoRecords.length > 0
              ? {
                  records: torpedoRecords.map((r) => ({
                    recordId: r.recordId,
                    kind: r.kind,
                    recordHash: r.recordHash,
                  })),
                }
              : {}),
          },
        }
      : {}),
    ...(smokeRecords && smokeRecords.length > 0
      ? {
          smoke: {
            records: smokeRecords.map((r) => ({
              recordId: r.recordId,
              kind: r.kind,
              recordHash: r.recordHash,
            })),
          },
        }
      : {}),
    ...(airCombatRecords && airCombatRecords.length > 0
      ? {
          airCombat: {
            records: airCombatRecords.map((r) => ({
              recordId: r.recordId,
              kind: r.recordKind,
              recordHash: r.recordHash,
            })),
            ...(airCombatSummary
              ? {
                  summary: {
                    capEngagements: airCombatSummary.capEngagements,
                    strikeAttacks: airCombatSummary.strikeAttacks,
                    losses: airCombatSummary.losses,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(airDefenseRecords && airDefenseRecords.length > 0
      ? {
          airDefense: {
            records: airDefenseRecords.map((r) => ({
              recordId: r.recordId,
              kind: r.recordKind,
              outcome: r.outcome,
              recordHash: r.recordHash,
            })),
          },
        }
      : {}),
  };
  const minuteHash = sha256Hex(canonicalSerialize(snapshot));

  return {
    minute,
    movementStates: resolvedMovements,
    contacts: afterContacts,
    events: ledger.sorted(),
    minuteHash,
    ...(gunneryStates ? { gunneryStates } : {}),
    ...(salvos && salvos.length > 0 ? { gunneryRecords: salvos } : {}),
    ...(weatherComponents ? { weatherComponents } : {}),
    ...(damageStates ? { damageStates } : {}),
    ...(torpedoStates ? { torpedoStates } : {}),
    ...(torpedoTracks ? { torpedoTracks } : {}),
    ...(torpedoRecords ? { torpedoRecords } : {}),
    ...(smokeClouds ? { smokeClouds } : {}),
    ...(smokeRecords ? { smokeRecords } : {}),
    ...(airCombatRecords ? { airCombatRecords } : {}),
    ...(airCombatSummary ? { airCombatSummary } : {}),
    ...(airDefenseRecords ? { airDefenseRecords } : {}),
    ...(airDefenseStates ? { airDefenseStates } : {}),
  };
}
