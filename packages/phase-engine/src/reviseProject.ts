import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { projectedConstructionOrderCosts } from "@bluewave/campaign-engine";
import type { ReviseProjectCommand } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  classifyRevision,
  compileDesign,
  draftChangeKinds,
  inPlaceRevisionFindings,
  progressFromWork,
  revisionFactsOf,
  type DesignDraft,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import { projectBuildProgress, revisePackages } from "./constructionRevision.js";
import { buildDesignVersion, pricingFor } from "./designVersion.js";
import { FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE } from "./foreignConstruction.js";

/** `YYYY-MM` plus `n` months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * Canonical application of a ReviseProject command (ADR-0070). The new draft is compiled authoritatively, the change is
 * classified against the project's work with the spec 15.4 rules, and the outcome is applied:
 *
 * - free change (T0): the project switches to the new design; work done is kept.
 * - revision (T1): as T0, plus rework added to the work still owed.
 * - redesign (T2): as T0, but completed work shrinks to the share the rules keep.
 * - reconstruction (T3): refused (REVISION_REQUIRES_REBUILD); it needs a rebuild project, which does not exist yet.
 *
 * T1 and T2 also put the project on hold for the rule's delay months (`holdUntilMonth`): it cannot be funded until then.
 * A project with work packages (ADR-0077) is classified from its real state, so a launched ship is T3, and its packages are
 * rescaled onto the new design (`revisePackages`). Not modelled (recorded in the ADR, not guessed): the T2 study cost
 * (design studies are not built), and armour/machinery-ordered or launched state for a project with one figure.
 * A rejected revision leaves the snapshot untouched.
 */
export function applyReviseProject(
  currentSnapshot: CampaignSnapshot,
  body: ReviseProjectCommand,
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
  const project = nation.constructionProjects.find((p) => p.id === body.projectId);
  if (!project) return fail("PROJECT_NOT_FOUND", `Project ${body.projectId} not found`);
  // INC-9e MINOR-5: a foreign-contract project is funded by its contract schedule, so a revision (which would raise
  // `totalWork` and unlock free progress for already-paid instalments) is refused like a domestic budget.
  if (project["foreignContractId"] !== undefined)
    return fail(
      FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
      `Project ${project.id} is a foreign contract order funded by its instalment schedule and cannot be revised`,
    );
  if (project.status === "COMPLETED")
    return fail("REVISION_REJECTED", `Project ${project.id} is complete`);
  if (currentSnapshot.designs.has(body.newDesignVersionId))
    return fail("REVISION_REJECTED", `Design ${body.newDesignVersionId} already exists`);
  const oldDesign = currentSnapshot.designs.get(project.designVersionId);
  const oldDraft = oldDesign?.sourceDraft as DesignDraft | undefined;
  if (oldDesign === undefined || oldDraft === undefined)
    return fail(
      "REVISION_REJECTED",
      `Project ${project.id} has no source draft (authored design); it cannot be revised`,
    );
  if (content === undefined)
    return fail(
      "SHIP_BUILDING_CONTENT_MISSING",
      "The engine was not given ship-building content; revision not compiled",
    );
  if (content.revision === null)
    return fail("REVISION_RULES_MISSING", "The ship-building content has no revision rules");

  const draft = body.draft as DesignDraft;
  const compiled = compileDesign(draft, content.environmentFor(month).ctx);
  if (!compiled.valid) {
    const blocking = compiled.findings.filter((f) => f.severity === "BLOCKING").map((f) => f.id);
    return fail(
      "REVISION_REJECTED",
      `Revised design ${body.newDesignVersionId} cannot be built: ${blocking.join(", ")}`,
    );
  }
  const categories = new Map(content.components.map((c) => [c.id, c.category]));
  const kinds = draftChangeKinds(oldDraft, draft, (id) => categories.get(id));
  if (kinds.length === 0) return fail("REVISION_REJECTED", "The revision changes nothing");

  // A project with work packages is classified from its real state (armour or machinery started, launched); a project
  // with one figure keeps the conservative reading of that figure (ADR-0077).
  const decision = classifyRevision(
    kinds,
    projectBuildProgress(project) ??
      progressFromWork(Number(project.completedWork), Number(project.totalWork)),
    content.revision,
  );
  if (decision.requiresRebuildProject)
    return fail(
      "REVISION_REQUIRES_REBUILD",
      `Project ${project.id} is ${(decision.progressBp / 100).toFixed(1)}% built: this change would need a rebuild project (${decision.reasonCodes.join(", ")})`,
    );

  // The manual's in-place revision limits (printed p27; ADR-0132): a change beyond them is no longer a revision but a
  // redesign or a rebuild. They bound the T0/T1 tiers only; a T2/T3 outcome is already the redesign/rebuild path.
  if (decision.tier === "T0_FREE" || decision.tier === "T1_REVISION") {
    const envCtx = content.environmentFor(month).ctx;
    const beforeCompiled = compileDesign(oldDraft, envCtx);
    if (beforeCompiled.valid) {
      const breaches = inPlaceRevisionFindings(
        revisionFactsOf(beforeCompiled, oldDraft),
        revisionFactsOf(compiled, draft),
        content.revision.inPlace,
      );
      if (breaches.length > 0)
        return fail(
          "REVISION_LIMITS_EXCEEDED",
          `Project ${project.id} would exceed the in-place revision limits: ${breaches.map((x) => x.id).join(", ")}; plan a redesign or a rebuild instead`,
        );
    }
  }

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
  const newTotal = projectedConstructionOrderCosts(design).projectedCost;
  const total = newTotal + decision.reworkWorkMicro;
  const kept =
    decision.tier === "T2_REDESIGN" ? decision.hullDoneWorkAfter : Number(project.completedWork);
  // Work packages follow the new design (ADR-0077). A design with no plan drops them: the project goes back to one figure.
  const { packages: _packages, yardId: _yardId, monthUsage: _monthUsage, ...single } = project;
  const revisedPackages = revisePackages(project, design.constructionPlan, decision, kinds);
  const hold =
    decision.delayMonths > 0 ? { holdUntilMonth: addMonths(month, decision.delayMonths) } : {};
  const revised: ConstructionProject =
    revisedPackages === null
      ? {
          ...single,
          designVersionId: design.designVersionId,
          totalWork: SafeInt(total),
          completedWork: SafeInt(Math.min(kept, total)),
          // A hold from an earlier revision stays until it lapses; a new delay replaces it.
          ...hold,
        }
      : {
          ...single,
          designVersionId: design.designVersionId,
          totalWork: SafeInt(revisedPackages.totalWork),
          completedWork: SafeInt(revisedPackages.completedWork),
          packages: revisedPackages.packages,
          yardId: revisedPackages.yardId,
          ...(revisedPackages.monthUsage ? { monthUsage: revisedPackages.monthUsage } : {}),
          ...hold,
        };
  const updatedNation: NationState = {
    ...nation,
    constructionProjects: nation.constructionProjects.map((p) =>
      p.id === project.id ? revised : p,
    ),
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
