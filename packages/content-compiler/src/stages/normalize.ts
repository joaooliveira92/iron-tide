import type { CompiledPartModel } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

import type { CompilerStage } from "../index.js";
import type { FlattenOutput } from "./flatten.js";

export interface NormalizeOutput {
  manifest: unknown;
  rulesets: Record<string, unknown>[];
  countries: Record<string, unknown>[];
  areas: Record<string, unknown>[];
  routes: Record<string, unknown>[];
  possessions: Record<string, unknown>[];
  ports: Record<string, unknown>[];
  technologies: Record<string, unknown>[];
  shipComponents: Record<string, unknown>[];
  componentSources: ReadonlyMap<string, string>;
  propulsionPlants: Record<string, unknown>[];
  shipHullForms: Record<string, unknown>[];
  shipBalance: unknown;
  gunFamilies: Record<string, unknown>[];
  gunModels: Record<string, unknown>[];
  gunMounts: Record<string, unknown>[];
  ammunition: Record<string, unknown>[];
  navalProfiles: Record<string, unknown>[];
  referenceDesigns: Record<string, unknown>[];
  partModel?: CompiledPartModel;
  designLoadouts: Record<string, unknown>[];
  fleets: Record<string, unknown>[];
  economies: Record<string, unknown>[];
  constructions: Record<string, unknown>[];
  diplomacy: Record<string, unknown>[];
  research: Record<string, unknown>[];
  designs: Record<string, unknown>[];
  divisions: Record<string, unknown>[];
  events: Record<string, unknown>[];
  presentation?: unknown;
  ui?: unknown;
}

function sortByField<T extends Record<string, unknown>>(items: T[], field: string): T[] {
  return [...items].sort((a, b) => {
    const aId = a[field];
    const bId = b[field];
    if (typeof aId === "string" && typeof bId === "string") {
      return compareCodePoints(aId, bId);
    }
    return 0;
  });
}

function sortById<T extends Record<string, unknown>>(items: T[]): T[] {
  return sortByField(items, "id");
}

export class NormalizeStage implements CompilerStage<FlattenOutput, NormalizeOutput> {
  readonly name = "normalize";

  run(
    input: FlattenOutput,
    _signal: AbortSignal,
    _collector: DiagnosticCollector,
  ): NormalizeOutput {
    return {
      manifest: input.manifest,
      rulesets: sortById(input.rulesets as Record<string, unknown>[]),
      countries: sortById(input.countries as Record<string, unknown>[]),
      areas: sortById(input.areas as Record<string, unknown>[]),
      routes: sortById(input.routes as Record<string, unknown>[]),
      possessions: sortById(input.possessions as Record<string, unknown>[]),
      ports: sortById(input.ports as Record<string, unknown>[]),
      technologies: sortById(input.technologies as Record<string, unknown>[]),
      shipComponents: sortById((input.shipComponents ?? []) as Record<string, unknown>[]),
      componentSources: input.componentSources ?? new Map(),
      propulsionPlants: sortById((input.propulsionPlants ?? []) as Record<string, unknown>[]),
      shipHullForms: sortById((input.shipHullForms ?? []) as Record<string, unknown>[]),
      shipBalance: input.shipBalance,
      gunFamilies: sortById((input.gunFamilies ?? []) as Record<string, unknown>[]),
      gunModels: sortById((input.gunModels ?? []) as Record<string, unknown>[]),
      gunMounts: sortById((input.gunMounts ?? []) as Record<string, unknown>[]),
      ammunition: sortById((input.ammunition ?? []) as Record<string, unknown>[]),
      navalProfiles: sortByField(
        (input.navalProfiles ?? []) as Record<string, unknown>[],
        "nationId",
      ),
      referenceDesigns: [...((input.referenceDesigns ?? []) as Record<string, unknown>[])],
      ...(input.partModel !== undefined ? { partModel: input.partModel } : {}),
      designLoadouts: [...((input.designLoadouts ?? []) as Record<string, unknown>[])],
      fleets: sortById((input.fleets ?? []) as Record<string, unknown>[]),
      economies: sortByField((input.economies ?? []) as Record<string, unknown>[], "nationId"),
      constructions: sortById((input.constructions ?? []) as Record<string, unknown>[]),
      diplomacy: sortById((input.diplomacy ?? []) as Record<string, unknown>[]),
      research: sortByField((input.research ?? []) as Record<string, unknown>[], "nationId"),
      designs: sortByField((input.designs ?? []) as Record<string, unknown>[], "designId"),
      divisions: sortById((input.divisions ?? []) as Record<string, unknown>[]),
      events: sortById((input.events ?? []) as Record<string, unknown>[]),
      ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
      ...(input.ui !== undefined ? { ui: input.ui } : {}),
    };
  }
}
