import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionProject,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { SubmitDesignCommand } from "@bluewave/commands";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { applySubmitDesign } from "../src/commands.js";
import { MonthExecutor } from "../src/index.js";
import { checkRebuildClassification } from "../src/rebuildClassification.js";
import { ATTACKER_NATION, makeBattleSnapshot, makeShip } from "./battle-fixtures.js";
import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent();
const reference = readReferenceDesignEntries();
const MONTH = "1880-01";

const baseDraft: Record<string, unknown> = {
  ...reference.find((d) => d.id === "torpedo_cruiser_1880")!.draft,
  nationId: ATTACKER_NATION,
};

const wrongIntendedDraft: Readonly<Record<string, unknown>> = {
  ...baseDraft,
  requirement: { ...(baseDraft["requirement"] as Record<string, unknown>), category: "DD" },
};

function submit(designVersionId: string): SubmitDesignCommand {
  return {
    type: "SubmitDesign",
    nationId: ATTACKER_NATION,
    designVersionId,
    designFamilyId: "fam_reb",
    className: "Rebuild class",
    hullType: "protected_cruiser",
    machineryType: "locomotive_boiler",
    draft: baseDraft,
  };
}

function completedRebuildSnapshot(
  tamper?: (design: CompiledDesignVersion) => CompiledDesignVersion,
): CampaignSnapshot {
  const collector = new DiagnosticCollector();
  const start: CampaignSnapshot = {
    ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
    startYear: 1880,
    startMonth: 1,
  };
  const withOld = applySubmitDesign(start, submit("des_old"), content, MONTH, collector);
  const withNew = applySubmitDesign(withOld, submit("des_new"), content, MONTH, collector);
  expect(collector.errors.map((e) => e.code)).toEqual([]);

  const designs = new Map(withNew.designs);
  if (tamper) designs.set("des_new", tamper(designs.get("des_new")!));

  const nation = withNew.nations.get(ATTACKER_NATION)!;
  const ship = {
    ...makeShip("s1", "des_old", ATTACKER_NATION),
    availability: "UNAVAILABLE" as const,
    availabilityProjectId: "proj-r",
  };
  const project: ConstructionProject = {
    id: "proj-r",
    type: "ship",
    projectType: "REBUILD",
    targetShipId: "s1",
    targetId: "s1",
    designVersionId: "des_new",
    totalWork: SafeInt(10),
    completedWork: SafeInt(10),
    paidWork: SafeInt(10),
    status: "ACTIVE",
    startedAt: MONTH,
  };
  return {
    ...withNew,
    designs,
    nations: new Map([
      ...withNew.nations,
      [
        ATTACKER_NATION,
        {
          ...nation,
          fleets: [{ ...nation.fleets[0]!, ships: [ship] }],
          constructionProjects: [project],
        },
      ],
    ]),
  };
}

function run(snapshot: CampaignSnapshot) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    snapshot,
    [],
    "rebuild-classification",
    collector,
    undefined,
    {
      shipBuilding: content,
    },
  );
  return { result, collector, nation: result.finalSnapshot.nations.get(ATTACKER_NATION)! };
}

const codes = (c: DiagnosticCollector) => c.all.map((x) => x.code);
const shipOf = (s: CampaignSnapshot) =>
  s.nations
    .get(ATTACKER_NATION)!
    .fleets.flatMap((f) => f.ships)
    .find((x) => x.id === "s1")!;
const projectOf = (s: CampaignSnapshot) =>
  s.nations.get(ATTACKER_NATION)!.constructionProjects.find((p) => p.id === "proj-r")!;

describe("checkRebuildClassification (DESIGN-22 section 22)", () => {
  const designOf = (s: CampaignSnapshot) => s.designs.get("des_new")!;

  it("passes a design whose intended type still validates and is natural (type unchanged)", () => {
    const snapshot = completedRebuildSnapshot();
    expect(checkRebuildClassification(designOf(snapshot), content, MONTH)).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("fails with the blocking classification findings when the intended type is illegal", () => {
    const snapshot = completedRebuildSnapshot((d) => ({ ...d, sourceDraft: wrongIntendedDraft }));
    const check = checkRebuildClassification(designOf(snapshot), content, MONTH);
    expect(check.ok).toBe(false);
    expect(check.reasons).toContain("INTENDED_CLASSIFICATION_ILLEGAL");
  });

  it("skips an authored design that carries no source draft (nothing to re-run)", () => {
    const snapshot = completedRebuildSnapshot((d) => {
      const { sourceDraft: _sourceDraft, ...rest } = d;
      return rest;
    });
    expect(checkRebuildClassification(designOf(snapshot), content, MONTH)).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("fails closed when the ship-building content is not loaded", () => {
    const snapshot = completedRebuildSnapshot();
    const check = checkRebuildClassification(designOf(snapshot), undefined, MONTH);
    expect(check.ok).toBe(false);
    expect(check.reasons).toContain("SHIP_BUILDING_CONTENT_MISSING");
  });
});

describe("a completed REBUILD re-runs classification (DESIGN-22 section 22, DESIGN-23 section 22)", () => {
  it("refuses an illegal rebuild atomically: no completion, no swap, no ShipRebuilt", () => {
    const before = completedRebuildSnapshot((d) => ({ ...d, sourceDraft: wrongIntendedDraft }));
    const { result, collector, nation } = run(before);

    expect(codes(collector)).toContain("REBUILD_CLASSIFICATION_INVALID");
    expect(projectOf(result.finalSnapshot).status).toBe("ACTIVE");
    const ship = shipOf(result.finalSnapshot);
    expect(ship.designVersionId).toBe("des_old");
    expect(ship.availability).toBe("UNAVAILABLE");
    expect(ship.availabilityProjectId).toBe("proj-r");
    expect(result.eventLedger.all.some((e) => e.eventType === "ShipRebuilt")).toBe(false);
    expect(nation.constructionProjects[0]!.status).toBe("ACTIVE");
  });

  it("completes a valid rebuild, re-running classification, with no new class created", () => {
    const before = completedRebuildSnapshot();
    const designCountBefore = before.designs.size;
    const { result, collector } = run(before);

    expect(codes(collector)).not.toContain("REBUILD_CLASSIFICATION_INVALID");
    expect(collector.errors).toEqual([]);
    expect(projectOf(result.finalSnapshot).status).toBe("COMPLETED");

    const ship = shipOf(result.finalSnapshot);
    expect(ship.designVersionId).toBe("des_new");
    expect(ship.availability).toBeUndefined();
    expect(ship.classId).toBe(before.designs.get("des_new")!.className);
    expect(result.finalSnapshot.designs.size).toBe(designCountBefore);

    const rebuilt = result.eventLedger.all.filter((e) => e.eventType === "ShipRebuilt");
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0]!.body).toMatchObject({
      projectId: "proj-r",
      shipId: "s1",
      fromDesignVersionId: "des_old",
      toDesignVersionId: "des_new",
    });
  });

  it("is deterministic", () => {
    const a = run(completedRebuildSnapshot((d) => ({ ...d, sourceDraft: wrongIntendedDraft })));
    const b = run(completedRebuildSnapshot((d) => ({ ...d, sourceDraft: wrongIntendedDraft })));
    expect(codes(a.collector)).toEqual(codes(b.collector));
    expect(shipOf(a.result.finalSnapshot)).toEqual(shipOf(b.result.finalSnapshot));
  });
});
