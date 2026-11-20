import type { CampaignSnapshot, WarDeclaration } from "@bluewave/campaign";
import { decideWarDeclaration, decideWarSorties } from "@bluewave/ai";
import { warDeclarationFromRulesets } from "@bluewave/content-compiler";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const AI = "france";
const TARGET = "germany";

const { state, bundle } = compileProductionCampaign();
const decoded = warDeclarationFromRulesets(bundle.rulesets);
if (decoded === undefined || !decoded.ok) throw new Error("production warDeclaration missing");
const rules = decoded.value;
const base: CampaignSnapshot = state.snapshot;

function withRelation(patch: Partial<CampaignSnapshot["politics"]["relations"][number]>) {
  return {
    ...base,
    politics: {
      ...base.politics,
      relations: base.politics.relations.map((r) =>
        (r.nationA === AI && r.nationB === TARGET) || (r.nationA === TARGET && r.nationB === AI)
          ? { ...r, ...patch }
          : r,
      ),
    },
  };
}

function withWar(extra: Partial<WarDeclaration>): CampaignSnapshot {
  const war: WarDeclaration = {
    id: "war_other",
    attackerSideId: "side_a",
    defenderSideId: "side_d",
    attackerSideMembers: [AI],
    defenderSideMembers: ["italy"],
    attackerWarScore: 0,
    defenderWarScore: 0,
    attackerId: AI,
    defenderId: "italy",
    startDate: "1880-01",
    status: "ACTIVE",
    ...extra,
  };
  return { ...base, wars: { ...base.wars, wars: [...base.wars.wars, war] } };
}

describe("AI war declaration decision on the production 1880 start (#995)", () => {
  it("declares on a reachable rival whose tension is at the authored threshold", () => {
    expect(decideWarDeclaration(base, AI, TARGET, rules)).toEqual({
      declare: true,
      reason: "DECLARE",
    });
  });

  it("holds below the tension threshold", () => {
    const calm = withRelation({ tension: rules.tensionThreshold - 1 });
    expect(decideWarDeclaration(calm, AI, TARGET, rules).reason).toBe("TENSION_BELOW_THRESHOLD");
  });

  it("never declares on a nation it is already at war with", () => {
    const atWar = withRelation({ relation: "at_war" });
    expect(decideWarDeclaration(atWar, AI, TARGET, rules).reason).toBe("ALREADY_AT_WAR");
    const live = withWar({ defenderId: TARGET, defenderSideMembers: [TARGET] });
    expect(decideWarDeclaration(live, AI, TARGET, rules).reason).toBe("ALREADY_AT_WAR");
  });

  it("never declares on an ally", () => {
    expect(
      decideWarDeclaration(withRelation({ relation: "allied" }), AI, TARGET, rules).reason,
    ).toBe("ALLIED");
  });

  it("never breaks a non-aggression pact", () => {
    expect(decideWarDeclaration(withRelation({ nap: true }), AI, TARGET, rules).reason).toBe(
      "NON_AGGRESSION_PACT",
    );
  });

  it("does not open a second front while already in a war", () => {
    expect(decideWarDeclaration(withWar({}), AI, TARGET, rules).reason).toBe("ALREADY_IN_WAR");
    expect(
      decideWarDeclaration(withWar({ status: "DECLARED_NOT_ACTIVE" }), AI, TARGET, rules).reason,
    ).toBe("ALREADY_IN_WAR");
  });

  it("holds when the rival's naval budget outmatches its own beyond the authored ratio", () => {
    const strict = { ...rules, minimumNavalStrengthRatioBp: 100_000 };
    expect(decideWarDeclaration(base, AI, TARGET, strict).reason).toBe("OUTMATCHED");
  });

  it("rejects an unknown or identical nation", () => {
    expect(decideWarDeclaration(base, AI, "atlantis", rules).reason).toBe("UNKNOWN_NATION");
    expect(decideWarDeclaration(base, AI, AI, rules).reason).toBe("UNKNOWN_NATION");
  });

  it("sends each idle fleet toward the nearest enemy squadron, in a fixed order", () => {
    const sorties = decideWarSorties(base, AI, TARGET);
    expect(sorties.length).toBeGreaterThan(0);
    expect(sorties.every((s) => s.toAreaId === "ger_ndgermany_coast")).toBe(true);
    expect(decideWarSorties(base, AI, TARGET)).toEqual(sorties);
  });
});
