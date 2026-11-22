import { describe, it, expect } from "vite-plus/test";
import {
  ENCOUNTER_MISSION_SUBSET_V1,
  REACHABLE_MISSION_SUBSET_V1,
  generateBattles,
  type RaiderEncounter,
} from "@bluewave/combat/generation";
import {
  buildGenerationSnapshot,
  buildShip,
  makeActiveWar,
} from "../fixtures/generation-fixture.js";

const ship = (id: string, area: string) =>
  buildShip({
    id,
    classId: "cruiser",
    shipType: "CL",
    locationAreaId: area,
    firepower: 10,
    hitPoints: 40,
  });

function snapshot() {
  return buildGenerationSnapshot(
    [ship("gb_raider", "area_sea"), ship("gb_cl2", "area_sea")],
    [ship("fra_p1", "area_home"), ship("fra_p2", "area_home"), ship("fra_p3", "area_home")],
  );
}

const interception: RaiderEncounter = {
  missionType: "RAIDER_INTERCEPTION",
  warId: "war_1",
  areaId: "area_sea",
  raiderNationId: "GBR",
  raiderShipId: "gb_raider",
  interceptorNationId: "FRA",
  interceptorShipIds: ["fra_p1", "fra_p2"],
};

function run(encounters: readonly RaiderEncounter[], snap = snapshot()) {
  return generateBattles({
    snapshot: snap,
    campaignMonth: "1880-02",
    campaignSeed: "seed",
    rngVersion: "1",
    formulaVersion: "1",
    rulesetVersion: "1",
    contentVersion: "0.3.0",
    resolveStrength: () => 20,
    resolveShipType: () => "CL",
    resolveReadiness: () => 80,
    raiderEncounters: encounters,
  });
}

describe("#1052: encounter missions", () => {
  it("keeps area-presence reachability unchanged and adds a separate encounter subset", () => {
    expect([...REACHABLE_MISSION_SUBSET_V1].sort()).toEqual(["CRUISER_BATTLE", "FLEET_BATTLE"]);
    expect([...ENCOUNTER_MISSION_SUBSET_V1].sort()).toEqual([
      "BLOCKADE_BREAKOUT",
      "RAIDER_INTERCEPTION",
    ]);
  });

  it("generates nothing without encounters", () => {
    expect(run([]).manifests).toEqual([]);
  });

  it("builds a RAIDER_INTERCEPTION battle of the raider against only the named interceptors", () => {
    const result = run([interception]);
    expect(result.manifests).toHaveLength(1);
    const manifest = result.manifests[0]!;
    expect(manifest.missionType).toBe("RAIDER_INTERCEPTION");
    expect(manifest.areaId).toBe("area_sea");
    expect(manifest.attackerId).toBe("FRA");
    expect(manifest.defenderId).toBe("GBR");
    expect([...manifest.persistentAssets].sort()).toEqual(["fra_p1", "fra_p2", "gb_raider"]);
    expect(manifest.acceptanceClass).toBe("OPTIONAL");
  });

  it("makes the raider the attacker in a BLOCKADE_BREAKOUT, unavoidable", () => {
    const result = run([{ ...interception, missionType: "BLOCKADE_BREAKOUT" }]);
    const manifest = result.manifests[0]!;
    expect(manifest.missionType).toBe("BLOCKADE_BREAKOUT");
    expect(manifest.attackerId).toBe("GBR");
    expect(manifest.defenderId).toBe("FRA");
    expect(manifest.acceptanceClass).toBe("OPERATIONALLY_UNAVOIDABLE");
  });

  it("is deterministic", () => {
    expect(run([interception]).manifests[0]!.manifestHash).toBe(
      run([interception]).manifests[0]!.manifestHash,
    );
  });

  it("builds one battle per raider even inside one area", () => {
    const second = { ...interception, raiderShipId: "gb_cl2", interceptorShipIds: ["fra_p3"] };
    const result = run([interception, second]);
    expect(result.manifests).toHaveLength(2);
    expect(new Set(result.battleIds).size).toBe(2);
  });

  it("never reuses a ship across two encounters", () => {
    const second = { ...interception, raiderShipId: "gb_cl2" };
    const result = run([interception, second]);
    expect(result.manifests).toHaveLength(1);
    expect(result.rejections).toHaveLength(1);
  });

  it("rejects an encounter whose raider is already reserved", () => {
    const snap = snapshot();
    snap.nations.get("GBR")!.fleets[0]!.ships[0]!.inBattleId = "elsewhere";
    expect(run([interception], snap).manifests).toEqual([]);
  });

  it("does not take the area slot of a fleet battle", () => {
    const snap = buildGenerationSnapshot(
      [ship("gb_raider", "area_sea"), ship("gb_a", "area_sea")],
      [ship("fra_p1", "area_home"), ship("fra_b", "area_sea")],
    );
    const result = generateBattles({
      snapshot: snap,
      campaignMonth: "1880-02",
      campaignSeed: "seed",
      rngVersion: "1",
      formulaVersion: "1",
      rulesetVersion: "1",
      contentVersion: "0.3.0",
      resolveStrength: () => 1_000,
      resolveShipType: () => "CL",
      resolveReadiness: () => 80,
      raiderEncounters: [{ ...interception, interceptorShipIds: ["fra_p1"] }],
    });
    expect(result.manifests.map((m) => m.missionType).sort()).toEqual([
      "FLEET_BATTLE",
      "RAIDER_INTERCEPTION",
    ]);
  });
});

describe("#1112: queued encounters keep their ships against ordinary battles", () => {
  function collidingRun(encounter: RaiderEncounter) {
    const snap = buildGenerationSnapshot(
      [ship("gb_raider", "area_sea"), ship("gb_a", "area_sea")],
      [ship("fra_p1", "area_sea"), ship("fra_b", "area_sea")],
    );
    snap.wars.wars.unshift(makeActiveWar("war_0"));
    return generateBattles({
      snapshot: snap,
      campaignMonth: "1880-02",
      campaignSeed: "seed",
      rngVersion: "1",
      formulaVersion: "1",
      rulesetVersion: "1",
      contentVersion: "0.3.0",
      resolveStrength: () => 1_000,
      resolveShipType: () => "CL",
      resolveReadiness: () => 80,
      raiderEncounters: [encounter],
    });
  }

  it("still builds the encounter when an earlier-sorting war's fleet battle shares its area", () => {
    const result = collidingRun({ ...interception, interceptorShipIds: ["fra_p1"] });
    const encounter = result.manifests.find((m) => m.missionType === "RAIDER_INTERCEPTION");
    expect([...(encounter?.persistentAssets ?? [])].sort()).toEqual(["fra_p1", "gb_raider"]);
    expect(result.rejections.filter((id) => id.includes("raider_interception"))).toEqual([]);
  });

  it("keeps the raider and its interceptors out of the ordinary battle", () => {
    const result = collidingRun({ ...interception, interceptorShipIds: ["fra_p1"] });
    const ordinary = result.manifests.find((m) => m.missionType === "FLEET_BATTLE");
    expect([...(ordinary?.persistentAssets ?? [])].sort()).toEqual(["fra_b", "gb_a"]);
  });
});
