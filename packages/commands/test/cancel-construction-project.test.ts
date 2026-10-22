import type { CampaignSnapshot, CampaignSlot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import type { CommandBody, CommandEnvelope } from "../src/index.js";
import { CommandIdempotencyMap, CommandLifecycle } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function project(
  status: ConstructionProject["status"],
  over: Partial<ConstructionProject> = {},
): ConstructionProject {
  return {
    id: "proj-1",
    type: "ship",
    projectType: "REBUILD",
    targetId: "ship-x",
    targetShipId: "ship-x",
    designVersionId: "d1",
    totalWork: SafeInt(200),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status,
    startedAt: "1880-01",
    ...over,
  };
}

function snapshotWith(projects: ConstructionProject[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "cancel-construction-commands",
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
          treasury: SafeInt(1_000),
          income: SafeInt(100),
          expenses: SafeInt(0),
          baseResources: SafeInt(0),
          navalAppropriationRateBp: SafeInt(2_000),
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
          constructionProjects: projects,
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
    compatibilityVersion: "1.2.0",
  };
}

const slot: CampaignSlot = { nationId: "GBR", type: "playable" };

const envelope = (body: CommandBody, snapshot: CampaignSnapshot): CommandEnvelope<CommandBody> => ({
  commandId: `cmd-${body.type}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
  idempotencyKey: `ik-${body.type}`,
  timestamp: "test",
  body,
});

const outcome = (body: CommandBody, snapshot: CampaignSnapshot) =>
  new CommandLifecycle().process(
    envelope(body, snapshot),
    snapshot,
    slot,
    new CommandIdempotencyMap(),
  );

const code = (o: ReturnType<typeof outcome>): string =>
  o.type === "rejected" ? o.diagnostic.code : o.type;

const cancel = (projectId = "proj-1"): CommandBody => ({
  type: "CancelConstructionProject",
  nationId: "GBR",
  projectId,
});

describe("CancelConstructionProject payload validation (DESIGN-23 section 23)", () => {
  it("accepts cancelling a live project of any supported type", () => {
    for (const status of [
      "PLANNED",
      "ACTIVE",
      "HALTED",
      "DELAYED",
      "AWAITING_CAPACITY",
      "ACCELERATED",
    ] as const)
      expect(outcome(cancel(), snapshotWith([project(status)])).type, status).toBe("success");
    expect(
      outcome(
        cancel(),
        snapshotWith([
          project("ACTIVE", { projectType: "NEW_CONSTRUCTION", targetShipId: undefined }),
        ]),
      ).type,
    ).toBe("success");
  });

  it("rejects an unknown nation and a missing project", () => {
    expect(code(outcome({ ...cancel(), nationId: "XXX" }, snapshotWith([project("ACTIVE")])))).toBe(
      "INVALID_NATION_ID",
    );
    expect(code(outcome(cancel("ghost"), snapshotWith([project("ACTIVE")])))).toBe(
      "INVALID_DOCKYARD_PROJECT",
    );
  });

  it("rejects a terminal project", () => {
    for (const status of ["COMPLETED", "CANCELLED"] as const)
      expect(code(outcome(cancel(), snapshotWith([project(status)]))), status).toBe(
        "INVALID_DOCKYARD_PROJECT_TRANSITION",
      );
  });

  it("rejects a foreign-contract project (its cancellation is a contract outcome)", () => {
    expect(
      code(
        outcome(
          cancel(),
          snapshotWith([
            project("ACTIVE", { foreignContractId: "fc-1", foreignBuilderNationId: "FRA" }),
          ]),
        ),
      ),
    ).toBe("FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE");
  });
});
