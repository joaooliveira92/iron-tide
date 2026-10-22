import { describe, it, expect } from "vite-plus/test";
import type { CompiledArmamentMount } from "@bluewave/armament";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import { projectBattle } from "@bluewave/combat/battleResolution";
import { resolveBattleAuto } from "@bluewave/combat/battleResolution";
import {
  AREA_ID,
  CAMPAIGN_MONTH,
  DESIGN_ATT_A,
  DESIGN_ATT_B,
  makeAutoInput,
  makeNations,
  makeProjectionManifest,
} from "./fixtures.js";

const RULESET = "b6_ruleset_v1";

const mainArmament: CompiledArmamentMount = {
  instanceId: "gun_1",
  gunFamilyId: "gb_bl_13_5in",
  gunModelId: "gb_bl_13_5in_30",
  mountId: "gb_bl_13_5in_barbette",
  ammunitionId: "gb_apc",
  mountType: "BARBETTE",
  gunCount: 4,
  accessStatus: "DOMESTIC",
  caliberUm: 343_000,
  shellMassG: 567_000,
  appliedModifiers: [],
};

function withArmament(
  design: CompiledDesignVersion,
  armament: readonly CompiledArmamentMount[],
): CompiledDesignVersion {
  return { ...design, armament: armament.map((a) => ({ ...a })) };
}

function nationsWithMainArmament() {
  const nations = makeNations();
  const attackerDesigns = new Map(nations.attacker.designs);
  attackerDesigns.set(
    DESIGN_ATT_A,
    withArmament(attackerDesigns.get(DESIGN_ATT_A)!, [mainArmament]),
  );
  return {
    ...nations,
    attacker: { ...nations.attacker, designs: attackerDesigns },
    attackerDesigns,
  };
}

describe("Step 4: combat receives first-class armament identity", () => {
  it("projects a new design's gun-model, mount and ammunition identity onto its battery", () => {
    const nations = nationsWithMainArmament();
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    const a1 = out.batteries.find((b) => b.ownerShipId === "a1")!;
    expect(a1.state.gunDefinitionId).toBe("gb_bl_13_5in_30");
    expect(a1.state.mountDefinitionId).toBe("gb_bl_13_5in_barbette");
    expect(a1.state.gunFamilyId).toBe("gb_bl_13_5in");
    expect(a1.state.ammunitionPatternId).toBe("gb_apc");
  });

  it("keeps the legacy synthetic identity for a design without a snapshot (compatibility path)", () => {
    const nations = makeNations();
    const out = projectBattle({
      manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    const a2 = out.batteries.find((b) => b.ownerShipId === "a2")!;
    expect(a2.state.gunDefinitionId).toBe(`${DESIGN_ATT_B}:MAIN`);
    expect(a2.state.mountDefinitionId).toBe("MAIN-BATTERY");
    expect(a2.state.gunFamilyId).toBeUndefined();
    expect(a2.state.ammunitionPatternId).toBeUndefined();
  });

  it("supports a mixed legacy/first-class fleet deterministically and repeatedly", () => {
    const nations = nationsWithMainArmament();
    const project = () =>
      projectBattle({
        manifest: makeProjectionManifest(["a1", "a2", "d1", "d2"]),
        areaId: AREA_ID,
        campaignMonth: CAMPAIGN_MONTH,
        attacker: nations.attacker,
        defender: nations.defender,
        rulesetVersion: RULESET,
      });
    const first = project();
    const second = project();
    expect(first.batteries.map((b) => b.state.stateHash)).toEqual(
      second.batteries.map((b) => b.state.stateHash),
    );
    expect(first.batteries.find((b) => b.ownerShipId === "a1")!.state.gunFamilyId).toBe(
      "gb_bl_13_5in",
    );
    expect(first.batteries.find((b) => b.ownerShipId === "d1")!.state.gunFamilyId).toBeUndefined();
  });

  it("does not mutate the compiled design it projects", () => {
    const nations = nationsWithMainArmament();
    const before = JSON.stringify(nations.attackerDesigns.get(DESIGN_ATT_A)!);
    projectBattle({
      manifest: makeProjectionManifest(["a1", "d1"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    expect(JSON.stringify(nations.attackerDesigns.get(DESIGN_ATT_A)!)).toBe(before);
  });
});

describe("Step 4: legacy/new combat equivalence", () => {
  it("produces identical gameplay outcomes for equivalent legacy and first-class inputs", () => {
    const legacy = resolveBattleAuto(makeAutoInput());
    const nations = nationsWithMainArmament();
    const identity = resolveBattleAuto(makeAutoInput({ nations }));

    expect(identity.winnerId).toBe(legacy.winnerId);
    expect(identity.loserId).toBe(legacy.loserId);
    expect(identity.battleEndReason).toBe(legacy.battleEndReason);
    expect(identity.elapsedMinutes).toBe(legacy.elapsedMinutes);
    expect(identity.damageReport).toEqual(legacy.damageReport);
    expect(identity.attackerSurvivorIds).toEqual(legacy.attackerSurvivorIds);
    expect(identity.defenderSurvivorIds).toEqual(legacy.defenderSurvivorIds);
    expect(identity.attackerSunkIds).toEqual(legacy.attackerSunkIds);
    expect(identity.defenderSunkIds).toEqual(legacy.defenderSunkIds);

    expect(identity.resultHash).not.toBe(legacy.resultHash);
    expect(identity.resultHash).toBe(resolveBattleAuto(makeAutoInput({ nations })).resultHash);
  });

  it("carries the first-class identity into the fired salvo event", () => {
    const nations = nationsWithMainArmament();
    const input = makeAutoInput({ nations, maxMinutes: 3 });
    const result = resolveBattleAuto(input);
    expect(result.elapsedMinutes).toBeGreaterThan(0);
    expect(result.minuteHashes.length).toBe(result.elapsedMinutes);
    expect(resolveBattleAuto(makeAutoInput({ nations, maxMinutes: 3 })).resultHash).toBe(
      result.resultHash,
    );
  });

  it("projects a legacy design and an armament-carrying design to the same salvo schedule", () => {
    const legacyNations = makeNations();
    const legacyOut = projectBattle({
      manifest: makeProjectionManifest(["a1", "d1"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: legacyNations.attacker,
      defender: legacyNations.defender,
      rulesetVersion: RULESET,
    });
    const nations = nationsWithMainArmament();
    const identityOut = projectBattle({
      manifest: makeProjectionManifest(["a1", "d1"]),
      areaId: AREA_ID,
      campaignMonth: CAMPAIGN_MONTH,
      attacker: nations.attacker,
      defender: nations.defender,
      rulesetVersion: RULESET,
    });
    const legacyA1 = legacyOut.batteries.find((b) => b.ownerShipId === "a1")!;
    const identityA1 = identityOut.batteries.find((b) => b.ownerShipId === "a1")!;
    expect(identityA1.salvoCount).toBe(legacyA1.salvoCount);
    expect(identityA1.baseReloadMs).toBe(legacyA1.baseReloadMs);
    expect(identityA1.preferredType).toBe(legacyA1.preferredType);
    expect(identityA1.rateFactors).toEqual(legacyA1.rateFactors);
    expect(identityA1.accuracyFactors).toEqual(legacyA1.accuracyFactors);
    expect(identityA1.state.ammunition).toEqual(legacyA1.state.ammunition);
    expect(identityA1.state.fireMode).toBe(legacyA1.state.fireMode);
    expect(identityA1.state.rangeEstimateUm).toBe(legacyA1.state.rangeEstimateUm);
    expect(identityA1.state.fireControlSolutionQualityBp).toBe(
      legacyA1.state.fireControlSolutionQualityBp,
    );
  });

  it("adds no nation-id conditional to the shared armament/gunnery path", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = path.join(__dirname, "..", "..", "src");
    for (const file of [
      "gunnery/state.ts",
      "gunnery/event.ts",
      "gunnery/resolve.ts",
      "battleResolution/project.ts",
    ]) {
      const text = fs.readFileSync(path.join(src, file), "utf8");
      expect(/nationId\s*===|nationId\s*!==/.test(text), file).toBe(false);
    }
  });
});
