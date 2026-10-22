import { describe, it, expect } from "vite-plus/test";
import type { CompiledArmamentMount } from "@bluewave/armament";
import { projectBattle } from "@bluewave/combat/battleResolution";
import {
  AREA_ID,
  CAMPAIGN_MONTH,
  DESIGN_ATT_A,
  makeNations,
  makeProjectionManifest,
} from "./fixtures.js";

const RULESET = "b6_ruleset_v1";

const armamentSnapshot: CompiledArmamentMount = {
  instanceId: "gun_1",
  gunFamilyId: "gb_bl_135in",
  gunModelId: "uk_bl_135in_30_mk1",
  mountId: "gb_bl_135in_barbette",
  ammunitionId: "gb_apc",
  mountType: "BARBETTE",
  gunCount: 4,
  accessStatus: "DOMESTIC",
  caliberUm: 343_000,
  shellMassG: 567_000,
  appliedModifiers: [],
};

function project(nations: ReturnType<typeof makeNations>) {
  return projectBattle({
    manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
    areaId: AREA_ID,
    campaignMonth: CAMPAIGN_MONTH,
    attacker: nations.attacker,
    defender: nations.defender,
    rulesetVersion: RULESET,
  });
}

describe("ADR-0094: canonical caliber persistence + projection", () => {
  it("projects the same canonical micrometre caliber for first-class and legacy designs", () => {
    const nations = makeNations();
    const withSnapshot = new Map(nations.attacker.designs);
    withSnapshot.set(DESIGN_ATT_A, {
      ...withSnapshot.get(DESIGN_ATT_A)!,
      armament: [{ ...armamentSnapshot }],
    });

    const legacyOut = project(nations);
    const firstClassOut = project({
      ...nations,
      attacker: { ...nations.attacker, designs: withSnapshot },
    });

    const legacyTarget = legacyOut.damage.targets["a1"]!;
    const firstClassTarget = firstClassOut.damage.targets["a1"]!;
    expect(legacyTarget.mainGunsCaliberUm).toBe(343_000);
    expect(firstClassTarget.mainGunsCaliberUm).toBe(343_000);
    expect(legacyTarget.beltArmorUm).toBe(305_000);
    expect(firstClassTarget.beltArmorUm).toBe(305_000);

    const firstBattery = firstClassOut.batteries.find((b) => b.ownerShipId === "a1")!;
    const legacyBattery = legacyOut.batteries.find((b) => b.ownerShipId === "a1")!;
    expect(firstBattery.state.gunDefinitionId).toBe("uk_bl_135in_30_mk1");
    expect(legacyBattery.state.gunDefinitionId).toBe(`${DESIGN_ATT_A}:MAIN`);
  });

  it("keeps a legacy design playable on the compatibility path", () => {
    const out = project(makeNations());
    for (const id of ["a1", "a2", "d1", "d2"]) {
      expect(out.batteries.find((b) => b.ownerShipId === id)).toBeDefined();
      expect(out.damage.targets[id]!.mainGunsCaliberUm).toBe(343_000);
    }
  });

  it("does not mutate the persisted snapshot it projects", () => {
    const nations = makeNations();
    const design = {
      ...nations.attacker.designs.get(DESIGN_ATT_A)!,
      armament: [{ ...armamentSnapshot }],
    };
    const withSnapshot = new Map(nations.attacker.designs);
    withSnapshot.set(DESIGN_ATT_A, design);
    const before = JSON.stringify(design);
    project({ ...nations, attacker: { ...nations.attacker, designs: withSnapshot } });
    expect(JSON.stringify(design)).toBe(before);
    expect(JSON.stringify(withSnapshot.get(DESIGN_ATT_A))).toBe(before);
  });

  it("is deterministic: repeated projection is byte-identical", () => {
    const a = project(makeNations());
    const b = project(makeNations());
    expect(Object.keys(a.damage.targets).sort()).toEqual(Object.keys(b.damage.targets).sort());
    for (const id of Object.keys(a.damage.targets)) {
      expect(a.damage.targets[id]!.mainGunsCaliberUm).toBe(b.damage.targets[id]!.mainGunsCaliberUm);
      expect(a.damage.targets[id]!.beltArmorUm).toBe(b.damage.targets[id]!.beltArmorUm);
    }
  });
});
