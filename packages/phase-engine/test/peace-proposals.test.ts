import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type MonthExecutorEngineOptions } from "../src/index.js";
import { cloneSnapshot } from "../src/snapshotClone.js";

const RULES = {
  sectionVersion: 1 as const,
  acceptanceScoreMargin: 20,
  proposalChanceBp: 10_000,
  provenance: {
    sourceStatus: "BALANCE_TARGET" as const,
    confidence: "LOW" as const,
    kind: "balance_adjustment" as const,
    sources: [],
  },
};

const WAR_ID = "war_GBR_FRA_1";

function nation(id: string, homeAreaId: string): NationState {
  return {
    id,
    name: id,
    tag: id,
    prestige: SafeInt(20),
    treasury: SafeInt(10_000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    homeAreaId,
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
  };
}

function snapshot(
  playerScore: number,
  aiScore: number,
  extra: { readonly playerInWar?: boolean } = {},
): CampaignSnapshot {
  const playerInWar = extra.playerInWar ?? true;
  const attackerId = playerInWar ? "GBR" : "GER";
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "peace-proposals",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: "playable" },
      { nationId: "FRA", type: "ai" },
      { nationId: "GER", type: "ai" },
    ],
    world: {
      areas: [
        { id: "gbr_home", name: "Britain", type: "coastal", controller: "GBR" },
        {
          id: "gbr_malta",
          name: "Malta",
          type: "coastal",
          controller: "GBR",
          cessionCost: SafeInt(10),
        },
        { id: "fra_home", name: "France", type: "coastal", controller: "FRA" },
        { id: "ger_home", name: "Germany", type: "coastal", controller: "GER" },
      ],
      routes: [],
      ports: [],
    },
    nations: new Map([
      ["FRA", nation("FRA", "fra_home")],
      ["GBR", nation("GBR", "gbr_home")],
      ["GER", nation("GER", "ger_home")],
    ]),
    wars: {
      wars: [
        {
          id: playerInWar ? WAR_ID : "war_GER_FRA_1",
          attackerId,
          defenderId: "FRA",
          attackerSideId: `side_${attackerId}`,
          defenderSideId: "side_FRA",
          attackerSideMembers: [attackerId],
          defenderSideMembers: ["FRA"],
          attackerWarScore: playerScore,
          defenderWarScore: aiScore,
          startDate: "1",
          status: "ACTIVE",
        },
      ],
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
    compatibilityVersion: "5.0.0",
  };
}

function options(over: Partial<MonthExecutorEngineOptions> = {}): MonthExecutorEngineOptions {
  return { playerNationId: "GBR", peaceBehaviour: RULES, ...over };
}

function command(from: CampaignSnapshot, body: CommandBody): CommandEnvelope<CommandBody> {
  return {
    commandId: `cmd-${body.type}`,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
    idempotencyKey: `idem-${body.type}`,
    timestamp: "2024-01-01T00:00:00Z",
    body,
  };
}

function month(
  from: CampaignSnapshot,
  engineOptions: MonthExecutorEngineOptions | undefined = options(),
  commands: CommandEnvelope<CommandBody>[] = [],
) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    from,
    commands,
    "seed",
    collector,
    undefined,
    engineOptions,
  );
  const next = {
    ...result.finalSnapshot,
    turnNumber: SafeInt(Number(from.turnNumber) + 1),
  } as CampaignSnapshot;
  return {
    next,
    collector,
    draws: result.randomLedger.all.filter((d) => d.streamId === "diplomacy/peace_proposal"),
  };
}

const offersOf = (s: CampaignSnapshot) => s.wars.peaceOffers ?? [];

describe("AI peace proposals", () => {
  it("raises no offer and records no draw when the ruleset has no peaceBehaviour section", () => {
    const { next, draws } = month(snapshot(30, 0), options({ peaceBehaviour: undefined }));
    expect(offersOf(next)).toEqual([]);
    expect(next.wars.peaceOffers).toBeUndefined();
    expect(draws).toEqual([]);
  });

  it("proposes a status quo peace when the AI trails by the margin and the draw succeeds", () => {
    const { next, draws } = month(snapshot(30, 0));
    expect(offersOf(next)).toEqual([
      {
        warId: WAR_ID,
        proposerId: "FRA",
        targetId: "GBR",
        month: "1880-02",
        term: { _tag: "StatusQuo" },
        reasonCode: "PROPOSER_TRAILS_BY_MARGIN",
      },
    ]);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({
      streamId: "diplomacy/peace_proposal",
      entityKey: WAR_ID,
      phase: "resolve_diplomacy",
      outcome: "PROPOSE",
      reasonCode: "PROPOSER_TRAILS_BY_MARGIN",
    });
    expect(draws[0]!.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records a HOLD draw and raises no offer when the chance is zero", () => {
    const { next, draws } = month(snapshot(30, 0), options({ peaceBehaviour: zeroChance() }));
    expect(offersOf(next)).toEqual([]);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({ outcome: "HOLD", reasonCode: "PROPOSER_TRAILS_BY_MARGIN" });
  });

  it("raises no offer and no draw while the scores are within the margin", () => {
    const { next, draws } = month(snapshot(10, 0));
    expect(offersOf(next)).toEqual([]);
    expect(draws).toEqual([]);
  });

  it("ignores wars that do not involve the player", () => {
    const { next, draws } = month(snapshot(30, 0, { playerInWar: false }));
    expect(offersOf(next)).toEqual([]);
    expect(draws).toEqual([]);
  });

  it("keeps a pending offer without a fresh draw the next month", () => {
    const first = month(snapshot(30, 0));
    const second = month(first.next);
    expect(offersOf(second.next)).toEqual(offersOf(first.next));
    expect(second.draws).toEqual([]);
  });

  it("drops the offer once the AI rule no longer yields that term", () => {
    const first = month(snapshot(30, 0));
    const shifted = {
      ...first.next,
      wars: {
        ...first.next.wars,
        wars: first.next.wars.wars.map((w) => ({ ...w, defenderWarScore: 25 })),
      },
    };
    expect(offersOf(month(shifted).next)).toEqual([]);
  });

  it("proposes ceding a priced area when the AI leads by the margin", () => {
    const { next, draws } = month(snapshot(0, 40));
    expect(offersOf(next)).toMatchObject([
      {
        warId: WAR_ID,
        proposerId: "FRA",
        targetId: "GBR",
        term: { _tag: "CedeArea", areaId: "gbr_malta" },
        reasonCode: "PROPOSER_LEADS_BY_MARGIN",
      },
    ]);
    expect(draws[0]).toMatchObject({ outcome: "PROPOSE", reasonCode: "PROPOSER_LEADS_BY_MARGIN" });
  });

  it("is reproducible across identical runs", () => {
    const run = () => {
      const result = month(snapshot(30, 0));
      return sha256Hex(canonicalSerialize([result.next, result.draws]));
    };
    expect(run()).toBe(run());
  });
});

describe("accepting an AI peace offer", () => {
  it("AcceptPeace on a pending status quo offer ends the war and clears the offer", () => {
    const offered = month(snapshot(30, 0)).next;
    const accept = command(offered, { type: "AcceptPeace", nationId: "GBR", warId: WAR_ID });
    const { next } = month(offered, options(), [accept]);
    expect(next.wars.wars[0]!.status).toBe("ENDED");
    expect(offersOf(next)).toEqual([]);
  });

  it("AcceptPeace on a pending cession offer moves the area away from the player", () => {
    const offered = month(snapshot(0, 40)).next;
    const accept = command(offered, { type: "AcceptPeace", nationId: "GBR", warId: WAR_ID });
    const { next } = month(offered, options(), [accept]);
    expect(next.wars.wars[0]!.status).toBe("ENDED");
    expect(next.world.areas.find((a) => a.id === "gbr_malta")!.controller).toBe("FRA");
    expect(offersOf(next)).toEqual([]);
  });

  it("AcceptPeace with no pending offer stays an unconditional status quo peace", () => {
    const start = snapshot(10, 0);
    const accept = command(start, { type: "AcceptPeace", nationId: "GBR", warId: WAR_ID });
    const { next } = month(start, options(), [accept]);
    expect(next.wars.wars[0]!.status).toBe("ENDED");
  });
});

describe("player peace proposals under AI consent", () => {
  const propose = (from: CampaignSnapshot) =>
    command(from, {
      type: "ProposePeace",
      nationId: "GBR",
      warId: WAR_ID,
      term: { _tag: "StatusQuo" },
    });

  it("refuses with PEACE_REFUSED and the reason code when the AI is winning", () => {
    const start = snapshot(0, 30);
    const { next, collector } = month(start, options(), [propose(start)]);
    expect(next.wars.wars[0]!.status).toBe("ACTIVE");
    const refusal = collector.all.find((d) => d.code === "PEACE_REFUSED");
    expect(refusal?.message).toContain("PROPOSER_TRAILS_BY_MARGIN");
    expect(refusal?.entityId).toBe(WAR_ID);
  });

  it("accepts when the AI is not ahead by the margin", () => {
    const start = snapshot(10, 0);
    const { next, collector } = month(start, options(), [propose(start)]);
    expect(next.wars.wars[0]!.status).toBe("ENDED");
    expect(collector.all.some((d) => d.code === "PEACE_REFUSED")).toBe(false);
  });

  it("stays unconditional without a peaceBehaviour section", () => {
    const start = snapshot(0, 30);
    const { next } = month(start, options({ peaceBehaviour: undefined }), [propose(start)]);
    expect(next.wars.wars[0]!.status).toBe("ENDED");
  });
});

describe("snapshot clone of wars.peaceOffers", () => {
  it("deep copies offers and their terms", () => {
    const offered = month(snapshot(0, 40)).next;
    const copy = cloneSnapshot(offered);
    expect(copy.wars.peaceOffers).toEqual(offered.wars.peaceOffers);
    expect(copy.wars.peaceOffers![0]).not.toBe(offered.wars.peaceOffers![0]);
    expect(copy.wars.peaceOffers![0]!.term).not.toBe(offered.wars.peaceOffers![0]!.term);
    expect(sha256Hex(canonicalSerialize(copy))).toBe(sha256Hex(canonicalSerialize(offered)));
  });

  it("leaves an absent field absent", () => {
    expect("peaceOffers" in cloneSnapshot(snapshot(0, 0)).wars).toBe(false);
  });
});

function zeroChance() {
  return { ...RULES, proposalChanceBp: 0 };
}
