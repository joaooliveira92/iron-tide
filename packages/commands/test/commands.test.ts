import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import type { CampaignSnapshot, CampaignSlot } from "@bluewave/campaign";
import type { CommandEnvelope, CommandBody } from "../src/index.js";
import { CommandLifecycle, CommandIdempotencyMap, CommandLedger } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function makeTestSnapshot(treasury: SafeInt = SafeInt(1000)): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "test-campaign",
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
          treasury,
          income: SafeInt(100),
          expenses: SafeInt(50),
          baseResources: SafeInt(120000),
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

function makeEnvelope(
  overrides: Partial<CommandEnvelope<CommandBody>> = {},
): CommandEnvelope<CommandBody> {
  const snapshot = makeTestSnapshot();
  const hash = sha256Hex(canonicalSerialize(snapshot));
  return {
    commandId: "cmd-1",
    version: "0.1.0",
    expectedSnapshotHash: hash,
    idempotencyKey: "idem-1",
    timestamp: "2024-01-01T00:00:00Z",
    body: { type: "budget_project", nationId: "GBR", projectId: "proj-1", budget: SafeInt(100) },
    ...overrides,
  };
}

describe("CommandEnvelope", () => {
  it("creates a valid command envelope", () => {
    const snapshot = makeTestSnapshot();
    const hash = sha256Hex(canonicalSerialize(snapshot));
    const envelope: CommandEnvelope<CommandBody> = {
      commandId: "cmd-1",
      version: "0.1.0",
      expectedSnapshotHash: hash,
      idempotencyKey: "idem-1",
      timestamp: "2024-01-01T00:00:00Z",
      body: { type: "budget_project", nationId: "GBR", projectId: "proj-1", budget: SafeInt(100) },
    };
    expect(envelope.commandId).toBe("cmd-1");
    expect(envelope.body.type).toBe("budget_project");
    expect(envelope.body.nationId).toBe("GBR");
    if (envelope.body.type === "budget_project") {
      expect(envelope.body.budget).toBe(SafeInt(100));
    }
  });
});

describe("CommandLifecycle", () => {
  it("runs a successful lifecycle", () => {
    const snapshot = makeTestSnapshot();
    const envelope = makeEnvelope();
    const slot: CampaignSlot = { nationId: "GBR", type: "playable" };
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();

    const outcome = lifecycle.process(envelope, snapshot, slot, idempotencyMap);

    expect(outcome.type).toBe("success");
    if (outcome.type === "success") {
      expect(outcome.commandId).toBe("cmd-1");
      expect(outcome.snapshotHash).toBeTruthy();
    }
  });

  it("returns idempotency match for the same command", () => {
    const snapshot = makeTestSnapshot();
    const envelope = makeEnvelope();
    const slot: CampaignSlot = { nationId: "GBR", type: "playable" };
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();

    const firstOutcome = lifecycle.process(envelope, snapshot, slot, idempotencyMap);
    expect(firstOutcome.type).toBe("success");

    const secondOutcome = lifecycle.process(envelope, snapshot, slot, idempotencyMap);
    expect(secondOutcome.type).toBe("idempotency_match");
  });

  it("returns idempotency conflict for different command with same key", () => {
    const snapshot = makeTestSnapshot();
    const envelope = makeEnvelope();
    const slot: CampaignSlot = { nationId: "GBR", type: "playable" };
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();

    const firstOutcome = lifecycle.process(envelope, snapshot, slot, idempotencyMap);
    expect(firstOutcome.type).toBe("success");

    const conflictingEnvelope = makeEnvelope({
      commandId: "cmd-2",
      idempotencyKey: "idem-1",
    });
    const secondOutcome = lifecycle.process(conflictingEnvelope, snapshot, slot, idempotencyMap);
    expect(secondOutcome.type).toBe("idempotency_conflict");
  });

  it("rejects stale expectedSnapshotHash", () => {
    const snapshot = makeTestSnapshot();
    const envelope = makeEnvelope({
      commandId: "cmd-3",
      idempotencyKey: "idem-3",
      expectedSnapshotHash: "wrong-hash",
    });
    const slot: CampaignSlot = { nationId: "GBR", type: "playable" };
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();

    const outcome = lifecycle.process(envelope, snapshot, slot, idempotencyMap);
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected") {
      expect(outcome.diagnostic.code).toBe("STALE_SNAPSHOT_HASH");
    }
  });
});

function makePriorityEnvelope(
  fieldPriorities: Record<string, SafeInt>,
  overrides: Partial<CommandEnvelope<CommandBody>> = {},
): CommandEnvelope<CommandBody> {
  const snapshot = makeTestSnapshot();
  const hash = sha256Hex(canonicalSerialize(snapshot));
  return {
    commandId: "cmd-prio-1",
    version: "0.1.0",
    expectedSnapshotHash: hash,
    idempotencyKey: "idem-prio-1",
    timestamp: "2024-01-01T00:00:00Z",
    body: { type: "SetResearchPriority", nationId: "GBR", fieldPriorities },
    ...overrides,
  };
}

function validPriorities(): Record<string, SafeInt> {
  const priorities: Record<string, SafeInt> = {};
  for (const fieldId of CANONICAL_RESEARCH_FIELD_IDS) {
    priorities[fieldId] = SafeInt(1);
  }
  priorities["HULL_CONSTRUCTION"] = SafeInt(4);
  priorities["MACHINERY"] = SafeInt(2);
  return priorities;
}

describe("CommandLifecycle SetResearchPriority", () => {
  const slot: CampaignSlot = { nationId: "GBR", type: "playable" };

  it("accepts a valid priority command (1 high, weights 4/2/1)", () => {
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();
    const outcome = lifecycle.process(
      makePriorityEnvelope(validPriorities()),
      makeTestSnapshot(),
      slot,
      idempotencyMap,
    );
    expect(outcome.type).toBe("success");
  });

  it("rejects a command with zero HIGH fields with RESEARCH_PRIORITY_CONSTRAINT_VIOLATED", () => {
    const priorities = validPriorities();
    priorities["HULL_CONSTRUCTION"] = SafeInt(1);
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();
    const outcome = lifecycle.process(
      makePriorityEnvelope(priorities),
      makeTestSnapshot(),
      slot,
      idempotencyMap,
    );
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected") {
      expect(outcome.diagnostic.code).toBe("RESEARCH_PRIORITY_CONSTRAINT_VIOLATED");
    }
  });

  it("rejects a command with six HIGH fields with RESEARCH_PRIORITY_CONSTRAINT_VIOLATED", () => {
    const priorities = validPriorities();
    for (const fieldId of ["SHIP_DESIGN", "GUNNERY", "FIRE_CONTROL", "TORPEDOES", "SUBMARINES"]) {
      priorities[fieldId] = SafeInt(4);
    }
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();
    const outcome = lifecycle.process(
      makePriorityEnvelope(priorities),
      makeTestSnapshot(),
      slot,
      idempotencyMap,
    );
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected") {
      expect(outcome.diagnostic.code).toBe("RESEARCH_PRIORITY_CONSTRAINT_VIOLATED");
    }
  });

  it("rejects a command with a missing field priority with RESEARCH_PRIORITY_CONSTRAINT_VIOLATED", () => {
    const priorities = validPriorities();
    delete priorities["DAMAGE_CONTROL"];
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();
    const outcome = lifecycle.process(
      makePriorityEnvelope(priorities),
      makeTestSnapshot(),
      slot,
      idempotencyMap,
    );
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected") {
      expect(outcome.diagnostic.code).toBe("RESEARCH_PRIORITY_CONSTRAINT_VIOLATED");
    }
  });

  it("rejects a command naming an exact technology with EXACT_TECHNOLOGY_SELECTION_PROHIBITED", () => {
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();
    const envelope = makePriorityEnvelope(validPriorities(), {
      body: {
        type: "SetResearchPriority",
        nationId: "GBR",
        fieldPriorities: validPriorities(),
        exactTechId: "basic_steam",
      },
    });
    const outcome = lifecycle.process(envelope, makeTestSnapshot(), slot, idempotencyMap);
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected") {
      expect(outcome.diagnostic.code).toBe("EXACT_TECHNOLOGY_SELECTION_PROHIBITED");
    }
  });

  it("rejects a command with an invalid priority weight", () => {
    const priorities = validPriorities();
    priorities["MACHINERY"] = SafeInt(3);
    const lifecycle = new CommandLifecycle();
    const idempotencyMap = new CommandIdempotencyMap();
    const outcome = lifecycle.process(
      makePriorityEnvelope(priorities),
      makeTestSnapshot(),
      slot,
      idempotencyMap,
    );
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected") {
      expect(outcome.diagnostic.code).toBe("RESEARCH_PRIORITY_CONSTRAINT_VIOLATED");
    }
  });
});

describe("division commands (AC-3)", () => {
  function makeDivisionEnvelope(
    body: CommandBody,
    snapshot: CampaignSnapshot,
  ): CommandEnvelope<CommandBody> {
    return {
      commandId: `cmd-${body.type}`,
      version: "0.1.0",
      expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
      idempotencyKey: `ik-${body.type}`,
      timestamp: "test",
      body,
    };
  }

  function snapshotWithShip(shipId = "ship-1"): CampaignSnapshot {
    const s = makeTestSnapshot();
    const nation = s.nations.get("GBR")!;
    const next: CampaignSnapshot = {
      ...s,
      nations: new Map(s.nations).set("GBR", {
        ...nation,
        fleets: [
          {
            id: "fleet-1",
            nationId: "GBR",
            name: "Fleet",
            locationAreaId: "lon",
            ships: [
              {
                id: shipId,
                name: "Ship",
                classId: "battleship",
                nationId: "GBR",
                locationAreaId: "lon",
                designVersionId: "des-dreadnought",
                hitPoints: SafeInt(100),
                maxHitPoints: SafeInt(100),
                speed: SafeInt(10),
                firepower: SafeInt(10),
                armor: SafeInt(10),
                isUnderConstruction: false,
                constructionProgress: SafeInt(0),
                constructionTotalWork: SafeInt(0),
                readiness: "ACTIVE",
                crewQuality: SafeInt(100),
              },
            ],
          },
        ],
      }),
    };
    return next;
  }

  const slot: CampaignSlot = { nationId: "GBR", type: "playable" };

  it("CreateDivision succeeds and is atomic", () => {
    const snapshot = snapshotWithShip();
    const envelope = makeDivisionEnvelope(
      {
        type: "CreateDivision",
        nationId: "GBR",
        divisionId: "div-1",
        shipOrder: ["ship-1"],
        divisionRole: "CORE",
        preferredFormation: "LINE_AHEAD",
      },
      snapshot,
    );
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.process(envelope, snapshot, slot, new CommandIdempotencyMap());
    expect(outcome.type).toBe("success");
  });

  it("CreateDivision rejects duplicate id", () => {
    const snapshot = snapshotWithShip();
    const nation = snapshot.nations.get("GBR")!;
    const withDiv: CampaignSnapshot = {
      ...snapshot,
      nations: new Map(snapshot.nations).set("GBR", {
        ...nation,
        divisions: [
          {
            divisionId: "div-1",
            nationId: "GBR",
            shipOrder: ["ship-1"],
            flagshipShipId: "ship-1",
            commanderOfficerId: "VACANT",
            divisionRole: "CORE",
            preferredFormation: "LINE_AHEAD",
            experience: SafeInt(20),
            cohesion: SafeInt(30),
            locationAreaId: "lon",
            creationMonth: "1880-01",
            lastReorganizationMonth: "1880-01",
            provenanceRefs: [],
            rulesetVersion: "0.1.0",
            aggregateHash: "x",
          },
        ],
      }),
    };
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.process(
      makeDivisionEnvelope(
        {
          type: "CreateDivision",
          nationId: "GBR",
          divisionId: "div-1",
          shipOrder: ["ship-1"],
          divisionRole: "CORE",
          preferredFormation: "LINE_AHEAD",
        },
        withDiv,
      ),
      withDiv,
      slot,
      new CommandIdempotencyMap(),
    );
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected")
      expect(outcome.diagnostic.code).toBe("DIVISION_ALREADY_EXISTS");
  });

  it("CreateDivision rejects ship already in another division", () => {
    const snapshot = snapshotWithShip();
    const nation = snapshot.nations.get("GBR")!;
    const withDiv: CampaignSnapshot = {
      ...snapshot,
      nations: new Map(snapshot.nations).set("GBR", {
        ...nation,
        divisions: [
          {
            divisionId: "div-other",
            nationId: "GBR",
            shipOrder: ["ship-1"],
            flagshipShipId: "ship-1",
            commanderOfficerId: "VACANT",
            divisionRole: "CORE",
            preferredFormation: "LINE_AHEAD",
            experience: SafeInt(20),
            cohesion: SafeInt(30),
            locationAreaId: "lon",
            creationMonth: "1880-01",
            lastReorganizationMonth: "1880-01",
            provenanceRefs: [],
            rulesetVersion: "0.1.0",
            aggregateHash: "x",
          },
        ],
      }),
    };
    const lifecycle = new CommandLifecycle();
    const outcome = lifecycle.process(
      makeDivisionEnvelope(
        {
          type: "CreateDivision",
          nationId: "GBR",
          divisionId: "div-1",
          shipOrder: ["ship-1"],
          divisionRole: "CORE",
          preferredFormation: "LINE_AHEAD",
        },
        withDiv,
      ),
      withDiv,
      slot,
      new CommandIdempotencyMap(),
    );
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected")
      expect(outcome.diagnostic.code).toBe("DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE");
  });

  it("DissolveDivision validates division existence", () => {
    const snapshot = snapshotWithShip();
    const lifecycle = new CommandLifecycle();
    const missing = lifecycle.process(
      makeDivisionEnvelope(
        { type: "DissolveDivision", nationId: "GBR", divisionId: "div-ghost" },
        snapshot,
      ),
      snapshot,
      slot,
      new CommandIdempotencyMap(),
    );
    expect(missing.type).toBe("rejected");
    if (missing.type === "rejected")
      expect(missing.diagnostic.code).toBe("DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE");

    const withDiv: CampaignSnapshot = {
      ...snapshot,
      nations: new Map(snapshot.nations).set("GBR", {
        ...snapshot.nations.get("GBR")!,
        divisions: [
          {
            divisionId: "div-1",
            nationId: "GBR",
            shipOrder: ["ship-1"],
            flagshipShipId: "ship-1",
            commanderOfficerId: "VACANT",
            divisionRole: "CORE",
            preferredFormation: "LINE_AHEAD",
            experience: SafeInt(20),
            cohesion: SafeInt(30),
            locationAreaId: "lon",
            creationMonth: "1880-01",
            lastReorganizationMonth: "1880-01",
            provenanceRefs: [],
            rulesetVersion: "0.1.0",
            aggregateHash: "x",
          },
        ],
      }),
    };
    const ok = lifecycle.process(
      makeDivisionEnvelope(
        { type: "DissolveDivision", nationId: "GBR", divisionId: "div-1" },
        withDiv,
      ),
      withDiv,
      slot,
      new CommandIdempotencyMap(),
    );
    expect(ok.type).toBe("success");
  });

  function snapshotWithDivision(shipOrder: string[], flagshipShipId: string): CampaignSnapshot {
    const snapshot = snapshotWithShip();
    return {
      ...snapshot,
      nations: new Map(snapshot.nations).set("GBR", {
        ...snapshot.nations.get("GBR")!,
        divisions: [
          {
            divisionId: "div-1",
            nationId: "GBR",
            shipOrder,
            flagshipShipId,
            commanderOfficerId: "VACANT",
            divisionRole: "CORE",
            preferredFormation: "LINE_AHEAD",
            experience: SafeInt(20),
            cohesion: SafeInt(30),
            locationAreaId: "lon",
            creationMonth: "1880-01",
            lastReorganizationMonth: "1880-01",
            provenanceRefs: [],
            rulesetVersion: "0.1.0",
            aggregateHash: "x",
          },
        ],
      }),
    };
  }

  function reorderOutcome(preview: CampaignSnapshot, shipOrder: string[]) {
    const lifecycle = new CommandLifecycle();
    return lifecycle.process(
      makeDivisionEnvelope(
        { type: "ReorderDivisionShips", nationId: "GBR", divisionId: "div-1", shipOrder },
        preview,
      ),
      preview,
      slot,
      new CommandIdempotencyMap(),
    );
  }

  it("ReorderDivisionShips accepts a permutation with the flagship first", () => {
    const preview = snapshotWithDivision(["s1", "s2", "s3"], "s1");
    expect(reorderOutcome(preview, ["s1", "s3", "s2"]).type).toBe("success");
  });

  it("ReorderDivisionShips rejects a missing division", () => {
    const preview = snapshotWithShip();
    const outcome = reorderOutcome(preview, ["s1", "s2"]);
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected")
      expect(outcome.diagnostic.code).toBe("DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE");
  });

  it("ReorderDivisionShips rejects a non-permutation", () => {
    const preview = snapshotWithDivision(["s1", "s2", "s3"], "s1");
    const outcome = reorderOutcome(preview, ["s1", "s2"]);
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected")
      expect(outcome.diagnostic.code).toBe("DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE");
  });

  it("ReorderDivisionShips rejects moving the flagship", () => {
    const preview = snapshotWithDivision(["s1", "s2", "s3"], "s1");
    const outcome = reorderOutcome(preview, ["s2", "s1", "s3"]);
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected")
      expect(outcome.diagnostic.code).toBe("DIVISION_FLAGSHIP_INVALID");
  });

  it("ReorderDivisionShips rejects an unchanged order", () => {
    const preview = snapshotWithDivision(["s1", "s2", "s3"], "s1");
    const outcome = reorderOutcome(preview, ["s1", "s2", "s3"]);
    expect(outcome.type).toBe("rejected");
    if (outcome.type === "rejected")
      expect(outcome.diagnostic.code).toBe("DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE");
  });
});

describe("StartRebuild validation", () => {
  const ship = (over: Record<string, unknown> = {}) => ({
    id: "s1",
    name: "HMS Test",
    classId: "c",
    nationId: "GBR",
    locationAreaId: "a-1",
    designVersionId: "d_old",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    ...over,
  });
  const snapshotWith = (
    shipOver: Record<string, unknown> = {},
    opts: { sourceDraft?: boolean; extraDesign?: string; project?: string } = {},
  ): CampaignSnapshot => {
    const base = makeTestSnapshot();
    const nation = base.nations.get("GBR")!;
    const designs = new Map(base.designs);
    designs.set("d_old", {
      designVersionId: "d_old",
      ...(opts.sourceDraft === false ? {} : { sourceDraft: { nationId: "GBR" } }),
    } as never);
    if (opts.extraDesign)
      designs.set(opts.extraDesign, { designVersionId: opts.extraDesign } as never);
    return {
      ...base,
      designs,
      nations: new Map([
        [
          "GBR",
          {
            ...nation,
            fleets: [
              {
                id: "f",
                nationId: "GBR",
                name: "f",
                locationAreaId: "a-1",
                ships: [ship(shipOver)],
              },
            ],
            constructionProjects: opts.project
              ? [{ id: opts.project, projectType: "NEW_CONSTRUCTION" } as never]
              : [],
          },
        ],
      ]),
    } as unknown as CampaignSnapshot;
  };
  const rebuild = (
    snapshot: CampaignSnapshot,
    over: Partial<Extract<CommandBody, { type: "StartRebuild" }>> = {},
  ) => {
    const envelope: CommandEnvelope<CommandBody> = {
      commandId: "c1",
      version: "0.1.0",
      expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
      idempotencyKey: "k1",
      timestamp: "t",
      body: {
        type: "StartRebuild",
        nationId: "GBR",
        shipId: "s1",
        projectId: "con_rebuild",
        newDesignVersionId: "d_new",
        draft: { nationId: "GBR" },
        ...over,
      },
    };
    return new CommandLifecycle().process(
      envelope,
      snapshot,
      { nationId: "GBR", type: "playable" },
      new CommandIdempotencyMap(),
    );
  };
  const reason = (o: ReturnType<typeof rebuild>) =>
    o.type === "rejected" ? `${o.diagnostic.code}: ${o.diagnostic.message}` : o.type;

  it("rejects an unknown nation, an unknown ship and another nation's ship", () => {
    expect(reason(rebuild(snapshotWith(), { nationId: "XXX" }))).toContain("INVALID_NATION_ID");
    expect(reason(rebuild(snapshotWith(), { shipId: "ghost" }))).toContain("is not GBR");
  });
  it("rejects a ship that is under construction, already unavailable, or in a battle", () => {
    expect(reason(rebuild(snapshotWith({ isUnderConstruction: true })))).toContain(
      "SHIP_NOT_OPERATIONAL",
    );
    expect(reason(rebuild(snapshotWith({ availability: "UNAVAILABLE" })))).toContain(
      "SHIP_NOT_OPERATIONAL",
    );
    expect(reason(rebuild(snapshotWith({ inBattleId: "b1" })))).toContain("in a battle");
  });
  it("rejects bad ids, an existing design or project, and an authored design with no source draft", () => {
    expect(reason(rebuild(snapshotWith(), { newDesignVersionId: "Bad Id" }))).toContain(
      "lower snake_case",
    );
    expect(reason(rebuild(snapshotWith(), { projectId: "X" }))).toContain("lower snake_case");
    expect(reason(rebuild(snapshotWith({}, { extraDesign: "d_new" })))).toContain("already exists");
    expect(reason(rebuild(snapshotWith({}, { project: "con_rebuild" })))).toContain(
      "Project con_rebuild already exists",
    );
    expect(reason(rebuild(snapshotWith({}, { sourceDraft: false })))).toContain("no source draft");
  });
  it("rejects a malformed draft", () => {
    expect(reason(rebuild(snapshotWith()))).toContain("malformed");
  });
});

describe("CommandLedger", () => {
  it("produces deterministic hash", () => {
    const ledger1 = new CommandLedger();
    const ledger2 = new CommandLedger();

    const outcome1: import("../src/index.js").CommandOutcome = {
      type: "success",
      commandId: "cmd-1",
      snapshotHash: "abc123",
      result: { budget: SafeInt(100), nationId: "GBR", projectId: "proj-1" },
    };

    const outcome2: import("../src/index.js").CommandOutcome = {
      type: "success",
      commandId: "cmd-2",
      snapshotHash: "def456",
      result: { budget: SafeInt(50), nationId: "FRA", projectId: "proj-2" },
    };

    ledger1.add(outcome1);
    ledger1.add(outcome2);

    ledger2.add(outcome1);
    ledger2.add(outcome2);

    expect(ledger1.hash()).toBe(ledger2.hash());
    expect(ledger1.all.length).toBe(2);
    expect(ledger2.all.length).toBe(2);
  });
});
