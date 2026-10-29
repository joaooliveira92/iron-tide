import {
  FlattenedPartSchema,
  partVisualTraitViolations,
  validateAgainstSchema,
  type CompiledPartModel,
  type FlattenedPart,
  type PartData,
  type PartIndex,
  type PlatformData,
  type QuantityComponentData,
  type ShipTypeRecord,
  type SlotTemplateData,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

import type { CompilerStage } from "../index.js";
import { canonicalContentPath } from "../contentPath.js";
import type { PartModelSources, ValidateOutput } from "./validate.js";

export interface FlattenOutput extends ValidateOutput {
  partModel?: CompiledPartModel;
}

export class FlattenStage implements CompilerStage<ValidateOutput, FlattenOutput> {
  readonly name = "flatten";

  run(
    input: ValidateOutput,
    _signal: AbortSignal,
    collector: DiagnosticCollector,
  ): FlattenOutput | undefined {
    const { partModelSources: _sources, ...rest } = input;
    const parts = (input.parts ?? []) as readonly PartData[];
    const slotTemplates = (input.slotTemplates ?? []) as readonly SlotTemplateData[];
    const platforms = (input.platforms ?? []) as readonly PlatformData[];
    const shipTypes = (input.shipTypes ?? []) as readonly ShipTypeRecord[];
    if (
      parts.length === 0 &&
      slotTemplates.length === 0 &&
      platforms.length === 0 &&
      shipTypes.length === 0
    )
      return rest;

    const partModel = compilePartModel(
      { parts, slotTemplates, platforms, shipTypes },
      {
        hullFormIds: idSet(input.shipHullForms),
        technologyIds: idSet(input.technologies),
        sources: input.partModelSources ?? EMPTY_SOURCES,
      },
      collector,
    );
    if (partModel === undefined) return undefined;
    return { ...rest, partModel };
  }
}

const EMPTY_SOURCES: PartModelSources = {
  contentDir: "",
  parts: new Map(),
  slotTemplates: new Map(),
  platforms: new Map(),
  shipTypes: new Map(),
};

interface PartModelInput {
  readonly parts: readonly PartData[];
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
  readonly shipTypes: readonly ShipTypeRecord[];
}

interface PartModelContext {
  readonly hullFormIds: ReadonlySet<string>;
  readonly technologyIds: ReadonlySet<string>;
  readonly sources: PartModelSources;
}

export function compilePartModel(
  model: PartModelInput,
  context: PartModelContext,
  collector: DiagnosticCollector,
): CompiledPartModel | undefined {
  const report = reporter(context.sources, collector);
  const parts = [...model.parts].sort(compareById);
  const byId = new Map(parts.map((part) => [part.id, part]));

  checkPlatformReferences(model, context, report);
  checkPartReferences(parts, byId, context.technologyIds, report);
  checkPrototypes(parts, byId, report);
  checkRevisions(parts, report);
  checkSupersessionCycles(parts, byId, report);
  if (report.failed()) return undefined;

  const flattened: FlattenedPart[] = [];
  for (const part of parts) {
    const sourceFile = context.sources.parts.get(part.id) ?? "parts.ts";
    if (part.origin !== undefined) {
      const decoded = validateAgainstSchema(
        part,
        FlattenedPartSchema,
        `FlattenedPart '${part.id}'`,
        sourceFile,
        collector,
      );
      if (decoded !== undefined) flattened.push(decoded);
      continue;
    }
    const prototype = part.extends === undefined ? undefined : byId.get(part.extends);
    const prototypeFile =
      prototype === undefined ? undefined : (context.sources.parts.get(prototype.id) ?? sourceFile);
    const record = flattenPart(
      part,
      canonicalContentPath(context.sources.contentDir, sourceFile),
      prototype,
      prototypeFile === undefined
        ? undefined
        : canonicalContentPath(context.sources.contentDir, prototypeFile),
    );
    const decoded = validateAgainstSchema(
      record,
      FlattenedPartSchema,
      `FlattenedPart '${part.id}'`,
      sourceFile,
      collector,
    );
    if (decoded !== undefined) flattened.push(decoded);
  }
  if (collector.hasErrors) return undefined;

  for (const part of flattened) {
    for (const violation of partVisualTraitViolations(part)) {
      report(
        "VISUAL_TRAIT",
        "Part",
        part.id,
        "visual.traits",
        `${violation.rule}: ${violation.message}`,
        "Adjust the authored visual overrides or the part's mount type",
      );
    }
  }
  if (report.failed()) return undefined;

  const partIndex: PartIndex = {
    ...buildIndex(flattened, parts),
    shipTypes: [...model.shipTypes].sort(compareById),
  };
  return {
    partIndex,
    slotTemplates: [...model.slotTemplates].sort(compareById),
    platforms: [...model.platforms].sort(compareById),
  };
}

type RecordKind = "Part" | "Platform";

interface Reporter {
  (
    code: string,
    kind: RecordKind,
    id: string,
    path: string,
    message: string,
    remediation: string,
    related?: readonly string[],
  ): void;
  failed(): boolean;
}

function reporter(sources: PartModelSources, collector: DiagnosticCollector): Reporter {
  let failed = false;
  const files = {
    Part: { byId: sources.parts, fallback: "parts.ts" },
    Platform: { byId: sources.platforms, fallback: "platforms.ts" },
  } as const;
  const fileOf = (kind: RecordKind, id: string): string =>
    files[kind].byId.get(id) ?? files[kind].fallback;
  const report = (
    code: string,
    kind: RecordKind,
    id: string,
    path: string,
    message: string,
    remediation: string,
    related: readonly string[] = [],
  ): void => {
    failed = true;
    collector.addError(code, `${kind} '${id}'.${path}: ${message}`, {
      stage: "flatten",
      sourceLocation: { path: fileOf(kind, id), line: 1 },
      entityId: id,
      ...(related.length > 0
        ? { relatedLocations: related.map((other) => ({ path: fileOf(kind, other), line: 1 })) }
        : {}),
      remediation,
    });
  };
  return Object.assign(report, { failed: () => failed });
}

function checkPlatformReferences(
  model: PartModelInput,
  context: PartModelContext,
  report: Reporter,
): void {
  const templateIds = new Set(model.slotTemplates.map((template) => template.id));
  const platforms = [...model.platforms].sort(compareById);
  for (const platform of platforms) {
    if (!context.hullFormIds.has(platform.hullForm)) {
      report(
        "REF",
        "Platform",
        platform.id,
        "hullForm",
        `unknown hull form '${platform.hullForm}'`,
        "Name a hull form declared in the pack's hull forms",
      );
    }
    platform.slotTemplates.forEach((templateId, index) => {
      if (!templateIds.has(templateId)) {
        report(
          "REF",
          "Platform",
          platform.id,
          `slotTemplates.${index}`,
          `unknown slot template '${templateId}'`,
          "Name a slot template declared in the pack's slot templates",
        );
      }
    });
  }
}

function checkPartReferences(
  parts: readonly PartData[],
  byId: ReadonlyMap<string, PartData>,
  technologyIds: ReadonlySet<string>,
  report: Reporter,
): void {
  const unknownPart = (part: PartData, path: string, target: string): void =>
    report(
      "REF",
      "Part",
      part.id,
      path,
      `unknown part '${target}'`,
      "Name a part declared in the pack's parts",
    );
  const unknownTechnology = (part: PartData, path: string, target: string): void =>
    report(
      "REF",
      "Part",
      part.id,
      path,
      `unknown technology '${target}'`,
      "Name a technology declared in the pack's technologies",
    );

  const hasTorpedoParts = parts.some((part) => part.family === "torpedo");

  for (const part of parts) {
    if (part.extends !== undefined && !byId.has(part.extends)) {
      unknownPart(part, "extends", part.extends);
    }
    (part.lifecycle.supersedes ?? []).forEach((target, index) => {
      if (!byId.has(target)) unknownPart(part, `lifecycle.supersedes.${index}`, target);
    });
    if (hasTorpedoParts) {
      (part.legacyExceptions ?? []).forEach((exception, index) => {
        if (!byId.has(exception.forPart)) {
          unknownPart(part, `legacyExceptions.${index}.forPart`, exception.forPart);
        }
      });
    }
    (part.lifecycle.requires ?? []).forEach((techId, index) => {
      if (!technologyIds.has(techId)) {
        unknownTechnology(part, `lifecycle.requires.${index}`, techId);
      }
    });
    (part.revisions ?? []).forEach((revision, revisionIndex) => {
      (revision.requires ?? []).forEach((techId, index) => {
        if (!technologyIds.has(techId)) {
          unknownTechnology(part, `revisions.${revisionIndex}.requires.${index}`, techId);
        }
      });
    });
  }
}

function checkPrototypes(
  parts: readonly PartData[],
  byId: ReadonlyMap<string, PartData>,
  report: Reporter,
): void {
  const inCycle = new Set<string>();
  for (const part of parts) {
    if (inCycle.has(part.id)) continue;
    const chain: string[] = [];
    let current: PartData | undefined = part;
    while (current !== undefined && !chain.includes(current.id)) {
      chain.push(current.id);
      current = current.extends === undefined ? undefined : byId.get(current.extends);
    }
    if (current === undefined || current.id !== part.id) continue;
    for (const id of chain) inCycle.add(id);
    report(
      "PART_EXTENDS_CYCLE",
      "Part",
      part.id,
      "extends",
      `prototype cycle: ${[...chain, part.id].join(" -> ")}`,
      `Break the prototype cycle among: ${chain.join(", ")}`,
      chain.slice(1),
    );
  }

  for (const part of parts) {
    if (part.extends === undefined || inCycle.has(part.id)) continue;
    const prototype = byId.get(part.extends);
    if (prototype === undefined || inCycle.has(prototype.id)) continue;
    if (prototype.extends !== undefined) {
      report(
        "PART_EXTENDS_DEPTH",
        "Part",
        part.id,
        "extends",
        `prototype '${prototype.id}' is itself a variant of '${prototype.extends}'; inheritance is one level deep`,
        `Extend '${prototype.extends}' directly, or make '${prototype.id}' a standalone part`,
        [prototype.id],
      );
      continue;
    }
    checkVariant(part, prototype, report);
  }
}

function checkVariant(part: PartData, prototype: PartData, report: Reporter): void {
  if (part.family !== prototype.family) {
    report(
      "PART_EXTENDS_FAMILY",
      "Part",
      part.id,
      "family",
      `'${part.family}' differs from prototype '${prototype.id}' family '${prototype.family}'`,
      "A variant extends a part of its own family",
      [prototype.id],
    );
    return;
  }
  if (part.provides !== prototype.provides) {
    report(
      "PART_VARIANT_INTERFACE",
      "Part",
      part.id,
      "provides",
      `'${part.provides}' differs from prototype '${prototype.id}' interface '${prototype.provides}'`,
      "A variant provides its prototype's interface",
      [prototype.id],
    );
  }
  for (const field of [
    "slots",
    "parameters",
    "visual",
    "entryUnits",
    "engineering",
    "capabilities",
  ] as const) {
    if (part[field] !== undefined) {
      report(
        "PART_VARIANT_FIELD",
        "Part",
        part.id,
        field,
        `a variant inherits '${field}' from prototype '${prototype.id}' and may not redefine it`,
        `Remove '${field}' from the variant, or make it a standalone part`,
        [prototype.id],
      );
    }
  }
  const inherited = new Map((prototype.quantities ?? []).map((q) => [q.id, q]));
  (part.quantities ?? []).forEach((quantity, index) => {
    const base = inherited.get(quantity.id);
    if (base === undefined) {
      report(
        "PART_VARIANT_QUANTITY",
        "Part",
        part.id,
        `quantities.${index}.id`,
        `prototype '${prototype.id}' has no quantity component '${quantity.id}'`,
        "A variant overrides the value of an inherited component; it adds none",
        [prototype.id],
      );
      return;
    }
    if (quantity.kind !== base.kind) {
      report(
        "PART_VARIANT_KIND",
        "Part",
        part.id,
        `quantities.${index}.kind`,
        `'${quantity.kind}' differs from prototype '${prototype.id}' kind '${base.kind}'`,
        "A variant overrides a component's value only",
        [prototype.id],
      );
    }
    if (quantity.basis !== base.basis) {
      report(
        "PART_VARIANT_BASIS",
        "Part",
        part.id,
        `quantities.${index}.basis`,
        `'${quantity.basis}' differs from prototype '${prototype.id}' basis '${base.basis}'`,
        "A variant overrides a component's value only",
        [prototype.id],
      );
    }
  });
}

function checkRevisions(parts: readonly PartData[], report: Reporter): void {
  for (const part of parts) {
    const seen = new Map<string, number>();
    (part.revisions ?? []).forEach((revision, index) => {
      const first = seen.get(revision.from);
      if (first !== undefined) {
        report(
          "PART_REVISION_DUPLICATE",
          "Part",
          part.id,
          `revisions.${index}.from`,
          `duplicates revisions.${first}.from '${revision.from}'`,
          "Give each revision of a part its own month, or merge the two deltas",
        );
        return;
      }
      seen.set(revision.from, index);
    });
  }
}

function checkSupersessionCycles(
  parts: readonly PartData[],
  byId: ReadonlyMap<string, PartData>,
  report: Reporter,
): void {
  const state = new Map<string, "active" | "done">();
  const stack: string[] = [];
  const visit = (id: string): void => {
    state.set(id, "active");
    stack.push(id);
    const edges = [...(byId.get(id)?.lifecycle.supersedes ?? [])]
      .filter((target) => byId.has(target))
      .sort(compareCodePoints);
    for (const target of edges) {
      const seen = state.get(target);
      if (seen === "active") {
        const cycle = stack.slice(stack.indexOf(target));
        report(
          "PART_SUPERSEDES_CYCLE",
          "Part",
          cycle[0]!,
          "lifecycle.supersedes",
          `supersession cycle: ${[...cycle, target].join(" -> ")}`,
          `Break the supersession cycle among: ${cycle.join(", ")}`,
          cycle.slice(1),
        );
      } else if (seen === undefined) {
        visit(target);
      }
    }
    stack.pop();
    state.set(id, "done");
  };
  for (const part of parts) {
    if (!state.has(part.id)) visit(part.id);
  }
}

function flattenPart(
  part: PartData,
  sourceFile: string,
  prototype: PartData | undefined,
  prototypeFile: string | undefined,
): Record<string, unknown> {
  const { extends: _extends, revisions, quantities, ...own } = part;
  const sortedRevisions = (revisions ?? [])
    .map((revision, index) => ({ revision, index }))
    .sort((a, b) => compareCodePoints(a.revision.from, b.revision.from) || a.index - b.index)
    .map(({ revision }) => revision);

  if (prototype === undefined || prototypeFile === undefined) {
    return {
      ...own,
      quantities: quantities ?? [],
      revisions: sortedRevisions,
      origin: { sourceFile },
    };
  }

  const overrides = new Map((quantities ?? []).map((q) => [q.id, q.value]));
  const mergedQuantities: QuantityComponentData[] = (prototype.quantities ?? []).map((q) => {
    const value = overrides.get(q.id);
    return value === undefined ? q : { ...q, value };
  });
  const inheritedSpec = Object.keys(prototype.spec)
    .filter((key) => !Object.hasOwn(part.spec, key))
    .sort(compareCodePoints);
  const inheritedQuantities = (prototype.quantities ?? [])
    .map((q) => q.id)
    .filter((id) => !overrides.has(id))
    .sort(compareCodePoints);

  return {
    ...own,
    spec: { ...prototype.spec, ...part.spec },
    quantities: mergedQuantities,
    ...(prototype.slots !== undefined ? { slots: prototype.slots } : {}),
    ...(prototype.parameters !== undefined ? { parameters: prototype.parameters } : {}),
    ...(prototype.visual !== undefined ? { visual: prototype.visual } : {}),
    ...(prototype.entryUnits !== undefined ? { entryUnits: prototype.entryUnits } : {}),
    ...(prototype.engineering !== undefined ? { engineering: prototype.engineering } : {}),
    ...(prototype.capabilities !== undefined ? { capabilities: prototype.capabilities } : {}),
    revisions: sortedRevisions,
    origin: {
      sourceFile,
      prototype: {
        id: prototype.id,
        sourceFile: prototypeFile,
        inheritedSpec,
        inheritedQuantities,
      },
    },
  };
}

function buildIndex(
  flattened: readonly FlattenedPart[],
  authored: readonly PartData[],
): Omit<PartIndex, "shipTypes"> {
  const byId: Record<string, FlattenedPart> = {};
  const byInterface: Record<string, string[]> = {};
  const byFamily: Record<string, string[]> = {};
  for (const part of flattened) {
    byId[part.id] = part;
    (byInterface[part.provides] ??= []).push(part.id);
    (byFamily[part.family] ??= []).push(part.id);
  }

  const variants = new Map<string, string[]>();
  const supersededBy = new Map<string, string[]>();
  for (const part of authored) {
    const prototypeId = part.extends ?? part.origin?.prototype?.id;
    if (prototypeId !== undefined) push(variants, prototypeId, part.id);
    for (const target of part.lifecycle.supersedes ?? []) push(supersededBy, target, part.id);
  }
  const lineage: Record<string, CompiledPartModel["partIndex"]["lineage"][string]> = {};
  for (const part of authored) {
    const prototypeId = part.extends ?? part.origin?.prototype?.id;
    lineage[part.id] = {
      ...(prototypeId !== undefined ? { prototype: prototypeId } : {}),
      variants: sortedIds(variants.get(part.id)),
      supersedes: sortedIds(part.lifecycle.supersedes),
      supersededBy: sortedIds(supersededBy.get(part.id)),
    };
  }
  return { byId, byInterface, byFamily, lineage };
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function sortedIds(ids: readonly string[] | undefined): string[] {
  return [...new Set(ids ?? [])].sort(compareCodePoints);
}

function compareById(a: { readonly id: string }, b: { readonly id: string }): number {
  return compareCodePoints(a.id, b.id);
}

function idSet(items: readonly unknown[] | undefined): Set<string> {
  const ids = new Set<string>();
  for (const item of items ?? []) {
    const id = (item as Record<string, unknown>)["id"];
    if (typeof id === "string") ids.add(id);
  }
  return ids;
}
