import type {
  DesignHeaderData,
  FlattenedPart,
  LoadoutData,
  PlatformData,
  SlotData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import { armourBalanceFromParts } from "./armourPartAdapter.js";
import { compileResolved } from "./compile.js";
import type { CompiledDesign, ShipContext } from "./compileShared.js";
import { compileThroughFit } from "./compileThroughFit.js";
import type { Finding } from "./findings.js";
import { resolveLoadout, type LoadoutResolutionIssue } from "./loadoutResolution.js";
import type { CompatibilityModel } from "./partCompatibility.js";
import { platformSlots } from "./partCompatibility.js";
import { validateLoadoutFit } from "./partFit.js";
import { shipTypeRequirementsFor } from "./shipTypeRegistry.js";
import type {
  FitAmmunitionCompatibility,
  FitMountCountRanges,
  FitNationInput,
  FitResult,
} from "./partFitTypes.js";

export interface ProductionPartModel {
  readonly parts: readonly FlattenedPart[];
  readonly compatibility: CompatibilityModel;
  readonly partOf: (id: string) => FlattenedPart | undefined;
  readonly slotOf: (slotId: string) => SlotData | undefined;
}

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
  readonly model: ProductionPartModel;
  readonly month: string;
  readonly ctx: ShipContext;
  readonly nation?: FitNationInput;
  readonly mountCountRanges?: FitMountCountRanges;
  readonly unlockedTechnologies?: readonly string[];
  readonly ammunitionCompatibility?: FitAmmunitionCompatibility;
}

export function compileDesignFromLoadout(input: CompileDesignFromLoadoutInput): ProductionCompile {
  const slots = platformSlots(input.model.compatibility, input.loadout.platform) ?? [];
  const resolution = resolveLoadout({
    designId: input.designId,
    header: input.header,
    loadout: input.loadout,
    partOf: input.model.partOf,
    slotOf: (slotId) => slots.find((slot) => slot.id === slotId),
  });
  if (resolution.status === "UNRESOLVED") {
    return { status: "UNTRANSLATED", issues: resolution.issues };
  }

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

  return compileThroughFit(check, () => {
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
}
