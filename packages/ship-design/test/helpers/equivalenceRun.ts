import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { buildArmourPartModel } from "../../src/armourPartAdapter.js";
import { buildFittingPartModel } from "../../src/fittingPartAdapter.js";
import { buildLauncherPartModel } from "../../src/torpedoPartAdapter.js";
import { buildPlantPartModel } from "../../src/plantPartAdapter.js";
import { compileDesign } from "../../src/index.js";
import {
  buildEquivalenceReport,
  type DesignComparison,
  type EquivalenceReport,
} from "../../src/equivalenceReport.js";
import { deriveMetrics } from "../../src/equivalenceMetrics.js";
import { runCandidateDesign, type CandidateEnvironment } from "../../src/equivalenceCandidate.js";
import {
  armamentContent,
  components,
  constructionBalance,
  costBalance,
  navalProfiles,
  nationalContext,
  plants,
  shipBalance,
} from "./earlyContext.js";
import { compatibility, designs, gunPartModel } from "./gunReadPath.js";
import { torpedoDiameterUm } from "./torpedoModels.js";

export const environment: CandidateEnvironment = {
  components,
  navalProfiles,
  armament: armamentContent,
  compatibility,
  models: {
    fittings: buildFittingPartModel({ components }),
    plants: buildPlantPartModel({ plants }),
    armour: buildArmourPartModel({ armour: shipBalance.armour }),
    launchers: buildLauncherPartModel({ components, profiles: navalProfiles, torpedoDiameterUm }),
    guns: gunPartModel,
  },
  contextFor: nationalContext,
};

const GUN = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);
const ENGINE = {
  className: "equivalence",
  hullType: "equivalence",
  machineryType: "equivalence",
  contentVersion: "equivalence",
  kgPerHitPoint: 214_000,
};

export function runEquivalence(
  options: { readonly designs?: typeof designs } = {},
): EquivalenceReport {
  const metricsOf = (
    compiled: Parameters<typeof deriveMetrics>[0]["compiled"],
    draft: Parameters<typeof deriveMetrics>[0]["draft"],
  ) => deriveMetrics({ compiled, draft, costBalance, constructionBalance, engine: ENGINE });
  const comparisons: DesignComparison[] = (options.designs ?? designs).map((design) => {
    const ctx = nationalContext(design.month, design.draft.nationId);
    const compiled = compileDesign(design.draft, ctx);
    const candidate = runCandidateDesign(design, environment);
    const category = (id: string) => components.find((c) => c.id === id)?.category;
    const cats = design.draft.placements.map((p) => category(p.componentId));
    return {
      design,
      baseline: { compiled, metrics: metricsOf(compiled, design.draft) },
      candidate,
      candidateMetrics:
        candidate.compiled !== null && candidate.draft !== null
          ? metricsOf(candidate.compiled, candidate.draft)
          : null,
      baselineCoverage: {
        placements: cats.length,
        gunPlacements: cats.filter((c) => c !== undefined && GUN.has(c)).length,
        tubePlacements: cats.filter((c) => c === "TORPEDO_TUBE").length,
        fittingPlacements: cats.filter(
          (c) => c !== undefined && !GUN.has(c) && c !== "TORPEDO_TUBE",
        ).length,
      },
    };
  });
  const contentHash = sha256Hex(
    canonicalSerialize({
      designs: (options.designs ?? designs).map((d) => ({ id: d.id, draft: d.draft })),
      components,
      plants,
      armour: shipBalance.armour,
      armament: armamentContent,
    }),
  );
  return buildEquivalenceReport({
    comparisons,
    baselinePipeline: { id: "legacy-compile", contentHash },
    candidatePipeline: { id: "parts-read-path", contentHash },
    launchers: environment.models.launchers.parts.map((p) => ({
      id: p.id,
      variant: p.origin.prototype !== undefined,
      waived: p.legacyExceptions !== undefined,
    })),
  });
}
