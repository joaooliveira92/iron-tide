// Ticket 03 (playable-loop reachability): the smoke (C-5), air-combat (D-3) and
// air-defense (D-4) tactical stages are reachable through the production
// `resolveBattleAuto` path from optional, authoritative manifest capability
// declarations — and remain strict, valid no-ops when no capability is declared.
import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import { Category, Layer, createAirDefenseSystemDefinition } from "../../src/air-defense/index.js";
import {
  projectAirCombatContext,
  projectAirDefenseContext,
  projectSmokeContext,
} from "../../src/battleResolution/capabilities.js";
import { resolveBattleAuto } from "../../src/battleResolution/resolve.js";
import type { BattleWeatherComponents } from "../../src/weather/components.js";
import type { AirDefenseInstallationDeclaration } from "../../src/generation/capabilities.js";
import { BATTLE_ID, makeAutoInput, makeManifest } from "./fixtures.js";

function heavySystem() {
  return createAirDefenseSystemDefinition({
    systemId: "sys_heavy_01",
    layer: Layer.HEAVY_AA,
    category: Category.HEAVY_AA,
    baseKillBp: SafeInt(2_000),
    baseDamageBp: SafeInt(2_000),
    baseAbortBp: SafeInt(2_000),
    baseDisruptionBp: SafeInt(2_000),
    roundsPerEngagement: SafeInt(5),
    profileEligibility: new Set(["AIRCRAFT_LEVEL_BOMBING"]),
    engagementChannels: new Set(["ch001"]),
  });
}

const ATTACKING_STRIKE = {
  kind: "STRIKE" as const,
  sideId: "ATTACKER" as const,
  missionId: "m-1",
  strikeId: "strike-1",
  squadronIds: ["sq-bomber"],
  targetId: "d1",
  launchPosition: [0, 0] as [number, number],
  speedMps: 77,
  fuelRemainingMinutes: 30,
  phase: "ATTACKING" as const,
};

const INTERCEPTING_CAP = {
  kind: "CAP" as const,
  sideId: "DEFENDER" as const,
  squadronId: "sq-cap",
  stationPosition: [0, 0] as [number, number],
  operationalAircraftCount: 4,
  rangeDistance: 500,
  speedScore: 60,
  engagementState: "INTERCEPTING" as const,
  interceptTargetId: "strike-1",
};

const SMOKE_SOURCE = {
  smokeCloudId: "sc-1",
  sourceId: "a1",
  owner: "n-uk",
  sourceType: "FUNNEL" as const,
  centroidPosition: [0, 0] as [number, number],
  densityBp: 5_000,
  verticalExtentM: 50,
  fuelComposition: "coal",
};

const AA_INSTALLATION: AirDefenseInstallationDeclaration = {
  defenderId: "d1",
  systems: [heavySystem()],
};

/** Weather components identical to the fixture's committed strategic weather,
 *  used to unit-test the smoke projection without running a battle. */
function fixtureComponents(): BattleWeatherComponents {
  return {
    battleId: BATTLE_ID,
    seaState: 3,
    windDirectionDeg: 225,
    windSpeedUmPerSec: 8_000_000,
    precipitationType: "NONE",
    precipitationIntensityBp: 0,
    fogMistDensityBp: 500,
    cloudCoverBp: 5_000,
    timeOfDay: "DAY",
    solarBearingDeg: 180,
    solarElevationDeg: 45,
    glareIntensityBp: 0,
    baseVisibilityUm: 60_000_000_000,
    localSmokeFields: [],
    rulesetVersion: "weather_ruleset_v1",
    formulaVersion: "weather_formula_v1",
    stateHash: "fixture",
  };
}

describe("Ticket 03 — capability projection from authoritative manifest data", () => {
  it("projects a SmokeContext from the manifest's committed smoke sources + weather", () => {
    const context = projectSmokeContext(
      makeManifest({ smokeSources: [SMOKE_SOURCE] }),
      fixtureComponents(),
    );
    expect(context.clouds).toHaveLength(1);
    expect(context.clouds[0]!.smokeCloudId).toBe("sc-1");
    expect(context.clouds[0]!.sourceType).toBe("FUNNEL");
    // 8_000_000 µm/s = 15 kn; wind direction / precipitation pass through.
    expect(context.windSpeedKnots).toBe(15);
    expect(context.windDirection).toBe(225);
    expect(context.precipitationIntensityBp).toBe(0);
  });

  it("projects an empty (valid no-op) SmokeContext when no sources are declared", () => {
    const context = projectSmokeContext(makeManifest(), fixtureComponents());
    expect(context.clouds).toEqual([]);
  });

  it("projects an AirCombatContext from the manifest's committed air groups", () => {
    const context = projectAirCombatContext(
      makeManifest({ airGroups: [INTERCEPTING_CAP, ATTACKING_STRIKE] }),
      BATTLE_ID,
    );
    expect(context.capPatrols).toHaveLength(1);
    expect(context.capPatrols![0]!.engagementState).toBe("INTERCEPTING");
    expect(context.strikeMissions).toHaveLength(1);
    expect(context.strikeMissions![0]!.phase).toBe("ATTACKING");
  });

  it("projects an empty AirCombatContext when no air groups are declared", () => {
    const context = projectAirCombatContext(makeManifest(), BATTLE_ID);
    expect(context.capPatrols).toBeUndefined();
    expect(context.strikeMissions).toBeUndefined();
  });

  it("projects an AirDefenseContext (powered, seeded magazines) from the manifest", () => {
    const context = projectAirDefenseContext(
      makeManifest({
        airDefenseInstallations: [AA_INSTALLATION],
        airGroups: [ATTACKING_STRIKE],
      }),
      new RandomEngine("ad"),
    );
    expect(context.defenders).toHaveLength(1);
    expect(context.defenders[0]!.state.defenderId).toBe("d1");
    expect(Number(context.defenders[0]!.state.powerBp)).toBe(10_000);
    expect(Number(context.defenders[0]!.state.ammunitionByType.get("sys_heavy_01"))).toBe(1_000);
    // The ATTACKING strike becomes the enemy air attack the installation engages.
    expect(context.attacks).toHaveLength(1);
    expect(context.attacks[0]!.targetId).toBe("d1");
  });

  it("projects empty defenders/attacks when no air-defense capability is declared", () => {
    const context = projectAirDefenseContext(makeManifest(), new RandomEngine("ad"));
    expect(context.defenders).toEqual([]);
    expect(context.attacks).toEqual([]);
  });
});

describe("Ticket 03 — smoke / air stages reachable through resolveBattleAuto", () => {
  it("smoke effects are reachable: committed smoke sources change the battle ledger", () => {
    const baseline = resolveBattleAuto(makeAutoInput());
    const withSmoke = resolveBattleAuto(
      makeAutoInput({ manifest: makeManifest({ smokeSources: [SMOKE_SOURCE] }) }),
    );
    expect(baseline.smokeActivity).toBeUndefined();
    expect(withSmoke.smokeActivity).toBeDefined();
    expect(withSmoke.smokeActivity!.events).toBeGreaterThan(0);
    expect(withSmoke.eventLedgerHash).not.toBe(baseline.eventLedgerHash);
  });

  it("air combat is reachable: committed CAP/strike groups produce activity", () => {
    const baseline = resolveBattleAuto(makeAutoInput());
    const withAir = resolveBattleAuto(
      makeAutoInput({ manifest: makeManifest({ airGroups: [INTERCEPTING_CAP] }) }),
    );
    expect(baseline.airCombatActivity).toBeUndefined();
    expect(withAir.airCombatActivity).toBeDefined();
    expect(withAir.airCombatActivity!.capEngagements).toBeGreaterThan(0);
  });

  it("air defense is reachable: an installation + attacking strike produce engagements", () => {
    const baseline = resolveBattleAuto(makeAutoInput());
    const withAd = resolveBattleAuto(
      makeAutoInput({
        manifest: makeManifest({
          airDefenseInstallations: [AA_INSTALLATION],
          airGroups: [ATTACKING_STRIKE],
        }),
      }),
    );
    expect(baseline.airDefenseActivity).toBeUndefined();
    expect(withAd.airDefenseActivity).toBeDefined();
    expect(withAd.airDefenseActivity!.engagements).toBeGreaterThan(0);
  });

  it("missing smoke/air capability is a valid no-op, never an error", () => {
    const a = resolveBattleAuto(makeAutoInput());
    const b = resolveBattleAuto(makeAutoInput());
    expect(a.resultHash).toBe(b.resultHash);
    expect(a.smokeActivity).toBeUndefined();
    expect(a.airCombatActivity).toBeUndefined();
    expect(a.airDefenseActivity).toBeUndefined();
    expect(a.battleEndReason).toBe(b.battleEndReason);
  });

  it("existing deterministic fixtures stay byte-identical with and without declared capability", () => {
    const baseline = resolveBattleAuto(makeAutoInput());
    const repeat = resolveBattleAuto(makeAutoInput());
    expect(repeat.resultHash).toBe(baseline.resultHash);
    expect(repeat.minuteHashes).toEqual(baseline.minuteHashes);
    expect(repeat.eventLedgerHash).toBe(baseline.eventLedgerHash);

    const smokeInput = makeAutoInput({ manifest: makeManifest({ smokeSources: [SMOKE_SOURCE] }) });
    const smokeRepeat = makeAutoInput({
      manifest: makeManifest({ smokeSources: [SMOKE_SOURCE] }),
    });
    const s1 = resolveBattleAuto(smokeInput);
    const s2 = resolveBattleAuto(smokeRepeat);
    expect(s2.resultHash).toBe(s1.resultHash);
    expect(s2.minuteHashes).toEqual(s1.minuteHashes);
  });

  it("declared capability does not disturb battle ordering/reporting (result surface intact)", () => {
    const result = resolveBattleAuto(
      makeAutoInput({
        manifest: makeManifest({
          smokeSources: [SMOKE_SOURCE],
          airGroups: [ATTACKING_STRIKE],
          airDefenseInstallations: [AA_INSTALLATION],
        }),
      }),
    );
    expect(result.battleId).toBe(BATTLE_ID);
    expect(result.elapsedMinutes).toBeGreaterThan(0);
    expect(Array.isArray(result.minuteHashes)).toBe(true);
    expect(result.provenance.battleId).toBe(BATTLE_ID);
    expect(result.provenance.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
