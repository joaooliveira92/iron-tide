/**
 * The production parts compile path (ship-part-model SPM-R21, ticket 11d).
 *
 * A design is carried as a `DesignHeader` + `DesignLoadout` — the parts representation the
 * content compiler emits. This is the production boundary: it rebuilds the legacy `DesignDraft`
 * from the parts (never from a legacy placement list), validates the loadout through
 * `validateLoadoutFit`, and reaches `compileDesign` only through `deriveAfterFit`. A loadout that
 * is `REJECTED` or `NOT_EVALUABLE` yields fit information and no derived metric of any kind, so no
 * caller can obtain derived metrics from an invalid loadout.
 */
import type {
  DesignHeaderData,
  FlattenedPart,
  LoadoutData,
  PlatformData,
  SlotData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import { rebuildDraft, type InverseReaderIssue } from "./partCatalogueReaders.js";
import type { CompatibilityModel } from "./partCompatibility.js";
import { platformSlots } from "./partCompatibility.js";
import { compileDesignThroughFit } from "./compileThroughFit.js";
import type { CompiledDesign, DesignDraft, ShipContext } from "./compileShared.js";
import type { Finding } from "./findings.js";
import { validateLoadoutFit } from "./partFit.js";
import { shipTypeRequirementsFor } from "./shipTypeRegistry.js";
import type {
  FitAmmunitionCompatibility,
  FitMountCountRanges,
  FitNationInput,
  FitResult,
} from "./partFitTypes.js";

/** The parts a production design compiles against: the whole catalogue and the compatibility slots. */
export interface ProductionPartModel {
  readonly parts: readonly FlattenedPart[];
  readonly compatibility: CompatibilityModel;
  readonly partOf: (id: string) => FlattenedPart | undefined;
  readonly slotOf: (slotId: string) => SlotData | undefined;
}

/** Build the production part model from a compiled part model's parts, slot templates and platforms. */
export function buildProductionPartModel(input: {
  readonly parts: readonly FlattenedPart[];
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
}): ProductionPartModel {
  const byId = new Map(input.parts.map((part) => [part.id, part] as const));
  const compatibility: CompatibilityModel = {
    slotTemplates: input.slotTemplates,
    platforms: input.platforms,
  };
  return {
    parts: input.parts,
    compatibility,
    partOf: (id) => byId.get(id),
    slotOf: (slotId) => {
      for (const platform of input.platforms) {
        const slot = (platformSlots(compatibility, platform.id) ?? []).find((s) => s.id === slotId);
        if (slot !== undefined) return slot;
      }
      return undefined;
    },
  };
}

export type ProductionCompile =
  | {
      readonly status: "ACCEPTED";
      readonly fit: FitResult;
      readonly draft: DesignDraft;
      readonly compiled: CompiledDesign;
    }
  | {
      readonly status: "REJECTED" | "NOT_EVALUABLE";
      readonly fit: FitResult;
      /** Blocking findings projected from the fit result; no derived value exists. */
      readonly findings: readonly Finding[];
    }
  | {
      readonly status: "UNTRANSLATED";
      readonly issues: readonly InverseReaderIssue[];
    };

export interface CompileDesignFromLoadoutInput {
  readonly designId: string;
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
  readonly model: ProductionPartModel;
  readonly month: string;
  readonly ctx: ShipContext;
  readonly nation?: FitNationInput;
  readonly mountCountRanges?: FitMountCountRanges;
  readonly unlockedTechnologies?: readonly string[];
  readonly ammunitionCompatibility?: FitAmmunitionCompatibility;
}

/**
 * Compile one design from its parts loadout through the fit barrier. A loadout the inverse
 * readers cannot rebuild is `UNTRANSLATED`; otherwise the fit decides whether `compileDesign`
 * runs, and an invalid loadout exposes only fit information.
 */
export function compileDesignFromLoadout(input: CompileDesignFromLoadoutInput): ProductionCompile {
  const slots = platformSlots(input.model.compatibility, input.loadout.platform) ?? [];
  const rebuilt = rebuildDraft({
    designId: input.designId,
    header: input.header,
    loadout: input.loadout,
    partOf: input.model.partOf,
    slotOf: (slotId) => slots.find((slot) => slot.id === slotId),
  });
  if (rebuilt.draft === null || rebuilt.issues.length > 0) {
    return { status: "UNTRANSLATED", issues: rebuilt.issues };
  }

  // The intended type's fit requirements come from the compiled registry in the context; a context
  // built without content (or a type declaring none) adds no `TYPE_REQUIRES_*` finding.
  const requirements = shipTypeRequirementsFor(input.ctx, input.header.requirement.category);

  const check = (): FitResult =>
    validateLoadoutFit({
      parts: input.model.parts,
      slotTemplates: input.model.compatibility.slotTemplates,
      platforms: input.model.compatibility.platforms,
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

  const outcome = compileDesignThroughFit(rebuilt.draft, input.ctx, check);
  if (outcome.status === "ACCEPTED") {
    return {
      status: "ACCEPTED",
      fit: outcome.fit,
      draft: rebuilt.draft,
      compiled: outcome.compiled,
    };
  }
  return { status: outcome.status, fit: outcome.fit, findings: outcome.findings };
}
