import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { projectBattle } from "@bluewave/combat/battleResolution";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "@bluewave/combat/battleResolution";
import { TACTICAL_UNIT_PROMOTION_INVALID } from "@bluewave/combat/tactical";
import { AREA_ID, CAMPAIGN_MONTH, makeNations, makeProjectionManifest } from "./fixtures.js";

const RULESET = "b6_ruleset_v1";

describe("AC-4: tactical projection (manifest + committed ships -> TacticalBattleState)", () => {
  it("splits ship units by manifest side and resolves designs", () => {
    const nations = makeNations();
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });

    expect(out.state.forces["ATTACKER"]).toEqual(["a1", "a2"]);
    expect(out.state.forces["DEFENDER"]).toEqual(["d1", "d2"]);
    expect(out.state.sides).toEqual([
      { sideId: "ATTACKER", participantIds: ["a1", "a2"] },
      { sideId: "DEFENDER", participantIds: ["d1", "d2"] },
    ]);

    for (const u of out.units) {
      const design = out.designs[u.assetId];
      expect(design).toBeDefined();
      expect(design!.designVersionId).toBe(u.designVersionId);
      expect(u.campaignShipId).toBe(u.assetId);
    }
  });

  it("orders units canonically (asset sort) and stays deterministic across calls", () => {
    const nations = makeNations();
    const manifest = makeProjectionManifest(["d2", "a1", "d1", "a2"]);
    const a = projectBattle({
      manifest,
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    const b = projectBattle({
      manifest: makeProjectionManifest(["d2", "a1", "d1", "a2"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    expect(a.units.map((u) => u.assetId)).toEqual(b.units.map((u) => u.assetId));
    expect(a.state.forces).toEqual(b.state.forces);
  });

  it("excludes under-construction ships from the projection", () => {
    const nations = makeNations({ attackerUnderConstruction: ["a9"] });
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a9", "d1"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    expect(out.units.map((u) => u.assetId)).not.toContain("a9");
    expect(out.units.map((u) => u.assetId)).toEqual(["a1", "d1"]);
  });

  it("excludes unarmed ships from the gunnery surface but keeps them as units", () => {
    const nations = makeNations({ attackerIncludesUnarmed: true });
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a3", "d1"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    expect(out.units.map((u) => u.assetId)).toContain("a3");
    expect(out.batteries.map((b) => b.ownerShipId)).not.toContain("a3");
    expect(out.batteries.map((b) => b.ownerShipId)).toEqual(["a1", "d1"]);
  });

  it("missing design for a promoted ship fails with the promotion guard", () => {
    const nations = makeNations();
    const attacker = {
      ...nations.attacker,
      designs: new Map([...nations.attacker.designs].filter(([id]) => id !== "dv-att-a")),
    };
    let caught: unknown;
    try {
      projectBattle({
        manifest: makeProjectionManifest(["a1", "d1"]),
        areaId: AREA_ID,
        campaignMonth: CAMPAIGN_MONTH,
        attacker,
        defender: nations.defender,
        rulesetVersion: RULESET,
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(TACTICAL_UNIT_PROMOTION_INVALID);
  });

  it("manifest asset missing from both nations fails closed (no partial result)", () => {
    const nations = makeNations();
    let caught: unknown;
    try {
      projectBattle({
        manifest: makeProjectionManifest(["a1", "ghost", "d1"]),
        areaId: AREA_ID,
        campaignMonth: CAMPAIGN_MONTH,
        attacker: nations.attacker,
        defender: nations.defender,
        rulesetVersion: RULESET,
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(BATTLE_AUTO_RESOLUTION_FAILED);
    const ctx = (caught as BluewaveError).context as Record<string, string>;
    expect(ctx.assetId).toBe("ghost");
  });

  it("builds a damage context for every promoted ship with pristine states", () => {
    const nations = makeNations();
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    const ids = out.units.map((u) => u.assetId);
    for (const id of ids) {
      const t = out.damage.targets[id];
      expect(t).toBeDefined();
      expect(t!.state.terminalStatus).toBe("NORMAL");
      expect(t!.state.structuralIntegrity).toBeGreaterThan(0);
      expect(t!.zones.length).toBeGreaterThan(0);
    }
    expect(out.units.find((u) => u.sideId === "ATTACKER")!.assetId).toBe("a1");
    expect(out.units.find((u) => u.sideId === "DEFENDER")!.assetId).toBe("d1");
  });

  it("applies a nation's gunnery training bonus to its own batteries only", () => {
    const nations = makeNations();
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: { ...nations.attacker, gunneryTrainingBp: 1_000 },
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    const attackerShips = new Set(out.state.forces["ATTACKER"]);
    expect(out.batteries.length).toBeGreaterThan(0);
    for (const battery of out.batteries) {
      expect(battery.accuracyFactors.training).toBe(
        attackerShips.has(battery.ownerShipId) ? 11_000 : 10_000,
      );
    }
  });

  it("leaves accuracy untouched without a training bonus", () => {
    const nations = makeNations();
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    for (const battery of out.batteries) expect(battery.accuracyFactors.training).toBe(10_000);
  });
});
