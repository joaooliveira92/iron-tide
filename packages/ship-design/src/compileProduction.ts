import type { DesignHeaderData, LoadoutData } from "@bluewave/content-schema";
import { armourBalanceFromParts } from "./armourPartAdapter.js";
import { compileResolved } from "./compile.js";
import type { CompiledDesign, ShipContext } from "./compileShared.js";
import type { Finding } from "./findings.js";
import { resolveLoadout, type LoadoutResolutionIssue } from "./loadoutResolution.js";
import type { PartCatalogue } from "./partQueries.js";
import { deriveAfterFit, validateLoadoutFit } from "./partFit.js";
import { shipTypeRequirementsFor } from "./shipTypeRegistry.js";
import type {
  FitAmmunitionCompatibility,
  FitMountCountRanges,
  FitNationInput,
  FitResult,
} from "./partFitTypes.js";

export type ProductionCompile =
  | {
      readonly status: "ACCEPTED";
      readonly fit: FitResult;
      readonly compiled: CompiledDesign;
    }
  | {
      readonly status: "REJECTED" | "NOT_EVALUABLE";
      readonly fit: FitResult;
      readonly findings: readonly Finding[];
    }
  | {
      readonly status: "UNTRANSLATED";
      readonly issues: readonly LoadoutResolutionIssue[];
    };

export interface CompileDesignFromLoadoutInput {
  readonly designId: string;
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
  readonly catalogue: PartCatalogue;
  readonly month: string;
  readonly ctx: ShipContext;
  readonly nation?: FitNationInput;
  readonly mountCountRanges?: FitMountCountRanges;
  readonly unlockedTechnologies?: readonly string[];
  readonly ammunitionCompatibility?: FitAmmunitionCompatibility;
}

function fitFindings(fit: FitResult): Finding[] {
  const blocking = (id: string, what: string, parameters: Record<string, string>): Finding => ({
    id,
    severity: "BLOCKING",
    what,
    why: what,
    consequence: "The design cannot be built until the loadout fits.",
    remedies: [],
    evidence: { formulaId: id, inputs: {}, threshold: 0, value: 0 },
    parameters,
  });
  return [
    ...fit.findings.map((f) =>
      blocking(f.code, f.message, {
        path: f.path,
        slot: f.slot,
        ...(f.part ? { part: f.part } : {}),
      }),
    ),
    ...fit.dataIssues.map((d) => blocking(d.code, d.message, { path: d.path })),
  ];
}

export function compileDesignFromLoadout(input: CompileDesignFromLoadoutInput): ProductionCompile {
  const resolution = resolveLoadout({
    designId: input.designId,
    header: input.header,
    loadout: input.loadout,
    partOf: input.catalogue.partOf,
    slotOf: input.catalogue.slotLookup(input.loadout.platform),
  });
  if (resolution.status === "UNRESOLVED") {
    return { status: "UNTRANSLATED", issues: resolution.issues };
  }

  const requirements = shipTypeRequirementsFor(input.ctx, input.header.requirement.category);

  const check = (): FitResult =>
    validateLoadoutFit({
      parts: input.catalogue.parts,
      slotTemplates: input.catalogue.compatibility.slotTemplates,
      platforms: input.catalogue.compatibility.platforms,
      loadout: input.loadout,
      month: input.month,
      ...(input.nation === undefined ? {} : { nation: input.nation }),
      ...(input.mountCountRanges === undefined ? {} : { mountCountRanges: input.mountCountRanges }),
      ...(input.unlockedTechnologies === undefined
        ? {}
        : { unlockedTechnologies: input.unlockedTechnologies }),
      ...(input.ammunitionCompatibility === undefined
        ? {}
        : { ammunitionCompatibility: input.ammunitionCompatibility }),
      ...(requirements.length === 0 ? {} : { shipTypeRequirements: requirements }),
    });

  const outcome = deriveAfterFit(check(), () => {
    const findings: Finding[] = [];
    const balance = {
      ...input.ctx.balance,
      armour: armourBalanceFromParts(input.ctx.balance.armour, resolution.armourParts),
    };
    return compileResolved(
      resolution.intent,
      resolution.plant,
      resolution.resolved,
      input.ctx,
      findings,
      { balance },
    );
  });
  if (outcome.derived) {
    return { status: "ACCEPTED", fit: outcome.fit, compiled: outcome.value };
  }
  return {
    status: outcome.fit.status === "NOT_EVALUABLE" ? "NOT_EVALUABLE" : "REJECTED",
    fit: outcome.fit,
    findings: fitFindings(outcome.fit),
  };
}
