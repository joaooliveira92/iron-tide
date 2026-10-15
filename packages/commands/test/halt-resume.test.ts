import type { CampaignSnapshot, CampaignSlot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import type { CommandBody, CommandEnvelope } from "../src/index.js";
import { CommandIdempotencyMap, CommandLifecycle } from "../src/index.js";

function project(status: ConstructionProject["status"], id = "proj-1"): ConstructionProject {
  return {
    id,
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "ship-x",
    designVersionId: "",
    totalWork: SafeInt(200),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status,
    startedAt: "1880-01",
  };
}

function snapshotWith(projects: ConstructionProject[]): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "halt-resume-commands",
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

const envelope = (
  body: CommandBody,
  snapshot: CampaignSnapshot,
  commandId = `cmd-${body.type}`,
): CommandEnvelope<CommandBody> => ({
  commandId,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
  idempotencyKey: `ik-${commandId}`,
  timestamp: "test",
  body,
});

function outcome(body: CommandBody, snapshot: CampaignSnapshot) {
  return new CommandLifecycle().process(
    envelope(body, snapshot),
    snapshot,
    slot,
    new CommandIdempotencyMap(),
  );
}

const code = (o: ReturnType<typeof outcome>): string =>
  o.type === "rejected" ? o.diagnostic.code : o.type;

describe("HaltConstruction / ResumeConstruction payload validation (SB3-R5)", () => {
  it("accepts halting an active project and resuming a halted one", () => {
    expect(
      outcome(
        { type: "HaltConstruction", nationId: "GBR", projectId: "proj-1" },
        snapshotWith([project("ACTIVE")]),
      ).type,
    ).toBe("success");
    expect(
      outcome(
        { type: "ResumeConstruction", nationId: "GBR", projectId: "proj-1" },
        snapshotWith([project("HALTED")]),
      ).type,
    ).toBe("success");
  });

  it("rejects an unknown nation", () => {
    const snapshot = snapshotWith([project("ACTIVE")]);
    expect(
      code(outcome({ type: "HaltConstruction", nationId: "XXX", projectId: "proj-1" }, snapshot)),
    ).toBe("INVALID_NATION_ID");
  });

  it("rejects a missing or foreign project with INVALID_DOCKYARD_PROJECT", () => {
    const snapshot = snapshotWith([project("ACTIVE")]);
    expect(
      code(outcome({ type: "HaltConstruction", nationId: "GBR", projectId: "ghost" }, snapshot)),
    ).toBe("INVALID_DOCKYARD_PROJECT");
    expect(
      code(outcome({ type: "ResumeConstruction", nationId: "GBR", projectId: "ghost" }, snapshot)),
    ).toBe("INVALID_DOCKYARD_PROJECT");
  });

  it("rejects a terminal project with INVALID_DOCKYARD_PROJECT_TRANSITION", () => {
    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      const snapshot = snapshotWith([project(status)]);
      expect(
        code(outcome({ type: "HaltConstruction", nationId: "GBR", projectId: "proj-1" }, snapshot)),
      ).toBe("INVALID_DOCKYARD_PROJECT_TRANSITION");
      expect(
        code(
          outcome({ type: "ResumeConstruction", nationId: "GBR", projectId: "proj-1" }, snapshot),
        ),
      ).toBe("INVALID_DOCKYARD_PROJECT_TRANSITION");
    }
  });
});
