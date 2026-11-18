import { describe, expect, it } from "vite-plus/test";
import { KNOTS_TO_UMS, SafeInt } from "@bluewave/contracts";
import type { DivisionRole } from "@bluewave/campaign";
import type { MovementState } from "@bluewave/combat/movement";
import type { TacticalDivision, TacticalShipUnit } from "@bluewave/combat/tactical";
import {
  createDivisionAiMemory,
  decideDivisionOrders,
  type DivisionAiDivision,
} from "@bluewave/combat/division-ai";
import {
  DIVISION_ORDER_VERSION,
  FORCE_ORDER_VERSION,
  PROVISIONAL_FORCE_ORDER_RULESET,
  advanceForce,
  compileDivisionOrders,
  createForceRuntime,
  decodeDivisionOrderSet,
  type DivisionOrder,
} from "@bluewave/combat/orders";
import { contact, fullForce } from "./fixtures.js";

function tacticalDivision(source: DivisionAiDivision): TacticalDivision {
  return {
    tacticalDivisionId: source.divisionId,
    battleId: "battle",
    sideId: "ATTACKER",
    role: source.role as DivisionRole,
    formation: source.formation,
    orderedTacticalUnitIds: [`${source.divisionId}-ship`],
    tacticalFlagshipId: `${source.divisionId}-ship`,
    tacticalCommanderId: "VACANT",
    sourcePermanentDivisionIds: [],
    projectionAdjustmentRecords: [],
    campaignAssetProvenanceIds: [],
    temporaryAssetProvenanceIds: [],
    initialExperience: SafeInt(20),
    initialCohesion: SafeInt(30),
    rulesetVersion: "ruleset",
    recordHash: "record",
  };
}

function unit(source: DivisionAiDivision): TacticalShipUnit {
  const assetId = `${source.divisionId}-ship`;
  return {
    assetId,
    campaignShipId: assetId,
    sideId: "ATTACKER",
    name: assetId,
    className: "Test",
    designVersionId: "design",
    shipType: source.shipTypes[0]!,
    displacementKg: SafeInt(1_000_000),
    designedSpeedUms: SafeInt(Math.round(source.maxSpeedKnots * KNOTS_TO_UMS)),
    armorBeltUm: SafeInt(0),
    mainGunsCaliberUm: SafeInt(0),
    mainGunsCount: SafeInt(0),
    crewComplement: SafeInt(100),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "hash",
    provenance: {
      battleAssetId: assetId,
      campaignAssetId: assetId,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "design",
      sourceCompiledDesignHash: "design-hash",
      preBattleStateHash: "pre-hash",
      projectionReason: "test",
      persistenceDisposition: "persistent",
      provenanceHash: "prov",
    },
  };
}

function movement(source: DivisionAiDivision): MovementState {
  return {
    position: [source.position.xMetres * 1_000_000, source.position.yMetres * 1_000_000],
    heading: source.headingDeg,
    orderedSpeed: 0,
    currentSpeed: 0,
    acceleration: 0,
    turningRate: 1_000,
    collisionRadius: 5_000_000,
    propulsionState: "steam",
    machineryReliability: 10_000,
    fuelState: "coal",
    formationStation: "LEAD",
  };
}

const state = fullForce({ contacts: [contact("E1", "CAPITAL", 14_000, 3_000)] });

describe("division AI in the production order pipeline", () => {
  it("compiles every emitted order without issues", () => {
    const decision = decideDivisionOrders(state, createDivisionAiMemory());
    const set = decodeDivisionOrderSet({
      version: DIVISION_ORDER_VERSION,
      divisions: decision.orders,
    });
    const movements: Record<string, MovementState> = {};
    for (const source of state.divisions) movements[`${source.divisionId}-ship`] = movement(source);
    const result = compileDivisionOrders({
      orders: set,
      units: state.divisions.map(unit),
      divisions: state.divisions.map(tacticalDivision),
      baseOrders: Object.fromEntries(
        state.divisions.map((d) => [
          `${d.divisionId}-ship`,
          { orderedHeading: 90, orderedSpeedBp: 30_000 },
        ]),
      ),
      movement: movements,
    });
    expect(result.issues).toEqual([]);
    expect(Object.keys(result.unitOrders)).toHaveLength(state.divisions.length);
    expect(result.unitOrders["C-CORE-ship"]?.orderedHeading).not.toBe(90);
  });

  it("keeps the player lead and dependants intact when the lead changes with an AI INDEPENDENT present", () => {
    const decision = decideDivisionOrders(state, createDivisionAiMemory());
    const leadOrder: DivisionOrder = {
      divisionId: "LEAD",
      navigation: { kind: "STANCE", stance: "ENGAGE" },
      speed: { kind: "PERCENT", percent: 100 },
      formation: "LINE_AHEAD",
      role: "INDEPENDENT",
      leadDivisionId: null,
      control: "PLAYER",
      turnTogether: false,
      issuedAtMinute: 0,
    };
    const result = advanceForce({
      forceId: "ATTACKER",
      orders: {
        version: FORCE_ORDER_VERSION,
        orders: [
          {
            forceId: "ATTACKER",
            kind: "CHANGE_LEAD_DIVISION",
            divisionId: "C-CORE",
            issuedAtMinute: 10,
          },
        ],
      },
      runtime: createForceRuntime(PROVISIONAL_FORCE_ORDER_RULESET),
      minute: 10,
      realismMode: "ADMIRAL",
      control: "PLAYER",
      divisions: state.divisions.map(tacticalDivision),
      divisionOrders: {
        version: DIVISION_ORDER_VERSION,
        divisions: [leadOrder, ...decision.orders],
      },
      situation: { casualtyBp: 0, ammunitionBp: 10_000 },
      ruleset: PROVISIONAL_FORCE_ORDER_RULESET,
    });
    expect(result.issues).toEqual([]);
    expect(result.runtime.lead?.divisionId).toBe("C-CORE");
    expect(result.runtime.lead?.dependantIds).toEqual([
      "D-SUPPORT",
      "E-SCOUT",
      "F-SCREEN",
      "G-PATROL",
      "H-INDEP",
      "LEAD",
    ]);
    const byId = new Map(result.divisionOrders.divisions.map((o) => [o.divisionId, o]));
    expect(byId.get("C-CORE")).toMatchObject({ role: "INDEPENDENT", leadDivisionId: null });
    for (const id of ["LEAD", "D-SUPPORT", "E-SCOUT", "F-SCREEN", "G-PATROL", "H-INDEP"]) {
      expect(byId.get(id)?.leadDivisionId).toBe("C-CORE");
    }
  });
});
