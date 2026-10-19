import type { CampaignSnapshot, CampaignSlot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import type { CommandBody, CommandEnvelope } from "../src/index.js";
import { CommandIdempotencyMap, CommandLifecycle } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function project(
  status: ConstructionProject["status"],
  projectType: ConstructionProject["projectType"] = "NEW_CONSTRUCTION",
  id = "proj-1",
): ConstructionProject {
  return {
    id,
    type: "ship",
    projectType,
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
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "set-acceleration-commands",
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

describe("SetAcceleration payload validation (SB3-R8, SB3-R10)", () => {
  it("accepts enabling an active new-construction project and disabling an accelerated one", () => {
    expect(
      outcome(
        { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
        snapshotWith([project("ACTIVE")]),
      ).type,
    ).toBe("success");
    expect(
      outcome(
        { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: false },
        snapshotWith([project("ACCELERATED")]),
      ).type,
    ).toBe("success");
  });

  it("rejects an unknown nation and a foreign or missing project", () => {
    const snapshot = snapshotWith([project("ACTIVE")]);
    expect(
      code(
        outcome(
          { type: "SetAcceleration", nationId: "XXX", projectId: "proj-1", accelerated: true },
          snapshot,
        ),
      ),
    ).toBe("INVALID_NATION_ID");
    expect(
      code(
        outcome(
          { type: "SetAcceleration", nationId: "GBR", projectId: "ghost", accelerated: true },
          snapshot,
        ),
      ),
    ).toBe("INVALID_DOCKYARD_PROJECT");
  });

  it("rejects a non-boolean accelerated flag", () => {
    expect(
      code(
        outcome(
          {
            type: "SetAcceleration",
            nationId: "GBR",
            projectId: "proj-1",
            accelerated: "yes" as never,
          },
          snapshotWith([project("ACTIVE")]),
        ),
      ),
    ).toBe("INVALID_COMMAND_PAYLOAD");
  });

  it("refuses a rebuild project type with ACCELERATION_NOT_ALLOWED", () => {
    expect(
      code(
        outcome(
          { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
          snapshotWith([project("ACTIVE", "REBUILD")]),
        ),
      ),
    ).toBe("ACCELERATION_NOT_ALLOWED");
  });

  it("refuses terminal, halted, delayed and awaiting-capacity projects", () => {
    for (const status of [
      "COMPLETED",
      "CANCELLED",
      "HALTED",
      "DELAYED",
      "AWAITING_CAPACITY",
      "IMPOUNDED",
    ] as const) {
      expect(
        code(
          outcome(
            { type: "SetAcceleration", nationId: "GBR", projectId: "proj-1", accelerated: true },
            snapshotWith([project(status)]),
          ),
        ),
        status,
      ).toBe("INVALID_DOCKYARD_PROJECT_TRANSITION");
    }
  });

  it("has no count-based rejection: many valid projects may be accelerated", () => {
    const projects = Array.from({ length: 20 }, (_, i) =>
      project("ACTIVE", "NEW_CONSTRUCTION", `proj-${String(i)}`),
    );
    const snapshot = snapshotWith(projects);
    for (const p of projects) {
      expect(
        outcome(
          { type: "SetAcceleration", nationId: "GBR", projectId: p.id, accelerated: true },
          snapshot,
        ).type,
        p.id,
      ).toBe("success");
    }
  });
});
