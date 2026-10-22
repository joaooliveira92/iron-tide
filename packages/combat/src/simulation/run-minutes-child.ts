import { canonicalSerialize } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import type { TacticalBattleState, TacticalShipUnit } from "../tactical/index.js";
import type { MovementState } from "../movement.js";
import { computeInitialMovementStates } from "./spawn.js";
import { advanceMinutes } from "./engine.js";

function unit(id: string, sideId: "ATTACKER" | "DEFENDER", className: string): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId,
    name: id,
    className,
    designVersionId: "dv-1",
    shipType: "BB",
    displacementKg: SafeInt(30_000_000),
    designedSpeedUms: SafeInt(15_433_320),
    armorBeltUm: SafeInt(305_000),
    mainGunsCaliberUm: SafeInt(343_000),
    mainGunsCount: SafeInt(10),
    crewComplement: SafeInt(1_000),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "pre-1",
    provenance: {
      battleAssetId: id,
      campaignAssetId: id,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "dv-1",
      sourceCompiledDesignHash: "design-1",
      preBattleStateHash: "pre-1",
      projectionReason: "child-process",
      persistenceDisposition: "persistent",
      provenanceHash: "prov-1",
    },
  };
}

const units: TacticalShipUnit[] = [
  unit("a1", "ATTACKER", "Battleship"),
  unit("a2", "ATTACKER", "Cruiser"),
  unit("d1", "DEFENDER", "Battleship"),
  unit("d2", "DEFENDER", "Cruiser"),
];

const movementStates: Record<string, MovementState> = computeInitialMovementStates(
  { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
  units.map((u) => ({
    assetId: u.assetId,
    sideId: u.sideId as "ATTACKER" | "DEFENDER",
    orderedSpeedBpKnots: 10_000,
    designedSpeedBpKnots: 20_000,
    turningRateMdegS: 1_000,
  })),
);

const state: TacticalBattleState = {
  battleId: "b2-determinism",
  mapId: "eng_ch",
  sides: [
    { sideId: "ATTACKER", participantIds: ["a1", "a2"] },
    { sideId: "DEFENDER", participantIds: ["d1", "d2"] },
  ],
  forces: { ATTACKER: ["a1", "a2"], DEFENDER: ["d1", "d2"] },
  divisions: [],
  units,
  contacts: [],
  movementStates,
  objectives: [],
  weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
  exitZones: [],
  battleEventLedger: [],
};

const orders = {
  a1: { orderedHeading: 90, orderedSpeedBp: 20_000 },
  a2: { orderedHeading: 37, orderedSpeedBp: 20_000 },
  d1: { orderedHeading: 270, orderedSpeedBp: 20_000 },
  d2: { orderedHeading: 123, orderedSpeedBp: 20_000 },
};

async function main(): Promise<void> {
  const res = advanceMinutes({
    state,
    minutes: 3,
    observationTime: "1900-01-01T00:00:00.000Z",
    orders,
  });
  const out = {
    hashes: res.hashes,
    eventCount: res.results.reduce((n, r) => n + r.events.length, 0),
    contactIds: res.results[res.results.length - 1]?.contacts.map((c) => c.contactId).sort(),
    movement: Object.entries(res.results[res.results.length - 1]!.movementStates)
      .map(([assetId, m]) => ({
        assetId,
        pos: m.position,
        heading: m.heading,
        speed: m.currentSpeed,
      }))
      .sort((a, b) => a.assetId.localeCompare(b.assetId)),
  };
  process.stdout.write(canonicalSerialize(out) + "\n");
}

main().catch((e) => {
  process.stderr.write(`CHILD_FAILED: ${(e as Error).message}\n`);
  process.exitCode = 1;
});
