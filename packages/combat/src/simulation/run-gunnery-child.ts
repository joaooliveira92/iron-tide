import { canonicalSerialize } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import type { TacticalBattleState, TacticalShipUnit } from "../tactical/index.js";
import type { MovementState } from "../movement/state.js";
import type { TacticalContact } from "../contact/lifecycle.js";
import { computeInitialMovementStates } from "./spawn.js";
import { advanceMinutes } from "./engine.js";
import {
  neutralAccuracyFactors,
  neutralRateFactors,
  type GunneryBattery,
  withGunneryStateHash,
} from "../gunnery/index.js";

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

const BATTLE_ID = "b2-gunnery-determinism";
const units: TacticalShipUnit[] = [
  unit("a1", "ATTACKER", "Battleship"),
  unit("d1", "DEFENDER", "Battleship"),
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

const contact: TacticalContact = {
  contactId: `${BATTLE_ID}:d1`,
  battleId: BATTLE_ID,
  assetId: "d1",
  sideId: "DEFENDER",
  estimatedIdentity: "Battleship",
  position: movementStates["d1"]!.position,
  course: 270,
  speed: 10_000,
  confidence: 10_000,
  observationTime: "1900-01-01T00:00:00.000Z",
  source: "visual",
  uncertainty: 0,
  lastUpdateMinute: 1,
  stale: false,
  sources: ["visual"],
};

const batteryState = withGunneryStateHash({
  batteryId: "BAT-1",
  ownerShipId: "a1",
  gunDefinitionId: "GUN-305-45",
  mountDefinitionId: "MNT-305-TWIN",
  targetContactId: `${BATTLE_ID}:d1`,
  acquisitionProgressBp: 8_000,
  rangeEstimateUm: 10_000_000_000,
  rangeUncertaintyUm: 150_000_000,
  fireControlSolutionQualityBp: 8_000,
  ammunition: { ARMOR_PIERCING: 120, COMMON: 80, HIGH_EXPLOSIVE: 40 },
  fireMode: "NORMAL",
  reloadProgressMs: 2_000,
  straddleState: null,
  damageState: null,
  aaEligibilityState: null,
  lastSalvoMinute: -1,
  lastSalvoSubstep: 0,
  rulesetVersion: "gunnery_ruleset_v1",
  formulaVersion: "gunnery_formula_v1",
});

const gunnery: GunneryBattery[] = [
  {
    id: "BAT-1",
    ownerShipId: "a1",
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount: 4,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    accuracyFactors: neutralAccuracyFactors(5_000),
    state: batteryState,
  },
];

const state: TacticalBattleState = {
  battleId: BATTLE_ID,
  mapId: "eng_ch",
  sides: [
    { sideId: "ATTACKER", participantIds: ["a1"] },
    { sideId: "DEFENDER", participantIds: ["d1"] },
  ],
  forces: { ATTACKER: ["a1"], DEFENDER: ["d1"] },
  divisions: [],
  units,
  contacts: [contact],
  movementStates,
  objectives: [],
  weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
  exitZones: [],
  battleEventLedger: [],
};

const orders = {
  a1: { orderedHeading: 90, orderedSpeedBp: 20_000 },
  d1: { orderedHeading: 270, orderedSpeedBp: 20_000 },
};

async function main(): Promise<void> {
  const res = advanceMinutes({
    state,
    minutes: 3,
    observationTime: "1900-01-01T00:00:00.000Z",
    orders,
    engine: new RandomEngine("gunnery-child-master-seed"),
    gunnery,
  });
  const gunneryEvents = res.results.flatMap((r) =>
    r.events.filter((e) => e.eventType === "gunnery_salvo").map((e) => e.eventHash),
  );
  const last = res.results[res.results.length - 1];
  const lastStates = last?.gunneryStates
    ? Object.entries(last.gunneryStates).map(([id, s]) => ({
        id,
        ammunition: s.ammunition,
        lastSalvoMinute: s.lastSalvoMinute,
        reloadProgressMs: s.reloadProgressMs,
      }))
    : [];
  const out = {
    hashes: res.hashes,
    gunneryEventCount: gunneryEvents.length,
    gunneryEventHashes: gunneryEvents,
    lastGunneryStates: lastStates.sort((a, b) => a.id.localeCompare(b.id)),
  };
  process.stdout.write(canonicalSerialize(out) + "\n");
}

main().catch((e) => {
  process.stderr.write(`CHILD_FAILED: ${(e as Error).message}\n`);
  process.exitCode = 1;
});
