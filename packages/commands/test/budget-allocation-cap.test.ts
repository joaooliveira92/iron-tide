import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { CommandLifecycle, type CommandBody, type CommandEnvelope } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function snapshot(baseResources: number): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "budget-cap",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([
      [
        "GBR",
        {
          id: "GBR",
          name: "Great Britain",
          tag: "GBR",
          treasury: SafeInt(1000),
          income: SafeInt(100),
          expenses: SafeInt(50),
          baseResources: SafeInt(baseResources),
          navalAppropriationRateBp: SafeInt(2000),
          maintenanceCost: SafeInt(0),
          prestige: SafeInt(20),
          fleets: [],
          divisions: [],
          research: {
            nationId: "GBR",
            technologies: [],
            fieldPriorities: {},
            researchBudget: SafeInt(0),
            activeCandidates: new Map(),
            discoveredTechs: [],
          },
          constructionProjects: [],
          isPlayable: true,
          isAI: false,
        },
      ],
    ]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

function allocation(s: CampaignSnapshot, rate: number, research: number) {
  const envelope: CommandEnvelope<CommandBody> = {
    commandId: "alloc",
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(s)),
    idempotencyKey: "ik-alloc",
    timestamp: "test",
    body: {
      type: "SetBudgetAllocation",
      nationId: "GBR",
      appropriationRateBp: SafeInt(rate),
      researchBudget: SafeInt(research),
    },
  };
  return new CommandLifecycle().validate(envelope, s);
}

describe("SetBudgetAllocation research cap at issue time", () => {
  const s = snapshot(6000);

  it("accepts a budget at the cap", () => {
    expect(allocation(s, 3000, 18).ok).toBe(true);
  });

  it("rejects a budget above the cap with the stable code and the cap in the message", () => {
    const result = allocation(s, 3000, 19);
    expect(result.ok).toBe(false);
    if (result.ok || result.outcome.type !== "rejected") return;
    expect(result.outcome.diagnostic.code).toBe("RESEARCH_ABOVE_CAP");
    expect(result.outcome.diagnostic.message).toContain("18");
  });

  it("judges the cap at the commanded rate, not the current one", () => {
    expect(allocation(s, 3000, 10).ok).toBe(true);
    expect(allocation(s, 1000, 10).ok).toBe(false);
  });

  it("allows only zero research for a nation whose appropriation is too small", () => {
    const tiny = snapshot(60);
    expect(allocation(tiny, 2000, 0).ok).toBe(true);
    expect(allocation(tiny, 2000, 1).ok).toBe(false);
  });
});
