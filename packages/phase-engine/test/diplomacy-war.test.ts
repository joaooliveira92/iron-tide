import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { CommandIdempotencyMap, CommandLifecycle } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, PhaseRegistry } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

const NATIONS = ["GBR", "FRA", "GER"];

function makeRelations(ids: string[]): CampaignSnapshot["politics"]["relations"] {
  const relations: CampaignSnapshot["politics"]["relations"] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      relations.push({
        nationA: ids[i]!,
        nationB: ids[j]!,
        relation: "neutral",
        tension: 5,
        nap: false,
        since: "1880-01",
      });
    }
  }
  return relations;
}

function findRelation(snapshot: CampaignSnapshot, a: string, b: string) {
  const key = [a, b].sort().join("\u0000");
  return (
    snapshot.politics.relations.find((r) => [r.nationA, r.nationB].sort().join("\u0000") === key) ??
    null
  );
}

function makeNation(
  id: string,
  overrides: Partial<{
    treasury: SafeInt;
    ships: number;
    firepower: SafeInt;
    hitPoints: SafeInt;
  }> = {},
): NationState {
  const ships = overrides.ships ?? 0;
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury: overrides.treasury ?? SafeInt(10000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: `fleet-${id}`,
        nationId: id,
        name: `${id} Fleet`,
        locationAreaId: "a-1",
        ships: Array.from({ length: ships }, (_, i) => ({
          id: `${id}-ship-${i}`,
          name: `${id} Ship ${i}`,
          classId: "battleship",
          nationId: id,
          locationAreaId: "a-1",
          designVersionId: "",
          hitPoints: overrides.hitPoints ?? SafeInt(100),
          maxHitPoints: overrides.hitPoints ?? SafeInt(100),
          speed: SafeInt(10),
          firepower: overrides.firepower ?? SafeInt(10),
          armor: SafeInt(10),
          isUnderConstruction: false,
          constructionProgress: SafeInt(100),
          constructionTotalWork: SafeInt(100),
          readiness: "ACTIVE",
          crewQuality: SafeInt(100),
        })),
      },
    ],
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

function makeSnapshot(
  nations: Array<[string, NationState]>,
  overrides: Partial<CampaignSnapshot> = {},
): CampaignSnapshot {
  const map = new Map(nations);
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "diplomacy-acceptance",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: nations.map(([nationId]) => ({
      nationId,
      type: nationId === "GBR" ? ("playable" as const) : ("ai" as const),
    })),
    world: { areas: [], routes: [], ports: [] },
    nations: map,
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: makeRelations(NATIONS), shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
    ...overrides,
  };
}

function makeCommand(
  snapshot: CampaignSnapshot,
  body: CommandBody,
  overrides: Partial<CommandEnvelope<CommandBody>> = {},
): CommandEnvelope<CommandBody> {
  return {
    commandId: `cmd-${body.type}-${Math.random()}`,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: `idem-${body.type}-${Math.random()}`,
    timestamp: "2024-01-01T00:00:00Z",
    body,
    ...overrides,
  };
}

const threeNations = (): Array<[string, NationState]> => [
  ["GBR", makeNation("GBR", { treasury: SafeInt(10000) })],
  ["FRA", makeNation("FRA", { treasury: SafeInt(10000) })],
  ["GER", makeNation("GER", { treasury: SafeInt(10000) })],
];

function withWar(
  snapshot: CampaignSnapshot,
  war: Partial<CampaignSnapshot["wars"]["wars"][number]> & {
    attackerId: string;
    defenderId: string;
  },
): CampaignSnapshot {
  const full: CampaignSnapshot["wars"]["wars"][number] = {
    id: `war_${war.attackerId}_${war.defenderId}_1`,
    attackerSideId: `side_${war.attackerId}`,
    defenderSideId: `side_${war.defenderId}`,
    attackerSideMembers: [war.attackerId],
    defenderSideMembers: [war.defenderId],
    attackerWarScore: 0,
    defenderWarScore: 0,
    startDate: "1",
    status: "ACTIVE",
    ...war,
  };
  const participants = warpParticipants(full);
  return {
    ...snapshot,
    wars: {
      ...snapshot.wars,
      wars: [...snapshot.wars.wars, full],
      participantMemberships: [...snapshot.wars.participantMemberships, ...participants],
    },
  };
}

function warpParticipants(
  war: CampaignSnapshot["wars"]["wars"][number],
): CampaignSnapshot["wars"]["participantMemberships"] {
  const results: CampaignSnapshot["wars"]["participantMemberships"] = [];
  for (const sideMembers of [war.attackerSideMembers, war.defenderSideMembers]) {
    const sideId =
      sideMembers === war.attackerSideMembers ? war.attackerSideId : war.defenderSideId;
    for (const nationId of sideMembers) {
      results.push({
        warId: war.id,
        nationId,
        sideId,
        entryMonth: "1",
        status: "ACTIVE",
        nationalContributionPoints: 0,
      });
    }
  }
  return results;
}

describe("B10c diplomacy & war acceptance (criteria 1-14)", () => {
  it("C1: full turn includes the resolve_diplomacy phase", () => {
    const ids = PhaseRegistry.all.map((p) => p.id);
    expect(ids).toContain("resolve_diplomacy");
    const idx = ids.indexOf("resolve_diplomacy");
    expect(idx).toBeGreaterThan(ids.indexOf("construction_processing"));
    expect(idx).toBeLessThan(ids.indexOf("resolve_research"));
  });

  it("C2: DeclareWar creates a DECLARED_NOT_ACTIVE war with at_war + tension 10", () => {
    const snapshot = makeSnapshot(threeNations());
    const cmd = makeCommand(snapshot, {
      type: "DeclareWar",
      nationId: "GBR",
      targetNationId: "FRA",
    });
    const result = new MonthExecutor().execute(snapshot, [cmd], "seed", new DiagnosticCollector());

    const war = result.finalSnapshot.wars.wars[0];
    expect(war).toBeDefined();
    expect(war!.status).toBe("DECLARED_NOT_ACTIVE");
    expect(war!.attackerId).toBe("GBR");
    expect(war!.defenderId).toBe("FRA");
    // campaignMonth is derived from the snapshot start (1880-01) + turn 1 ->
    // 1880-02 (B-6/ADR-0025); war ids embed the month id.
    expect(war!.id).toBe("war_GBR_FRA_1880-02");

    const rel = findRelation(result.finalSnapshot, "GBR", "FRA")!;
    expect(rel.relation).toBe("at_war");
    expect(rel.tension).toBe(10);
    expect(rel.nap).toBe(false);
  });

  it("C3: battle_resolution promotes the war to ACTIVE and updates war score", () => {
    let snapshot = makeSnapshot([
      ["GBR", makeNation("GBR", { ships: 5, firepower: SafeInt(100), hitPoints: SafeInt(200) })],
      ["FRA", makeNation("FRA", { ships: 1, firepower: SafeInt(1), hitPoints: SafeInt(20) })],
      ["GER", makeNation("GER")],
    ]);
    snapshot = withWar(snapshot, {
      attackerId: "GBR",
      defenderId: "FRA",
      status: "DECLARED_NOT_ACTIVE",
    });
    snapshot = {
      ...snapshot,
      wars: {
        ...snapshot.wars,
        battles: [
          {
            id: "battle-1",
            phase: "pending",
            attackerId: "GBR",
            defenderId: "FRA",
            areaId: "a-1",
            attackerFleetIds: ["fleet-GBR"],
            defenderFleetIds: ["fleet-FRA"],
          },
        ],
      },
    };

    const result = new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector());
    const war = result.finalSnapshot.wars.wars[0]!;
    expect(war.status).toBe("ACTIVE");
    // GBR overwhelming strength wins -> positive attacker score, negative defender score
    expect((war.attackerWarScore as number) > 0).toBe(true);
    expect((war.defenderWarScore as number) < 0).toBe(true);
  });

  it("C4: alliance auto-entry adds GER (ally of FRA) to defender side", () => {
    // FRA is the playable slot so it can issue FormAlliance
    let snapshot = makeSnapshot([
      ["FRA", makeNation("FRA", { treasury: SafeInt(10000) })],
      ["GBR", makeNation("GBR", { treasury: SafeInt(10000) })],
      ["GER", makeNation("GER", { treasury: SafeInt(10000) })],
    ]);
    // Form alliance FRA <-> GER first turn
    const formCmd = makeCommand(snapshot, {
      type: "FormAlliance",
      nationId: "FRA",
      partnerNationId: "GER",
    });
    snapshot = new MonthExecutor().execute(
      snapshot,
      [formCmd],
      "seed",
      new DiagnosticCollector(),
    ).finalSnapshot;

    // GBR declares war on FRA and a battle occurs
    snapshot = {
      ...snapshot,
      turnNumber: SafeInt(1),
      nations: (() => {
        const m = new Map(snapshot.nations);
        m.set("GBR", makeNation("GBR", { ships: 5, firepower: SafeInt(100) }));
        m.set("FRA", makeNation("FRA", { ships: 1, firepower: SafeInt(1) }));
        m.set("GER", makeNation("GER", { ships: 1, firepower: SafeInt(1) }));
        return m;
      })(),
    };
    snapshot = withWar(snapshot, { attackerId: "GBR", defenderId: "FRA" });
    snapshot = {
      ...snapshot,
      wars: {
        ...snapshot.wars,
        battles: [
          {
            id: "battle-1",
            phase: "pending",
            attackerId: "GBR",
            defenderId: "FRA",
            areaId: "a-1",
            attackerFleetIds: ["fleet-GBR"],
            defenderFleetIds: ["fleet-FRA"],
          },
        ],
      },
    };

    const result = new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector());
    const war = result.finalSnapshot.wars.wars[0]!;
    expect(war.defenderSideMembers).toContain("GER");
    const memberships = result.finalSnapshot.wars.participantMemberships.filter(
      (m) => m.warId === war.id,
    );
    expect(memberships.some((m) => m.nationId === "GER")).toBe(true);
  });

  it("C5: AcceptPeace ends the war and resets relations to neutral tension 5", () => {
    let snapshot = makeSnapshot(threeNations());
    snapshot = withWar(snapshot, { attackerId: "GBR", defenderId: "FRA" });
    const cmd = makeCommand(
      snapshot,
      { type: "AcceptPeace", nationId: "GBR", warId: snapshot.wars.wars[0]!.id },
      { expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)) },
    );
    const result = new MonthExecutor().execute(snapshot, [cmd], "seed", new DiagnosticCollector());
    const war = result.finalSnapshot.wars.wars[0]!;
    expect(war.status).toBe("ENDED");
    const memberships = result.finalSnapshot.wars.participantMemberships.filter(
      (m) => m.warId === war.id,
    );
    expect(memberships.every((m) => m.status === "EXITED")).toBe(true);
    const rel = findRelation(result.finalSnapshot, "GBR", "FRA")!;
    expect(rel.relation).toBe("neutral");
    expect(rel.tension).toBe(5);
  });

  it("C6: a side reaching war score >= 80 auto-ends the war (surrender)", () => {
    let snapshot = makeSnapshot([
      ["GBR", makeNation("GBR", { ships: 5, firepower: SafeInt(100), hitPoints: SafeInt(200) })],
      ["FRA", makeNation("FRA", { ships: 1, firepower: SafeInt(1), hitPoints: SafeInt(20) })],
      ["GER", makeNation("GER")],
    ]);
    // Set GBR war score high; a decisive win (+10) crosses the 80 threshold.
    snapshot = withWar(snapshot, {
      attackerId: "GBR",
      defenderId: "FRA",
      attackerWarScore: 75,
    });
    snapshot = {
      ...snapshot,
      wars: {
        ...snapshot.wars,
        battles: [
          {
            id: "battle-1",
            phase: "pending",
            attackerId: "GBR",
            defenderId: "FRA",
            areaId: "a-1",
            attackerFleetIds: ["fleet-GBR"],
            defenderFleetIds: ["fleet-FRA"],
          },
        ],
      },
    };

    const result = new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector());
    const war = result.finalSnapshot.wars.wars[0]!;
    expect(war.status).toBe("ENDED");
  });

  it("C7: a 4th concurrent war is rejected with MAXIMUM_CONCURRENT_WARS_REACHED", () => {
    let snapshot = makeSnapshot([
      ["GBR", makeNation("GBR")],
      ["FRA", makeNation("FRA")],
      ["GER", makeNation("GER")],
      ["ITA", makeNation("ITA")],
      ["RUS", makeNation("RUS")],
      ["AUS", makeNation("AUS")],
    ]);
    // GBR at war with 3 nations
    for (const target of ["FRA", "GER", "ITA"]) {
      snapshot = withWar(snapshot, { attackerId: "GBR", defenderId: target });
    }
    const cmd = makeCommand(snapshot, {
      type: "DeclareWar",
      nationId: "GBR",
      targetNationId: "RUS",
    });
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.process(
      cmd,
      snapshot,
      { nationId: "GBR", type: "playable" },
      new CommandIdempotencyMap(),
    );
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected") {
      expect(outcome.diagnostic.code).toBe("MAXIMUM_CONCURRENT_WARS_REACHED");
    }
  });

  it("C8: DeclareBlockade adds a BlockadeState and increments war score by 2 per month", () => {
    let snapshot = makeSnapshot(threeNations());
    snapshot = withWar(snapshot, { attackerId: "GBR", defenderId: "FRA" });
    snapshot = {
      ...snapshot,
      politics: {
        ...snapshot.politics,
        relations: snapshot.politics.relations.map((r) => {
          const key = [r.nationA, r.nationB].sort().join("\u0000");
          return key === ["GBR", "FRA"].sort().join("\u0000")
            ? { ...r, relation: "at_war" as const, tension: 10, nap: false }
            : r;
        }),
      },
    };
    const cmd = makeCommand(snapshot, {
      type: "DeclareBlockade",
      nationId: "GBR",
      targetNationId: "FRA",
      areaId: "eng_ch",
    });
    // Turn 1 establishes the blockade; turn 2's resolve_diplomacy adds +2.
    const after1 = new MonthExecutor().execute(snapshot, [cmd], "seed", new DiagnosticCollector());
    const blockade = after1.finalSnapshot.wars.blockadeState[0]!;
    expect(blockade.blockaderId).toBe("GBR");
    expect(blockade.blockadedNationId).toBe("FRA");

    let snap2 = { ...after1.finalSnapshot };
    const warId = snap2.wars.wars[0]!.id;
    // run a second month where resolve_diplomacy is called on the existing blockade
    snap2 = {
      ...snap2,
      turnNumber: SafeInt(2),
      wars: {
        ...snap2.wars,
        wars: [{ ...snap2.wars.wars[0]!, status: "ACTIVE" as const }],
        battles: [],
      },
    };
    const after2 = new MonthExecutor().execute(snap2, [], "seed", new DiagnosticCollector());
    const war2 = after2.finalSnapshot.wars.wars.find((w) => w.id === warId)!;
    expect((war2.attackerWarScore as number) >= 2).toBe(true);
  });

  it("C9: FormAlliance is rejected when the pair is at war (ALLIANCE_TARGET_NOT_NEUTRAL)", () => {
    let snapshot = makeSnapshot(threeNations());
    snapshot = withWar(snapshot, { attackerId: "GBR", defenderId: "FRA" });
    snapshot = {
      ...snapshot,
      politics: {
        ...snapshot.politics,
        relations: snapshot.politics.relations.map((r) => {
          const key = [r.nationA, r.nationB].sort().join("\u0000");
          return key === ["GBR", "FRA"].sort().join("\u0000")
            ? { ...r, relation: "at_war" as const, tension: 10, nap: false }
            : r;
        }),
      },
    };
    const cmd = makeCommand(snapshot, {
      type: "FormAlliance",
      nationId: "GBR",
      partnerNationId: "FRA",
    });
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.validate(cmd, snapshot);
    expect(outcome.ok).toBe(false);
    if (outcome.ok === false) {
      expect(outcome.outcome.type).toBe("rejected");
      if (outcome.outcome.type === "rejected")
        expect(outcome.outcome.diagnostic.code).toBe("ALLIANCE_TARGET_NOT_NEUTRAL");
    }
  });

  it("C10: BreakAlliance is rejected during an active shared war (ALLIANCE_LOCKED_BY_WAR)", () => {
    let snapshot = makeSnapshot(threeNations());
    snapshot = withWar(snapshot, {
      attackerId: "GBR",
      defenderId: "FRA",
      defenderSideMembers: ["FRA", "GER"],
    });
    snapshot = {
      ...snapshot,
      politics: {
        ...snapshot.politics,
        relations: snapshot.politics.relations.map((r) => {
          const key = [r.nationA, r.nationB].sort().join("\u0000");
          if (key === ["GBR", "FRA"].sort().join("\u0000")) return {} as never;
          if (key === ["FRA", "GER"].sort().join("\u0000"))
            return { ...r, relation: "allied" as const, tension: 2, nap: false };
          return r;
        }),
      },
    };
    const cmd = makeCommand(snapshot, {
      type: "BreakAlliance",
      nationId: "FRA",
      partnerNationId: "GER",
    });
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.validate(cmd, snapshot);
    expect(outcome.ok).toBe(false);
    if (outcome.ok === false) {
      expect(outcome.outcome.type).toBe("rejected");
      if (outcome.outcome.type === "rejected")
        expect(outcome.outcome.diagnostic.code).toBe("ALLIANCE_LOCKED_BY_WAR");
    }
  });

  it("C11: NAP violation deducts 50 treasury from the violator", () => {
    const nations = threeNations();
    nations[0] = ["GBR", makeNation("GBR", { treasury: SafeInt(1000) })];
    let snapshot = makeSnapshot(nations);
    snapshot = {
      ...snapshot,
      politics: {
        ...snapshot.politics,
        relations: snapshot.politics.relations.map((r) => {
          const key = [r.nationA, r.nationB].sort().join("\u0000");
          return key === ["GBR", "FRA"].sort().join("\u0000")
            ? { ...r, relation: "neutral" as const, tension: 5, nap: true }
            : r;
        }),
      },
    };
    const cmd = makeCommand(snapshot, {
      type: "DeclareWar",
      nationId: "GBR",
      targetNationId: "FRA",
    });
    const result = new MonthExecutor().execute(snapshot, [cmd], "seed", new DiagnosticCollector());
    const gbr = result.finalSnapshot.nations.get("GBR")!;
    expect((gbr.treasury as number) <= 1000 - 50).toBe(true);
  });

  it("C12: DeclareWar on a non-existent target -> DECLARE_WAR_INVALID_TARGET", () => {
    const snapshot = makeSnapshot(threeNations());
    const cmd = makeCommand(snapshot, {
      type: "DeclareWar",
      nationId: "GBR",
      targetNationId: "RUS",
    });
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.validate(cmd, snapshot);
    expect(outcome.ok).toBe(false);
    if (outcome.ok === false) {
      expect(outcome.outcome.type).toBe("rejected");
      if (outcome.outcome.type === "rejected")
        expect(outcome.outcome.diagnostic.code).toBe("DECLARE_WAR_INVALID_TARGET");
    }
  });

  it("C13: DeclareWar on an already-at-war pair -> ALREADY_AT_WAR", () => {
    let snapshot = makeSnapshot(threeNations());
    snapshot = withWar(snapshot, { attackerId: "GBR", defenderId: "FRA" });
    snapshot = {
      ...snapshot,
      politics: {
        ...snapshot.politics,
        relations: snapshot.politics.relations.map((r) => {
          const key = [r.nationA, r.nationB].sort().join("\u0000");
          return key === ["GBR", "FRA"].sort().join("\u0000")
            ? { ...r, relation: "at_war" as const, tension: 10, nap: false }
            : r;
        }),
      },
    };
    const cmd = makeCommand(snapshot, {
      type: "DeclareWar",
      nationId: "GBR",
      targetNationId: "FRA",
    });
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.validate(cmd, snapshot);
    expect(outcome.ok).toBe(false);
    if (outcome.ok === false) {
      expect(outcome.outcome.type).toBe("rejected");
      if (outcome.outcome.type === "rejected")
        expect(outcome.outcome.diagnostic.code).toBe("ALREADY_AT_WAR");
    }
  });

  it("C14: identical seed twice produces an identical final snapshot hash", () => {
    let snapshot = makeSnapshot(threeNations());
    const cmd = makeCommand(snapshot, {
      type: "DeclareWar",
      nationId: "GBR",
      targetNationId: "FRA",
    });
    const run = () =>
      new MonthExecutor().execute(snapshot, [cmd], "det-seed", new DiagnosticCollector());
    const r1 = run().finalSnapshot;
    const r2 = run().finalSnapshot;
    expect(sha256Hex(canonicalSerialize(r1))).toBe(sha256Hex(canonicalSerialize(r2)));
  });
});
