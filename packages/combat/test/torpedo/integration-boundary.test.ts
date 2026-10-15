// AC-22 integration boundary — the torpedo stage lives inside the minute
// advance engine (after the damage stage), threads torpedoStates/torpedoTracks/
// target damage states across minutes like gunneryStates, and never crosses
// package boundaries: the engine imports the torpedo surface ONLY through the
// public torpedoes/index.js barrel, the torpedo modules never import the
// engine (no cycle), and no torpedo module pulls platform/node I/O.
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RandomEngine } from "@bluewave/random";
import { advanceMinute } from "../../src/simulation/engine.js";
import type { ShipDamageState } from "../../src/damage/state.js";
import { initialDamageState, type DamageContext } from "../../src/battleResolution/damage.js";
import { autoZonesForBelt } from "../../src/battleResolution/constants.js";
import {
  withGunneryStateHash,
  neutralAccuracyFactors,
  neutralRateFactors,
  type GunneryBattery,
} from "../../src/gunnery/index.js";
import {
  EMPTY_TUBE,
  TORPEDO_AMMUNITION_UNAVAILABLE,
  type TorpedoContext,
} from "../../src/torpedoes/index.js";
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
// The minute advance is split across engine.ts (orchestrator), minuteStages.ts
// (stages), and minuteResult.ts (snapshot/hash assembly); the boundary
// constraints apply to the trio.
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
    // the B-2 engine imports @bluewave/deterministic + @bluewave/random; it
    // must NOT gain new cross-package dependencies from the torpedo stage.
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
    // the allowed engine-adjacent surfaces resolve.ts SHOULD use
    expect(resolveSrc.includes('from "../battleLedger.js"')).toBe(true);
    expect(resolveSrc.includes('from "../damage/')).toBe(true);
    expect(resolveSrc.includes('from "../contact/lifecycle.js"')).toBe(true);
  });
});

// ---- the gunnery+damage rig that proves the stage ORDER (all from the
// committed B-3/B-4 fixture surfaces — run-gunnery-child + damage-flow.test).

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
    accuracyFactors: neutralAccuracyFactors(10_000), // guaranteed HIT -> real damage
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
        // ADR-0094: a 100 mm HARVEY belt so the production 343 mm shell FULLY
        // penetrates and opens a hull breach (the production-scale 305 mm belt is
        // only PARTIALLY penetrated, which adds structural but no flotation
        // damage — the accumulation under test needs both damage sources to move
        // both surfaces).
        designFlotationReserve: 50_000,
        designStabilityScore: 8_000,
        // 30 000 t design displacement — flooding severity converts kg -> bp
        // against this denominator (ADR-0047 decision 4; P-1 repair F1).
        designDisplacementKg: 30_000_000,
        beltArmorUm: 100_000,
        mainGunsCaliberUm: 343_000,
        shipType: "BB",
        maxHitPoints: 100,
      },
    },
    engine: undefined, // fixed-draw determinism
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
    // torpedo events sit at the stage's own substeps (launch 4 / impact 56)
    const torpedoEvents = res.events.filter((e) => e.eventType.startsWith("torpedo_"));
    expect(torpedoEvents.every((e) => e.substep === 4 || e.substep === 56)).toBe(true);
  });

  it("AC-22 composition (reviewer BLOCKER-2): same-minute gunnery + torpedo damage ACCUMULATES on the ship", () => {
    // Three independent minutes on fresh battle states: gunnery-only, torpedo-only,
    // and combined (gunnery + torpedo). Because the torpedo stage runs AFTER the
    // damage stage, it must resolve against the POST-gunnery ship state — so the
    // combined structuralIntegrity/flotation must be LOWER than either run alone
    // (accumulation, not replacement). Before the fix the torpedo target used the
    // caller's PRE-damage state and the merge REPLACED the gunnery state, so the
    // combined run collapsed to the torpedo-only value.
    const d1After = (res: { damageStates?: Record<string, ShipDamageState> }) => {
      const st = res.damageStates?.["d1"];
      expect(st).toBeDefined();
      return {
        structuralIntegrity: st!.structuralIntegrity,
        flotationReserve: st!.flotationReserve,
      };
    };
    const { state } = buildTorpedoScene();
    // gunnery-only minute (guaranteed HIT battery -> real damage)
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
    // torpedo-only minute (the torpedo functions and damages d1)
    const torpOnly = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("inc7-advance-fulllen"),
      torpedoes: torpedoContext({ commands: [torpedoLaunchCommand(0)] }),
    });
    const afterTorpedo = d1After(torpOnly);
    // the torpedo must actually have damaged the ship for the composition to be meaningful
    expect(afterTorpedo.structuralIntegrity).toBeLessThan(100_000);
    // combined minute (gunnery + torpedo in the same minute)
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
    // accumulation, not replacement: the combined damage is strictly worse than
    // either the damage-only or the torpedo-only run on its own.
    expect(afterCombined.structuralIntegrity).toBeLessThan(afterGunnery.structuralIntegrity);
    expect(afterCombined.structuralIntegrity).toBeLessThan(afterTorpedo.structuralIntegrity);
    expect(afterCombined.flotationReserve).toBeLessThan(afterGunnery.flotationReserve);
    expect(afterCombined.flotationReserve).toBeLessThan(afterTorpedo.flotationReserve);
  });
});

describe("AC-22 — torpedo context threads across minutes", () => {
  it("launcher consumption, live tracks, and target damage states carry into minute 2", () => {
    const engine = new RandomEngine("inc7-thread-seed");
    // place the target ~3 km out so the 35 kn torpedo does NOT reach it in
    // minute 1 — the track stays a live authoritative entity into minute 2.
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
    // minute 1 — salvo fires
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
    // thread the engine's surfaces exactly like advanceMinutes does
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
    // minute 2 — running-track resolution only; same entities, advanced state
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
