import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RandomEngine } from "@bluewave/random";
import { advanceMinute } from "@bluewave/combat/simulation";
import type { ShipDamageState } from "@bluewave/combat/damage";
import { initialDamageState, type DamageContext } from "@bluewave/combat/battleResolution";
import { autoZonesForBelt } from "@bluewave/combat/battleResolution";
import {
  withGunneryStateHash,
  neutralAccuracyFactors,
  neutralRateFactors,
  type GunneryBattery,
} from "@bluewave/combat/gunnery";
import {
  EMPTY_TUBE,
  TORPEDO_AMMUNITION_UNAVAILABLE,
  type TorpedoContext,
} from "@bluewave/combat/torpedoes";
import {
  buildTorpedoScene,
  torpedoContext,
  torpedoLaunchCommand,
  TORPEDO_SCENE_ORDERS,
  TORPEDO_BATTLE_ID,
} from "./advance.test.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(thisDir, "..", "..", "src");
const engineSrc = readFileSync(resolve(srcDir, "simulation", "engine.ts"), "utf8");
const minuteStagesSrc = readFileSync(resolve(srcDir, "simulation", "minuteStages.ts"), "utf8");
const minuteResultSrc = readFileSync(resolve(srcDir, "simulation", "minuteResult.ts"), "utf8");
const simulationSrc = engineSrc + minuteStagesSrc + minuteResultSrc;
const resolveSrc = readFileSync(resolve(srcDir, "torpedoes", "resolve.ts"), "utf8");
const torpedoTxt =
  readFileSync(resolve(srcDir, "torpedoes", "index.ts"), "utf8") +
  readFileSync(resolve(srcDir, "torpedoes", "records.ts"), "utf8") +
  readFileSync(resolve(srcDir, "torpedoes", "ordering.ts"), "utf8");

const OBSERVATION_TIME = "1900-01-01T00:00:00.000Z";

describe("AC-22 — engine package boundary", () => {
  it("the simulation modules import the torpedo surface only through the public index barrel", () => {
    const torpedoImports = simulationSrc.match(/from "\.\.\/torpedoes\/[^"]+"/g) ?? [];
    expect([...new Set(torpedoImports)]).toEqual([`from "../torpedoes/index.js"`]);
  });

  it("the simulation modules have exactly their committed cross-package imports (deterministic + random)", () => {
    const cross = simulationSrc.match(/from "@bluewave\/[^"]+"/g) ?? [];
    expect([...new Set(cross)].sort()).toEqual([
      'from "@bluewave/deterministic"',
      'from "@bluewave/random"',
    ]);
  });

  it("torpedo modules never import the engine (no cycle) and no platform I/O", () => {
    expect(torpedoTxt.match(/\.\.\/simulation\//)).toBeNull();
    expect(torpedoTxt.match(/\b(node:fs|node:path|node:os)\b/)).toBeNull();
    expect(torpedoTxt.match(/Math\.random\(/)).toBeNull();
  });

  it("resolve.ts stays within the torpedo/damage/ledger/movement surfaces", () => {
    const forbidden = [
      "../gunnery/",
      "../weather/",
      "../tactical/",
      "../battleResolution/",
      "../simulation/",
    ];
    for (const path of forbidden) expect(resolveSrc.includes(`from "${path}`)).toBe(false);
    expect(resolveSrc.includes('from "../core/battleLedger.js"')).toBe(true);
    expect(resolveSrc.includes('from "../damage/')).toBe(true);
    expect(resolveSrc.includes('from "../contact/neighbour.js"')).toBe(true);
  });
});

function gunneryBattery(): GunneryBattery {
  const batteryState = withGunneryStateHash({
    batteryId: "BAT-1",
    ownerShipId: "a1",
    gunDefinitionId: "GUN-305-45",
    mountDefinitionId: "MNT-305-TWIN",
    targetContactId: `${TORPEDO_BATTLE_ID}:d1`,
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
  return {
    id: "BAT-1",
    ownerShipId: "a1",
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount: 4,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    accuracyFactors: neutralAccuracyFactors(10_000),
    state: batteryState,
  };
}

function damageContext(): DamageContext {
  return {
    battleId: TORPEDO_BATTLE_ID,
    targets: {
      d1: {
        shipId: "d1",
        zones: autoZonesForBelt(100_000),
        compartments: ["COMP-BELT-1"],
        components: ["TURRET-1", "ENGINE-1"],
        state: initialDamageState("d1"),
        designFlotationReserve: 50_000,
        designStabilityScore: 8_000,
        designDisplacementKg: 30_000_000,
        beltArmorUm: 100_000,
        mainGunsCaliberUm: 343_000,
        shipType: "BB",
        maxHitPoints: 100,
      },
    },
    engine: undefined,
    randomLedger: undefined,
  };
}

describe("AC-22 — torpedo stage placement AFTER the damage stage", () => {
  it("damage events (and their substep 3) precede the torpedo launch events", () => {
    const { state } = buildTorpedoScene();
    const res = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("inc7-after-damage"),
      gunnery: [gunneryBattery()],
      damage: damageContext(),
      torpedoes: torpedoContext({ commands: [torpedoLaunchCommand(0)] }),
    });
    const types = res.events.map((e) => e.eventType);
    expect(types).toContain("damage_impact");
    expect(types).toContain("torpedo_launch");
    const lastDamage = types.lastIndexOf("damage_impact");
    const firstTorpedo = types.indexOf("torpedo_launch");
    expect(lastDamage).toBeGreaterThanOrEqual(0);
    expect(firstTorpedo).toBeGreaterThan(lastDamage);
    const torpedoEvents = res.events.filter((e) => e.eventType.startsWith("torpedo_"));
    expect(torpedoEvents.every((e) => e.substep === 4 || e.substep === 56)).toBe(true);
  });

  it("AC-22 composition (reviewer BLOCKER-2): same-minute gunnery + torpedo damage ACCUMULATES on the ship", () => {
    const d1After = (res: { damageStates?: Record<string, ShipDamageState> }) => {
      const st = res.damageStates?.["d1"];
      expect(st).toBeDefined();
      return {
        structuralIntegrity: st!.structuralIntegrity,
        flotationReserve: st!.flotationReserve,
      };
    };
    const { state } = buildTorpedoScene();
    const dmgOnly = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("inc7-advance-fulllen"),
      gunnery: [gunneryBattery()],
      damage: damageContext(),
    });
    const afterGunnery = d1After(dmgOnly);
    const torpOnly = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("inc7-advance-fulllen"),
      torpedoes: torpedoContext({ commands: [torpedoLaunchCommand(0)] }),
    });
    const afterTorpedo = d1After(torpOnly);
    expect(afterTorpedo.structuralIntegrity).toBeLessThan(100_000);
    const combined = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("inc7-advance-fulllen"),
      gunnery: [gunneryBattery()],
      damage: damageContext(),
      torpedoes: torpedoContext({ commands: [torpedoLaunchCommand(0)] }),
    });
    const afterCombined = d1After(combined);
    expect(afterCombined.structuralIntegrity).toBeLessThan(afterGunnery.structuralIntegrity);
    expect(afterCombined.structuralIntegrity).toBeLessThan(afterTorpedo.structuralIntegrity);
    expect(afterCombined.flotationReserve).toBeLessThan(afterGunnery.flotationReserve);
    expect(afterCombined.flotationReserve).toBeLessThan(afterTorpedo.flotationReserve);
  });
});

describe("AC-22 — torpedo context threads across minutes", () => {
  it("launcher consumption, live tracks, and target damage states carry into minute 2", () => {
    const engine = new RandomEngine("inc7-thread-seed");
    const farPos: [number, number] = [3_000_000_000, 5_000_000_000];
    const scene = buildTorpedoScene();
    const state = {
      ...scene.state,
      movementStates: {
        ...scene.state.movementStates,
        d1: {
          ...(scene.state.movementStates?.d1 ?? buildTorpedoScene().state.movementStates!.d1),
          position: farPos,
        },
      },
      contacts: [{ ...scene.contact, position: farPos }],
    };
    let torpedo: TorpedoContext = torpedoContext({ commands: [torpedoLaunchCommand(0)] });
    const m1 = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine,
      torpedoes: torpedo,
    });
    expect(m1.torpedoStates!["LCH-1"].loadedPerTube[0]).toBe(EMPTY_TUBE);
    const trackIds1 = m1.torpedoTracks!.map((t) => t.torpedoTrackId).sort();
    expect(trackIds1.length).toBeGreaterThan(0);
    torpedo = torpedoContext({
      launchers: torpedoContext().launchers.map((w) =>
        m1.torpedoStates![w.launcher.launcherId]
          ? { ...w, launcher: m1.torpedoStates![w.launcher.launcherId]! }
          : w,
      ),
      commands: [],
      tracks: m1.torpedoTracks!.map((t) => ({ ...t })),
    });
    if (m1.damageStates && m1.damageStates["d1"]) {
      torpedo = {
        ...torpedo,
        targets: {
          ...torpedo.targets,
          d1: { ...torpedo.targets.d1!, damageState: m1.damageStates["d1"]! },
        },
      };
    }
    const m2 = advanceMinute({
      state: { ...state, contacts: m1.contacts.map((c) => ({ ...c })) },
      minute: 2,
      observationTime: OBSERVATION_TIME,
      engine,
      torpedoes: torpedo,
    });
    expect(m2.torpedoTracks!.map((t) => t.torpedoTrackId).sort()).toEqual([...trackIds1].sort());
    expect(m2.torpedoTracks!.every((t) => t.distanceTraveledUm > 0)).toBe(true);
  });
});

describe("AC-22 — fail-closed guards at the integration seam", () => {
  it("a command for an already-expended tube fails closed", () => {
    const { state } = buildTorpedoScene();
    const engine = new RandomEngine("seed-fail-closed");
    const first = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      engine,
      torpedoes: torpedoContext({ commands: [torpedoLaunchCommand(0)] }),
    });
    const second: TorpedoContext = torpedoContext({
      launchers: torpedoContext().launchers.map((w) =>
        first.torpedoStates![w.launcher.launcherId]
          ? { ...w, launcher: first.torpedoStates![w.launcher.launcherId]! }
          : w,
      ),
      commands: [torpedoLaunchCommand(0)],
    });
    expect(() =>
      advanceMinute({
        state,
        minute: 2,
        observationTime: OBSERVATION_TIME,
        engine,
        torpedoes: second,
      }),
    ).toThrow(TORPEDO_AMMUNITION_UNAVAILABLE);
  });

  it("a command for a launcher the battle does not wire fails closed (TORPEDO_STATE_INVARIANT_FAILED)", () => {
    const { state } = buildTorpedoScene();
    const bogus: TorpedoContext = torpedoContext({ commands: [torpedoLaunchCommand(0)] });
    expect(() =>
      advanceMinute({
        state,
        minute: 1,
        observationTime: OBSERVATION_TIME,
        torpedoes: { ...bogus, launchers: [] },
      }),
    ).toThrow();
  });
});
