// ADR-0070: ReviseProject - revision tiers applied to a real construction project.
import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { CommandLifecycle } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { EventLedger } from "@bluewave/events";
import { applyBudgetProject } from "../src/commands.js";
import { FinancialLedger } from "../src/financial-ledger.js";
import { addMonths } from "../src/reviseProject.js";
import { MonthExecutor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";

import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

// Without study rules a submitted design is approved the same month, which these tests rely on; studies themselves are
// covered in design-study.test.ts (ADR-0085).
const content = productionShipBuildingContent();
const reference = readReferenceDesignEntries();

// A cruiser, so project work (cost units, displacement / 100,000 kg) is large enough for meaningful percentages.
const baseDraft: Record<string, unknown> = {
  ...reference.find((d) => d.id === "torpedo_cruiser_1880")!.draft,
  nationId: ATTACKER_NATION,
};
const base = (): CampaignSnapshot => ({
  ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
  startYear: 1880,
  startMonth: 1,
});

const envelope = (
  snapshot: CampaignSnapshot,
  body: CommandBody,
  id: string,
): CommandEnvelope<CommandBody> => ({
  commandId: `c-${id}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
  idempotencyKey: `ik-${id}`,
  timestamp: "test",
  body,
});

function execute(
  snapshot: CampaignSnapshot,
  commands: CommandEnvelope<CommandBody>[],
  withContent = true,
) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    snapshot,
    commands,
    "revise-seed",
    collector,
    undefined,
    withContent ? { shipBuilding: content } : undefined,
  );
  return { snapshot: result.finalSnapshot, collector };
}

/** A snapshot holding a submitted design and a construction project on it with `done` work units complete. */
function withProject(done: number): CampaignSnapshot {
  const start = base();
  const submit = envelope(
    start,
    {
      type: "SubmitDesign",
      nationId: ATTACKER_NATION,
      designVersionId: "des_rev_base",
      designFamilyId: "fam_rev",
      className: "Rev class",
      hullType: "protected_cruiser", // the CL draft's own hull type (ADR-0088 checks the pair)
      machineryType: "locomotive_boiler",
      draft: baseDraft,
    },
    "base",
  );
  const { snapshot, collector } = execute(start, [submit]);
  expect(collector.all.filter((x) => x.code === "DESIGN_REJECTED")).toEqual([]);
  const nation = snapshot.nations.get(ATTACKER_NATION)!;
  const total = Math.round(
    Number(snapshot.designs.get("des_rev_base")!.normalizedDisplacementKg) / 100_000,
  );
  const project = {
    id: "con_rev",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "ship_rev",
    designVersionId: "des_rev_base",
    totalWork: SafeInt(total),
    completedWork: SafeInt(done),
    paidWork: SafeInt(done),
    status: "ACTIVE",
    startedAt: "1895-06",
  } as unknown as NationState["constructionProjects"][number];
  return {
    ...snapshot,
    nations: new Map([
      ...snapshot.nations,
      [ATTACKER_NATION, { ...nation, constructionProjects: [project] }],
    ]),
  };
}

const revised = (patch: (d: Record<string, any>) => void): Record<string, unknown> => {
  const d = structuredClone(baseDraft) as Record<string, any>;
  patch(d);
  return d;
};
const fittingsChange = revised((d) => (d.hull.designMarginBp += 100));
const machineryChange = revised((d) => (d.machinery.installedKw += 100));
const structureChange = revised((d) => (d.hull.beam += 60));

const revise = (snapshot: CampaignSnapshot, draft: unknown, id = "des_rev_2") =>
  execute(snapshot, [
    envelope(
      snapshot,
      {
        type: "ReviseProject",
        nationId: ATTACKER_NATION,
        projectId: "con_rev",
        newDesignVersionId: id,
        draft,
      },
      id,
    ),
  ]);
const projectOf = (s: CampaignSnapshot) =>
  s.nations.get(ATTACKER_NATION)!.constructionProjects.find((p) => p.id === "con_rev")!;
const codes = (c: DiagnosticCollector) => c.all.map((x) => x.code);

describe("ReviseProject through the month", () => {
  it("free change (T0, 0% built): swaps the design, grows the family, keeps history", () => {
    const before = withProject(0);
    const { snapshot, collector } = revise(before, fittingsChange);
    expect(codes(collector)).not.toContain("REVISION_REJECTED");
    const p = projectOf(snapshot);
    expect(p.designVersionId).toBe("des_rev_2");
    expect(Number(p.completedWork)).toBe(0);
    expect(snapshot.designs.get("des_rev_2")!.sourceDraft).toEqual(fittingsChange);
    expect(snapshot.designFamilies.get("fam_rev")!.memberDesignVersionIds).toEqual([
      "des_rev_base",
      "des_rev_2",
    ]);
    expect(snapshot.designs.get("des_rev_base")).toEqual(before.designs.get("des_rev_base"));
  });

  it("revision (T1, 20% built): keeps the work and adds rework to what is owed", () => {
    const before = withProject(4);
    const { snapshot, collector } = revise(before, fittingsChange);
    expect(codes(collector)).not.toContain("REVISION_REJECTED");
    const p = projectOf(snapshot);
    const newCost = Number(snapshot.designs.get("des_rev_2")!.constructionCostUnits);
    expect(Number(p.totalWork)).toBe(
      newCost + Math.floor((4 * content.revision!.reworkBp) / 10_000),
    );
    expect(Number(p.completedWork)).toBe(4);
  });

  it("redesign (T2, 40% built): loses the hull work the rules do not keep", () => {
    const { snapshot, collector } = revise(withProject(8), machineryChange);
    expect(codes(collector)).not.toContain("REVISION_REJECTED");
    const kept = Math.floor((8 * content.revision!.redesignKeptBp) / 10_000);
    expect(Number(projectOf(snapshot).completedWork)).toBe(kept);
    expect(projectOf(snapshot).designVersionId).toBe("des_rev_2");
  });

  it("a structural change is a redesign even on a barely started hull", () => {
    const { snapshot, collector } = revise(withProject(2), structureChange);
    expect(codes(collector)).not.toContain("REVISION_REJECTED");
    expect(Number(projectOf(snapshot).completedWork)).toBe(
      Math.floor((2 * content.revision!.redesignKeptBp) / 10_000),
    );
  });

  it("reconstruction (T3, 60% built): refused, snapshot untouched", () => {
    const before = withProject(12);
    const { snapshot, collector } = revise(before, fittingsChange);
    expect(codes(collector)).toContain("REVISION_REQUIRES_REBUILD");
    expect(snapshot.designs.has("des_rev_2")).toBe(false);
    expect(projectOf(snapshot)).toEqual(projectOf(before));
  });

  it("refuses a revision that changes nothing", () => {
    const { snapshot, collector } = revise(withProject(0), baseDraft);
    expect(codes(collector)).toContain("REVISION_REJECTED");
    expect(snapshot.designs.has("des_rev_2")).toBe(false);
  });

  it("refuses an invalid revised design, naming the blocking findings", () => {
    const heavy = revised((d) => (d.machinery.fuelCapacityKg = 400_000));
    const { snapshot, collector } = revise(withProject(0), heavy);
    expect(snapshot.designs.has("des_rev_2")).toBe(false);
    expect(collector.all.find((x) => x.code === "REVISION_REJECTED")?.message).toMatch(
      /cannot be built: [A-Z_]+/,
    );
  });

  it("is skipped with a diagnostic when the engine has no ship-building content", () => {
    const before = withProject(0);
    const out = execute(
      before,
      [
        envelope(
          before,
          {
            type: "ReviseProject",
            nationId: ATTACKER_NATION,
            projectId: "con_rev",
            newDesignVersionId: "des_rev_2",
            draft: fittingsChange,
          },
          "nocontent",
        ),
      ],
      false,
    );
    expect(codes(out.collector)).toContain("SHIP_BUILDING_CONTENT_MISSING");
  });

  it("is deterministic", () => {
    const before = withProject(4);
    const a = revise(before, fittingsChange).snapshot;
    const b = revise(before, fittingsChange).snapshot;
    expect(sha256Hex(canonicalSerialize(a))).toBe(sha256Hex(canonicalSerialize(b)));
  });
});

/**
 * A snapshot holding a submitted design and a project built from that design's construction plan (ADR-0077), with each
 * package `fractions[id]` (0..1, default 0) done.
 */
function withPackageProject(fractions: Record<string, number>): CampaignSnapshot {
  const start = withProject(0);
  const nation = start.nations.get(ATTACKER_NATION)!;
  const plan = start.designs.get("des_rev_base")!.constructionPlan!;
  const packages = plan.packages.map((p) => ({
    id: p.id,
    kind: p.kind,
    line: p.line,
    totalWork: p.totalWork,
    doneWork: SafeInt(Math.floor(Number(p.totalWork) * (fractions[p.id] ?? 0))),
    dependsOn: [...p.dependsOn],
  }));
  const total = packages.reduce((a, p) => a + Number(p.totalWork), 0);
  const completed = packages.reduce((a, p) => a + Number(p.doneWork), 0);
  const project = {
    ...nation.constructionProjects[0]!,
    totalWork: SafeInt(total),
    completedWork: SafeInt(completed),
    paidWork: SafeInt(completed),
    packages,
    yardId: plan.yardId,
  };
  return {
    ...start,
    nations: new Map([
      ...start.nations,
      [ATTACKER_NATION, { ...nation, constructionProjects: [project] }],
    ]),
  };
}
const packageInvariantsHold = (p: NationState["constructionProjects"][number]) =>
  p.packages !== undefined &&
  p.packages.reduce((a, x) => a + Number(x.totalWork), 0) === Number(p.totalWork) &&
  p.packages.reduce((a, x) => a + Number(x.doneWork), 0) === Number(p.completedWork) &&
  p.packages.every((x) => Number(x.doneWork) <= Number(x.totalWork));

describe("ReviseProject on a project with work packages (ADR-0077)", () => {
  it("a free change keeps the share done and the project consistent with the new design's plan", () => {
    const before = withPackageProject({ hull: 0.02 });
    const { snapshot, collector } = revise(before, fittingsChange);
    expect(collector.errors.map((e) => `${e.code}: ${e.message}`)).toEqual([]);
    const p = projectOf(snapshot);
    expect(packageInvariantsHold(p)).toBe(true);
    expect(p.designVersionId).toBe("des_rev_2");
    expect(p.yardId).toBe(snapshot.designs.get("des_rev_2")!.constructionPlan!.yardId);
    const hullBefore = projectOf(before).packages!.find((x) => x.id === "hull")!;
    const hullAfter = p.packages!.find((x) => x.id === "hull")!;
    // Same share of the hull is done (within one unit of rounding).
    const shareBefore = Number(hullBefore.doneWork) / Number(hullBefore.totalWork);
    const shareAfter = Number(hullAfter.doneWork) / Number(hullAfter.totalWork);
    expect(Math.abs(shareAfter - shareBefore)).toBeLessThan(1 / Number(hullAfter.totalWork) + 1e-9);
  });

  it("a launched ship is reconstruction: the revision is refused and nothing changes", () => {
    const before = withPackageProject({ hull: 1, launch: 1 });
    const { snapshot, collector } = revise(before, fittingsChange);
    expect(codes(collector)).toContain("REVISION_REQUIRES_REBUILD");
    expect(projectOf(snapshot)).toEqual(projectOf(before));
  });

  it("the same hull progress classifies differently once machinery work has really started", () => {
    // Little hull work (the free band) but machinery already under way: a machinery change is no longer free.
    const idle = withPackageProject({ hull: 0.02 });
    // The cruiser is a small project (machinery is 2 units), so a whole package is the smallest meaningful amount.
    const started = withPackageProject({ hull: 0.02, machinery: 1 });
    const free = revise(idle, machineryChange);
    const costly = revise(started, machineryChange);
    expect(projectOf(free.snapshot).holdUntilMonth).toBeUndefined();
    expect(projectOf(costly.snapshot).holdUntilMonth).toBeDefined();
    expect(costly.collector.errors).toEqual([]);
    expect(packageInvariantsHold(projectOf(costly.snapshot))).toBe(true);
  });

  it("a redesign keeps only hull work and still passes closing validation", () => {
    const before = withPackageProject({ hull: 0.3, machinery: 0.2 });
    const { snapshot, collector } = revise(before, structureChange);
    expect(collector.errors).toEqual([]);
    const p = projectOf(snapshot);
    expect(packageInvariantsHold(p)).toBe(true);
    expect(
      p.packages!.filter((x) => x.kind !== "HULL").every((x) => Number(x.doneWork) === 0),
    ).toBe(true);
    expect(Number(p.completedWork)).toBeLessThan(Number(projectOf(before).completedWork));
  });

  it("a project with one figure is classified exactly as before", () => {
    const legacy = withProject(4);
    const { snapshot } = revise(legacy, fittingsChange);
    expect(projectOf(snapshot).packages).toBeUndefined();
  });

  it("is deterministic", () => {
    const before = withPackageProject({ hull: 0.1, armour: 0.1 });
    const a = revise(before, machineryChange).snapshot;
    const b = revise(before, machineryChange).snapshot;
    expect(sha256Hex(canonicalSerialize(a))).toBe(sha256Hex(canonicalSerialize(b)));
  });
});

/** A snapshot where the attacker's first ship was built to the submitted design (so it carries its source draft). */
function withBuiltShip(): { snapshot: CampaignSnapshot; shipId: string } {
  const start = withProject(0);
  const nation = start.nations.get(ATTACKER_NATION)!;
  const [first, ...rest] = nation.fleets;
  const own = first!.ships[0]!;
  const ship = { ...own, designVersionId: "des_rev_base" };
  return {
    shipId: ship.id,
    snapshot: {
      ...start,
      nations: new Map([
        ...start.nations,
        [
          ATTACKER_NATION,
          { ...nation, fleets: [{ ...first!, ships: [ship, ...first!.ships.slice(1)] }, ...rest] },
        ],
      ]),
    },
  };
}
const rebuildCommand = (
  snapshot: CampaignSnapshot,
  shipId: string,
  draft: unknown,
  id = "des_reb_2",
) =>
  envelope(
    snapshot,
    {
      type: "StartRebuild",
      nationId: ATTACKER_NATION,
      shipId,
      projectId: "con_rebuild",
      newDesignVersionId: id,
      draft,
    },
    `rebuild-${id}`,
  );
const startRebuild = (snapshot: CampaignSnapshot, shipId: string, draft: unknown) =>
  execute(snapshot, [rebuildCommand(snapshot, shipId, draft)]);
const shipOf = (s: CampaignSnapshot, id: string) =>
  s.nations
    .get(ATTACKER_NATION)!
    .fleets.flatMap((f) => f.ships)
    .find((x) => x.id === id)!;

describe("StartRebuild through the month (ADR-0078)", () => {
  it("a legal rebuild makes the ship unavailable and starts a REBUILD project without the hull and launch", () => {
    const { snapshot, shipId } = withBuiltShip();
    const { snapshot: after, collector } = startRebuild(snapshot, shipId, machineryChange);
    expect(collector.errors.map((e) => `${e.code}: ${e.message}`)).toEqual([]);
    const ship = shipOf(after, shipId);
    expect(ship.availability).toBe("UNAVAILABLE");
    expect(ship.availabilityProjectId).toBe("con_rebuild");
    const project = after.nations
      .get(ATTACKER_NATION)!
      .constructionProjects.find((p) => p.id === "con_rebuild")!;
    expect(project).toMatchObject({
      projectType: "REBUILD",
      targetShipId: shipId,
      designVersionId: "des_reb_2",
      status: "PLANNED",
      completedWork: 0,
    });
    expect(project.packages!.map((p) => p.kind)).not.toContain("HULL");
    expect(project.packages!.map((p) => p.kind)).not.toContain("LAUNCH");
    expect(packageInvariantsHold(project)).toBe(true);
    expect(Number(project.totalWork)).toBeGreaterThan(0);
    expect(project.yardId).toBe(after.designs.get("des_reb_2")!.constructionPlan!.yardId);
    // The old design is kept; the ship still points at it until the rebuild completes.
    expect(after.designs.has("des_rev_base")).toBe(true);
    expect(ship.designVersionId).toBe("des_rev_base");
  });

  it("the ship cannot sail while it is being rebuilt", () => {
    const { snapshot, shipId } = withBuiltShip();
    const { snapshot: after } = startRebuild(snapshot, shipId, machineryChange);
    expect(shipOf(after, shipId).availability).toBe("UNAVAILABLE");
  });

  it("a rebuild outside the retained-hull limits is refused and changes nothing", () => {
    const { snapshot, shipId } = withBuiltShip();
    const tooWide = revised((d) => (d.hull.beam = Math.round(d.hull.beam * 1.2)));
    const { snapshot: after, collector } = startRebuild(snapshot, shipId, tooWide);
    expect(collector.errors.map((e) => e.code)).toContain("REBUILD_REJECTED");
    expect(collector.errors.map((e) => e.message).join()).toMatch(/REBUILD_BEAM_LIMIT/);
    expect(shipOf(after, shipId).availability).toBeUndefined();
    expect(
      after.nations.get(ATTACKER_NATION)!.constructionProjects.some((p) => p.id === "con_rebuild"),
    ).toBe(false);
    expect(after.designs.has("des_reb_2")).toBe(false);
  });

  it("a rebuild that changes nothing is refused", () => {
    const { snapshot, shipId } = withBuiltShip();
    const { collector } = startRebuild(snapshot, shipId, baseDraft);
    expect(collector.errors.map((e) => e.message).join()).toMatch(/changes nothing/);
  });

  it("a ship already unavailable cannot be rebuilt again", () => {
    const { snapshot, shipId } = withBuiltShip();
    const once = startRebuild(snapshot, shipId, machineryChange).snapshot;
    const again = execute(once, [rebuildCommand(once, shipId, fittingsChange, "des_reb_3")]);
    expect(again.snapshot.designs.has("des_reb_3")).toBe(false);
    expect(
      again.snapshot.nations
        .get(ATTACKER_NATION)!
        .constructionProjects.filter((p) => p.projectType === "REBUILD"),
    ).toHaveLength(1);
  });

  it("runs the whole life cycle: funded month by month, it completes, the ship becomes the new design and is released", () => {
    const { snapshot, shipId } = withBuiltShip();
    const nation = snapshot.nations.get(ATTACKER_NATION)!;
    // Plenty of money, so the yard's capacity (not the treasury) paces the rebuild.
    const rich: CampaignSnapshot = {
      ...snapshot,
      nations: new Map([
        ...snapshot.nations,
        [
          ATTACKER_NATION,
          {
            ...nation,
            treasury: SafeInt(1_000_000),
            baseResources: SafeInt(100_000_000),
            isPlayable: true,
          },
        ],
      ]),
    };
    let current = startRebuild(rich, shipId, machineryChange).snapshot;
    expect(shipOf(current, shipId).availability).toBe("UNAVAILABLE");
    const status: string[] = [];
    for (let m = 0; m < 80; m++) {
      const result = new MonthExecutor().execute(
        { ...current, turnNumber: SafeInt(Number(current.turnNumber) + 1) },
        [],
        `life-${m}`,
        new DiagnosticCollector(),
        undefined,
        { shipBuilding: content },
      );
      current = result.finalSnapshot;
      const p = current.nations
        .get(ATTACKER_NATION)!
        .constructionProjects.find((x) => x.id === "con_rebuild")!;
      status.push(p.status);
      // While it is under way the ship stays unavailable on its old design.
      if (p.status !== "COMPLETED") {
        expect(shipOf(current, shipId).availability).toBe("UNAVAILABLE");
        expect(shipOf(current, shipId).designVersionId).toBe("des_rev_base");
      }
      if (p.status === "COMPLETED") break;
    }
    expect(status.at(-1)).toBe("COMPLETED");
    const ship = shipOf(current, shipId);
    expect(ship.designVersionId).toBe("des_reb_2");
    expect(ship.availability).toBeUndefined();
    // No second ship appeared, and both design versions are still on record.
    const ids = current.nations
      .get(ATTACKER_NATION)!
      .fleets.flatMap((f) => f.ships)
      .map((s) => s.id);
    expect(ids.filter((id) => id === shipId)).toHaveLength(1);
    expect(current.designs.has("des_rev_base") && current.designs.has("des_reb_2")).toBe(true);
  });

  it("is deterministic", () => {
    const { snapshot, shipId } = withBuiltShip();
    const a = startRebuild(snapshot, shipId, machineryChange).snapshot;
    const b = startRebuild(snapshot, shipId, machineryChange).snapshot;
    expect(sha256Hex(canonicalSerialize(a))).toBe(sha256Hex(canonicalSerialize(b)));
  });
});

// The month executor applies commands in the month after the snapshot's start month (1880-01).
const APPLIED_MONTH = "1880-02";

describe("revision hold", () => {
  const budget = (snapshot: CampaignSnapshot, month: string) => {
    const collector = new DiagnosticCollector();
    const next = applyBudgetProject(
      snapshot,
      {
        type: "budget_project",
        nationId: ATTACKER_NATION,
        projectId: "con_rev",
        budget: SafeInt(1),
      },
      month,
      SafeInt(0),
      (() => {
        let n = 0;
        return () => SafeInt(n++);
      })(),
      new FinancialLedger(),
      new EventLedger(),
      collector,
    );
    return { next, codes: collector.all.map((x) => x.code) };
  };

  it("adds months across a year boundary", () => {
    expect(addMonths("1880-11", 1)).toBe("1880-12");
    expect(addMonths("1880-12", 1)).toBe("1881-01");
    expect(addMonths("1880-01", 13)).toBe("1881-02");
  });

  it("a revision (T1) holds funding for its delay, then releases it", () => {
    const { snapshot } = revise(withProject(4), fittingsChange);
    const hold = projectOf(snapshot).holdUntilMonth;
    expect(hold).toBe(addMonths(APPLIED_MONTH, content.revision!.t1DelayMonths));
    const blocked = budget(snapshot, APPLIED_MONTH);
    expect(blocked.codes).toContain("PROJECT_ON_HOLD");
    expect(blocked.next).toBe(snapshot);
    expect(budget(snapshot, hold!).codes).not.toContain("PROJECT_ON_HOLD");
  });

  it("a free change (T0) does not hold the project", () => {
    const { snapshot } = revise(withProject(0), fittingsChange);
    expect(projectOf(snapshot).holdUntilMonth).toBeUndefined();
    expect(budget(snapshot, APPLIED_MONTH).codes).not.toContain("PROJECT_ON_HOLD");
  });

  it("a redesign (T2) holds funding for the longer redesign delay", () => {
    const { snapshot } = revise(withProject(8), machineryChange);
    expect(projectOf(snapshot).holdUntilMonth).toBe(
      addMonths(APPLIED_MONTH, content.revision!.t2DelayMonths),
    );
  });
});

describe("ReviseProject issue-time validation", () => {
  const lifecycle = (snapshot: CampaignSnapshot, body: Record<string, unknown>) =>
    new CommandLifecycle().validate(
      envelope(
        snapshot,
        {
          type: "ReviseProject",
          nationId: ATTACKER_NATION,
          projectId: "con_rev",
          newDesignVersionId: "des_rev_2",
          draft: fittingsChange,
          ...body,
        } as CommandBody,
        "v",
      ),
      snapshot,
    );
  it("accepts a well-formed revision", () => {
    expect(lifecycle(withProject(0), {}).ok).toBe(true);
  });
  it("rejects unknown project, reused id, bad id, foreign draft", () => {
    const s = withProject(0);
    for (const bad of [
      { projectId: "nope" },
      { newDesignVersionId: "des_rev_base" },
      { newDesignVersionId: "Bad Id" },
      { draft: { ...fittingsChange, nationId: "XXX" } },
      { draft: {} },
    ])
      expect(lifecycle(s, bad).ok).toBe(false);
  });
  it("rejects a project on an authored design that has no source draft", () => {
    const s = withProject(0);
    const { sourceDraft: _drop, ...bare } = s.designs.get("des_rev_base")!;
    const authored = { ...s, designs: new Map([...s.designs, ["des_rev_base", bare]]) };
    expect(lifecycle(authored as CampaignSnapshot, {}).ok).toBe(false);
  });
});
