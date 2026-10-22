import type {
  CampaignSnapshot,
  ConstructionPackage,
  ConstructionProject,
  NationState,
  Ship,
} from "@bluewave/campaign";
import { isShipOperational } from "@bluewave/campaign";
import type { StartRebuildCommand } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  compileDesign,
  draftChangeKinds,
  rebuildFactsOf,
  rebuildPackages,
  validateRebuild,
  yardDemandOf,
  type DesignDraft,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import { buildDesignVersion, pricingFor } from "./designVersion.js";
import {
  REBUILD_BULGE_REQUIRED,
  rebuildArmamentFindings,
  rebuildBulgeRequired,
} from "./refitRules.js";

export function applyStartRebuild(
  currentSnapshot: CampaignSnapshot,
  body: StartRebuildCommand,
  content: ShipBuildingContent | undefined,
  month: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const fail = (code: string, message: string): CampaignSnapshot => {
    collector.addError(code, message, { stage: "command_collection" });
    return currentSnapshot;
  };
  const nation = currentSnapshot.nations.get(body.nationId);
  if (!nation) return fail("INVALID_NATION_ID", `Nation ${body.nationId} not found`);
  const fleet = nation.fleets.find((f) => f.ships.some((s) => s.id === body.shipId));
  const ship = fleet?.ships.find((s) => s.id === body.shipId);
  if (!fleet || !ship) return fail("REBUILD_REJECTED", `Ship ${body.shipId} not found`);
  if (!isShipOperational(ship) || ship.inBattleId !== undefined)
    return fail(
      "REBUILD_REJECTED",
      `Ship ${ship.name} is under construction, already unavailable or in a battle`,
    );
  if (currentSnapshot.designs.has(body.newDesignVersionId))
    return fail("REBUILD_REJECTED", `Design ${body.newDesignVersionId} already exists`);
  if (nation.constructionProjects.some((p) => p.id === body.projectId))
    return fail("REBUILD_REJECTED", `Project ${body.projectId} already exists`);
  const oldDesign = currentSnapshot.designs.get(ship.designVersionId);
  const oldDraft = oldDesign?.sourceDraft as DesignDraft | undefined;
  if (oldDesign === undefined || oldDraft === undefined)
    return fail(
      "REBUILD_REJECTED",
      `Ship ${ship.name} has no source draft (authored design); it cannot be rebuilt`,
    );
  if (content === undefined)
    return fail(
      "SHIP_BUILDING_CONTENT_MISSING",
      "The engine was not given ship-building content; rebuild not compiled",
    );
  if (content.rebuild === null)
    return fail("REBUILD_RULES_MISSING", "The ship-building content has no rebuild rules");

  const env = content.environmentFor(month);
  const draft = body.draft as DesignDraft;
  const compiled = compileDesign(draft, env.ctx);
  if (!compiled.valid) {
    const blocking = compiled.findings.filter((f) => f.severity === "BLOCKING").map((f) => f.id);
    return fail(
      "REBUILD_REJECTED",
      `Rebuilt design ${body.newDesignVersionId} cannot be built: ${blocking.join(", ")}`,
    );
  }
  const categories = new Map(content.components.map((c) => [c.id, c.category]));
  if (draftChangeKinds(oldDraft, draft, (id) => categories.get(id)).length === 0)
    return fail("REBUILD_REJECTED", "The rebuild changes nothing");

  const armamentBlocking = rebuildArmamentFindings(oldDraft, draft, content, month).filter(
    (f) => f.severity === "BLOCKING" || f.severity === "CRITICAL",
  );
  if (armamentBlocking.length > 0)
    return fail(
      "REBUILD_REJECTED",
      `Ship ${ship.name} cannot be rebuilt to ${body.newDesignVersionId}: ${armamentBlocking.map((f) => f.id).join(", ")}`,
    );
  if (body.rebuildKind === "BULGE" && rebuildBulgeRequired(oldDraft, draft))
    return fail(
      REBUILD_BULGE_REQUIRED,
      `Ship ${ship.name} cannot be rebuilt with a bulge: the rebuild does not grow the hull, so no blister was added`,
    );

  const report = validateRebuild(
    rebuildFactsOf(compileDesign(oldDraft, env.ctx), oldDraft),
    rebuildFactsOf(compiled, draft),
    content.rebuild,
    { demand: yardDemandOf(compiled, draft), yards: env.yards },
  );
  if (!report.legal)
    return fail(
      "REBUILD_REJECTED",
      `Ship ${ship.name} cannot be rebuilt to ${body.newDesignVersionId}: ${report.findings.map((f) => f.id).join(", ")}`,
    );

  const design = buildDesignVersion(
    compiled,
    draft,
    {
      designVersionId: body.newDesignVersionId,
      designFamilyId: oldDesign.designFamilyId,
      className: oldDesign.className,
      hullType: oldDesign.hullType,
      machineryType: oldDesign.machineryType,
      contentVersion: currentSnapshot.rulesetVersion,
      kgPerHitPoint: content.kgPerHitPoint,
    },
    pricingFor(content, month),
  );
  const plan = design.constructionPlan;
  if (plan === undefined)
    return fail("REBUILD_REJECTED", "No shipyard can build the rebuilt design");

  const packages: ConstructionPackage[] = rebuildPackages(
    plan.packages.map((p) => ({
      id: p.id,
      kind: p.kind,
      line: p.line,
      totalWork: Number(p.totalWork),
      dependsOn: p.dependsOn,
    })),
  ).map((p) => ({
    id: p.id,
    kind: p.kind,
    line: p.line,
    totalWork: SafeInt(p.totalWork),
    doneWork: SafeInt(0),
    dependsOn: [...p.dependsOn],
  }));
  const total = packages.reduce((sum, p) => sum + Number(p.totalWork), 0);
  const project: ConstructionProject = {
    id: body.projectId,
    type: "ship",
    projectType: "REBUILD",
    targetShipId: ship.id,
    targetId: ship.id,
    designVersionId: design.designVersionId,
    totalWork: SafeInt(total),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "PLANNED",
    startedAt: month,
    packages,
    yardId: plan.yardId,
  };
  const unavailable: Ship = {
    ...ship,
    availability: "UNAVAILABLE",
    availabilityProjectId: project.id,
  };
  const updatedNation: NationState = {
    ...nation,
    fleets: nation.fleets.map((f) =>
      f.id === fleet.id
        ? { ...f, ships: f.ships.map((s) => (s.id === ship.id ? unavailable : s)) }
        : f,
    ),
    constructionProjects: [...nation.constructionProjects, project],
  };
  const family = currentSnapshot.designFamilies.get(oldDesign.designFamilyId);
  return {
    ...currentSnapshot,
    nations: new Map([...currentSnapshot.nations, [body.nationId, updatedNation]]),
    designs: new Map([...currentSnapshot.designs, [design.designVersionId, design]]),
    designFamilies: family
      ? new Map([
          ...currentSnapshot.designFamilies,
          [
            family.designFamilyId,
            {
              ...family,
              memberDesignVersionIds: [...family.memberDesignVersionIds, design.designVersionId],
            },
          ],
        ])
      : currentSnapshot.designFamilies,
  };
}
