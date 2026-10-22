import { SafeInt } from "@bluewave/contracts";
import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CarrierOperationsState, CarrierOperationRecord } from "@bluewave/combat";
import {
  CVL_MIN_CAPACITY,
  carrierClassification,
  physicalCapacityUnits,
  assertCarrierOperationsState,
  createCarrierOperationRecord,
  recordComparator,
} from "@bluewave/combat";
import type { RandomStream } from "@bluewave/random";
import type { PhaseDescriptor } from "./registry.js";
import { PhaseResource } from "./phase-resource.js";

export interface CarrierOperationsPhaseInput {
  snapshot: CampaignSnapshot;
  campaignMonth: string;
  rngStream: RandomStream;
}

export interface CarrierOperationsPhaseOutput {
  snapshot: CampaignSnapshot;
  records: CarrierOperationRecord[];
}

function getCarrierOps(nation: NationState): Record<string, unknown> {
  const stored = (nation["carrierOperations"] ?? {}) as unknown;
  if (typeof stored === "object" && stored !== null) {
    return stored as Record<string, unknown>;
  }
  return {};
}

function identifyCarrierShips(nation: NationState, carrierOps: Record<string, unknown>): string[] {
  const carrierShipIds: string[] = [];
  for (const fleet of nation["fleets"]) {
    for (const ship of fleet["ships"]) {
      const sid = ship["id"];
      if (carrierOps[sid] !== undefined) {
        carrierShipIds.push(sid);
        continue;
      }
      const shipAsRecord = ship as unknown as Record<string, unknown>;
      const compiledAircraftCapacity = shipAsRecord["compiledAircraftCapacity"];
      if (
        typeof compiledAircraftCapacity === "number" &&
        compiledAircraftCapacity >= CVL_MIN_CAPACITY
      ) {
        carrierShipIds.push(sid);
      }
    }
  }
  return carrierShipIds;
}

function processCarrierNation(
  nation: NationState,
  _nationId: string,
  _campaignMonth: string,
  _rngStream: RandomStream,
): { updatedNation: NationState; records: CarrierOperationRecord[] } {
  const records: CarrierOperationRecord[] = [];

  if (!nation["isPlayable"] && !nation["isAI"]) {
    return { updatedNation: nation, records };
  }

  const carrierOps = getCarrierOps(nation);
  const carrierShipIds = identifyCarrierShips(nation, carrierOps);

  if (carrierShipIds.length === 0) {
    return { updatedNation: nation, records };
  }

  const updatedCarrierOps: Record<string, unknown> = { ...carrierOps };

  for (const shipId of carrierShipIds) {
    const existing = carrierOps[shipId] as CarrierOperationsState | undefined;
    if (existing !== undefined) {
      try {
        assertCarrierOperationsState(existing);
      } catch {
        continue;
      }
      records.push(
        createCarrierOperationRecord(
          {
            minute: 0,
            substep: "monthly_validation",
            carrierId: shipId,
            formulaVersion: existing.formulaVersion,
            contentVersion: "1.0",
            rulesetVersion: existing.rulesetVersion,
          },
          { deckState: existing.deckCycleState },
        ),
      );
      continue;
    }

    const ship = nation["fleets"].flatMap((f) => f["ships"]).find((s) => s["id"] === shipId);
    if (!ship) continue;

    const shipAsRecord = ship as unknown as Record<string, unknown>;
    const compiledAircraftCapacity = shipAsRecord["compiledAircraftCapacity"] as number | undefined;
    if (typeof compiledAircraftCapacity !== "number") continue;

    const classification = carrierClassification(compiledAircraftCapacity);
    const capacity = physicalCapacityUnits(compiledAircraftCapacity);

    const initialState: CarrierOperationsState = {
      shipId,
      compiledDesignId: ship["designVersionId"] ?? "",
      classification,
      physicalCapacityUnits: capacity,
      occupiedCapacityUnits: SafeInt.ZERO,
      currentSpotValue: SafeInt.ZERO,
      deckCycleState: "STRUCK_DOWN",
      deckConfigurationId: "default",
      catapultDefinitions: [],
      liftDefinitions: [],
      flightDeckCondition: 10000,
      hangarCondition: 10000,
      aviationFuelState: {
        fuelRemainingBp: SafeInt.ZERO,
        fuelCapacityBp: SafeInt.ZERO,
      },
      ordnanceInventory: [],
      assignedAirGroupSquadronIds: [],
      spottedAircraftCount: SafeInt.ZERO,
      fueledAircraftCount: SafeInt.ZERO,
      armedAircraftCount: SafeInt.ZERO,
      airborneAircraftCount: SafeInt.ZERO,
      returningAircraftCount: SafeInt.ZERO,
      damagedAircraftCount: SafeInt.ZERO,
      activeLaunchReservations: [],
      activeRecoveryReservations: [],
      weatherOperabilityState: {
        currentSeaState: SafeInt.ZERO,
        windOverDeckKnots: SafeInt.ZERO,
        precipitationIntensityBp: SafeInt.ZERO,
        visibilityNauticalMiles: SafeInt.ZERO,
        deckFireIntensityBp: SafeInt.ZERO,
        nightOperationsActive: false,
      },
      rulesetVersion: "carrier_operations_ruleset_v1",
      formulaVersion: "1",
      stateHash: "",
    };

    updatedCarrierOps[shipId] = initialState as unknown as Record<string, unknown>;

    records.push(
      createCarrierOperationRecord(
        {
          minute: 0,
          substep: "state_initialized",
          carrierId: shipId,
          formulaVersion: "1",
          contentVersion: "1.0",
          rulesetVersion: "carrier_operations_ruleset_v1",
        },
        {
          spotResult: SafeInt.ZERO,
          deckState: "STRUCK_DOWN",
        },
      ),
    );
  }

  const updatedNation: NationState = {
    ...nation,
    carrierOperations: updatedCarrierOps as unknown as Record<string, unknown>,
  } as NationState;

  records.sort((a, b) => {
    const ka = {
      carrierId: a.carrierId,
      isEmergency: false,
      operationClassPriority: 0,
      strikeLaunchMinute: 0,
      strikeId: "",
      squadronId: "",
      aircraftModelId: "",
      aircraftId: "",
      equipmentId: "",
      hazardEventId: "",
      ordnanceItemId: "",
      transactionId: "",
    };
    const kb = {
      carrierId: b.carrierId,
      isEmergency: false,
      operationClassPriority: 0,
      strikeLaunchMinute: 0,
      strikeId: "",
      squadronId: "",
      aircraftModelId: "",
      aircraftId: "",
      equipmentId: "",
      hazardEventId: "",
      ordnanceItemId: "",
      transactionId: "",
    };
    return recordComparator(ka, kb);
  });

  return { updatedNation, records };
}

export function resolveCarrierOperations(
  input: CarrierOperationsPhaseInput,
): CarrierOperationsPhaseOutput {
  const { snapshot, campaignMonth, rngStream } = input;
  const records: CarrierOperationRecord[] = [];
  const updatedNations = new Map<string, NationState>();

  let hasAnyCarriers = false;
  for (const [_nationId, nation] of snapshot["nations"]) {
    const carrierOps = getCarrierOps(nation);
    const carrierIds = identifyCarrierShips(nation, carrierOps);
    if (carrierIds.length > 0) {
      hasAnyCarriers = true;
      break;
    }
  }

  if (!hasAnyCarriers) {
    return { snapshot, records: [] };
  }

  for (const [nationId, nation] of snapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) {
      updatedNations.set(nationId, nation);
      continue;
    }
    const result = processCarrierNation(nation, nationId, campaignMonth, rngStream);
    updatedNations.set(nationId, result.updatedNation);
    records.push(...result.records);
  }

  return {
    snapshot: { ...snapshot, nations: updatedNations },
    records,
  };
}

export const carrierOperationsPhase: PhaseDescriptor = {
  id: "resolve_carrier_operations",
  name: "Carrier Operations Resolution",
  order: 73,
  readPermissions: ["nations"],
  writePermissions: ["nations"],
  rngAllowed: true,
  footprint: {
    reads: [PhaseResource.NATIONS],
    writes: [PhaseResource.NATIONS],
    usesRng: true,
  },
  run: (ctx) => {
    const carrierRng = ctx.phaseGuard.rng("resolve_carrier_operations", ctx.randomSeed);
    if (carrierRng) {
      const result = resolveCarrierOperations({
        snapshot: ctx.currentSnapshot,
        campaignMonth: ctx.campaignMonth,
        rngStream: carrierRng.stream("carrier/operations"),
      });
      ctx.currentSnapshot = result.snapshot;
    }
    return { status: "continue" };
  },
};
