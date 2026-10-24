import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import type {
  FlattenedPart,
  LoadoutData,
  NestedLoadoutEntry,
  PlatformData,
  QuantityKind,
  SlotData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import { platformSlots, type CompatibilityModel } from "./partCompatibility.js";
import { validateLoadoutFit, type FitCatalogue, type FitConditions } from "./partFit.js";
import { evaluateConstraints, specAt, type ResolvedSpec } from "./partFitConstraints.js";
import type { FitDataIssue, FitNationInput, FitResult } from "./partFitTypes.js";
import { isMonth, lifecycleStatus, shiftMonth, type LifecycleStatus } from "./partLifecycle.js";
import { quantityLines, type QuantityLine } from "./partQuantities.js";
import { designInvariant } from "./errors.js";

type CatalogueData = FitCatalogue;

function assertMonth(month: string, query: string): void {
  if (!isMonth(month))
    throw designInvariant(`partQueries.${query}: '${month}' is not a YYYY-MM month`);
}

const byId = (a: { readonly id: string }, b: { readonly id: string }): number =>
  compareCodePoints(a.id, b.id);

function findPart(catalogue: CatalogueData, id: string): FlattenedPart | undefined {
  return catalogue.parts.find((p) => p.id === id);
}

export function revisionAt(part: FlattenedPart, month: string): string {
  let revision = "base";
  for (const r of part.revisions) {
    if (r.from > month) break;
    revision = r.from;
  }
  return revision;
}

export interface ResolvedPart {
  readonly id: string;
  readonly family: FlattenedPart["family"];
  readonly provides: FlattenedPart["provides"];
  readonly month: string;
  readonly revision: string;
  readonly spec: ResolvedSpec;
  readonly status: LifecycleStatus;
  readonly supersededBy: readonly string[];
}

function resolvePart(catalogue: CatalogueData, id: string, month: string): ResolvedPart | null {
  assertMonth(month, "resolvePart");
  const part = findPart(catalogue, id);
  if (part === undefined) return null;
  return {
    id: part.id,
    family: part.family,
    provides: part.provides,
    month,
    revision: revisionAt(part, month),
    spec: specAt(part, month),
    status: lifecycleStatus(part.lifecycle, month),
    supersededBy: successorsOf(catalogue, part.id),
  };
}

function successorsOf(catalogue: CatalogueData, id: string): string[] {
  return catalogue.parts
    .filter((p) => p.lifecycle.supersedes?.includes(id) === true)
    .map((p) => p.id)
    .sort(compareCodePoints);
}

interface AvailablePartsInput {
  readonly catalogue: CatalogueData;
  readonly month: string;
  readonly nation?: FitNationInput;
  readonly unlockedTechnologies?: readonly string[];
  readonly previouslyUnlockedTechnologies?: readonly string[];
}

export type PartChangeKind = "INTRODUCED" | "REVISED" | "RETIRED";

export interface PartChange {
  readonly part: string;
  readonly kind: PartChangeKind;
  readonly month: string;
}

export interface AvailableParts {
  readonly month: string;
  readonly available: readonly string[];
  readonly newlyFittable: readonly string[];
  readonly changes: readonly PartChange[];
}

function nationAllows(
  part: FlattenedPart,
  spec: ResolvedSpec,
  nation: FitNationInput | undefined,
): boolean {
  if (nation === undefined) return true;
  if (part.nation !== undefined && part.nation !== nation.nationId) return false;
  if (nation.deniedParts?.includes(part.id) === true) return false;
  const calibre = part.family === "gun" ? spec["calibreUm"] : undefined;
  return !(
    nation.maxGunCalibreUm !== undefined &&
    typeof calibre === "number" &&
    calibre > nation.maxGunCalibreUm
  );
}

function fittable(
  part: FlattenedPart,
  month: string,
  nation: FitNationInput | undefined,
  unlocked: ReadonlySet<string> | undefined,
): boolean {
  if (lifecycleStatus(part.lifecycle, month) !== "AVAILABLE") return false;
  if (!nationAllows(part, specAt(part, month), nation)) return false;
  return unlocked === undefined || (part.lifecycle.requires ?? []).every((t) => unlocked.has(t));
}

function availableParts(input: AvailablePartsInput): AvailableParts {
  const { catalogue, month, nation } = input;
  assertMonth(month, "availableParts");
  const unlocked = input.unlockedTechnologies && new Set(input.unlockedTechnologies);
  const before =
    input.previouslyUnlockedTechnologies === undefined
      ? unlocked
      : new Set(input.previouslyUnlockedTechnologies);
  const previous = shiftMonth(month, -1);
  const parts = [...catalogue.parts].sort(byId);
  const available = parts.filter((p) => fittable(p, month, nation, unlocked));
  const newlyFittable = available.filter((p) => !fittable(p, previous, nation, before));
  const changes: PartChange[] = [];
  for (const part of parts) {
    if (!nationAllows(part, specAt(part, month), nation)) continue;
    const { availableFrom, availableUntil } = part.lifecycle;
    if (availableFrom === month) changes.push({ part: part.id, kind: "INTRODUCED", month });
    if (
      lifecycleStatus(part.lifecycle, month) === "AVAILABLE" &&
      part.revisions.some((r) => r.from === month)
    ) {
      changes.push({ part: part.id, kind: "REVISED", month });
    }
    if (availableUntil === month) changes.push({ part: part.id, kind: "RETIRED", month });
  }
  return {
    month,
    available: available.map((p) => p.id),
    newlyFittable: newlyFittable.map((p) => p.id),
    changes,
  };
}

export type SlotOwner = { readonly platform: string } | { readonly part: string };

interface PartsForSlotInput {
  readonly catalogue: CatalogueData;
  readonly owner: SlotOwner;
  readonly slot: string;
  readonly month: string;
}

export interface UndecidedPart {
  readonly part: string;
  readonly constraints: readonly string[];
}

export interface PartsForSlot {
  readonly status: "OK" | "UNKNOWN_OWNER" | "UNKNOWN_SLOT";
  readonly slot: string;
  readonly parts: readonly string[];
  readonly undecided: readonly UndecidedPart[];
}

function resolveOwnSlot(slots: readonly SlotData[], id: string): SlotData | undefined {
  const slot = slots.find((s) => s.id === id);
  if (slot?.mirrors === undefined) return slot;
  const sibling = slots.find((s) => s.id === slot.mirrors && s.mirrors === undefined);
  return sibling === undefined ? undefined : { ...sibling, id };
}

function partsForSlot(input: PartsForSlotInput): PartsForSlot {
  const { catalogue, owner, month } = input;
  assertMonth(month, "partsForSlot");
  let slots: readonly SlotData[];
  let parent: FlattenedPart | null = null;
  if ("platform" in owner) {
    const platform = catalogue.platforms.find((p) => p.id === owner.platform);
    if (platform === undefined) {
      return { status: "UNKNOWN_OWNER", slot: input.slot, parts: [], undecided: [] };
    }
    slots = [
      ...platform.slotTemplates.flatMap(
        (id) => catalogue.slotTemplates.find((t) => t.id === id)?.slots ?? [],
      ),
      ...(platform.slots ?? []),
    ];
  } else {
    parent = findPart(catalogue, owner.part) ?? null;
    if (parent === null) {
      return { status: "UNKNOWN_OWNER", slot: input.slot, parts: [], undecided: [] };
    }
    slots = parent.slots ?? [];
  }
  const slot = resolveOwnSlot(slots, input.slot);
  if (slot === undefined) {
    return { status: "UNKNOWN_SLOT", slot: input.slot, parts: [], undecided: [] };
  }
  const parentResolved = parent === null ? null : { part: parent, spec: specAt(parent, month) };
  const accepts = slot.accepts ?? [];
  const parts: string[] = [];
  const undecided: UndecidedPart[] = [];
  for (const candidate of [...catalogue.parts].sort(byId)) {
    if (!accepts.includes(candidate.provides)) continue;
    const outcomes = evaluateConstraints({
      slot,
      subject: { part: candidate, spec: specAt(candidate, month) },
      mountCount: 1,
      parent: parentResolved,
      nestedGuns: [],
    });
    if (outcomes.some((o) => o.kind === "VIOLATED")) continue;
    const open = outcomes.flatMap((o) => (o.kind === "UNEVALUABLE" ? [o.constraint] : []));
    if (open.length > 0) {
      undecided.push({
        part: candidate.id,
        constraints: [...new Set(open)].sort(compareCodePoints),
      });
    } else {
      parts.push(candidate.id);
    }
  }
  return { status: "OK", slot: input.slot, parts, undecided };
}

export interface PartLineage {
  readonly part: string;
  readonly prototype: string | null;
  readonly variants: readonly string[];
  readonly supersedes: readonly string[];
  readonly supersededBy: readonly string[];
  readonly ancestors: readonly string[];
  readonly successors: readonly string[];
}

function closure(start: readonly string[], next: (id: string) => readonly string[]): string[] {
  const seen = new Set<string>();
  let frontier = [...start].sort(compareCodePoints);
  const out: string[] = [];
  while (frontier.length > 0) {
    const following: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      following.push(...next(id));
    }
    frontier = [...new Set(following)].sort(compareCodePoints);
  }
  return out;
}

function lineage(catalogue: CatalogueData, id: string): PartLineage | null {
  const part = findPart(catalogue, id);
  if (part === undefined) return null;
  const supersedesOf = (p: string): readonly string[] =>
    [...(findPart(catalogue, p)?.lifecycle.supersedes ?? [])].sort(compareCodePoints);
  const supersedes = [...new Set(supersedesOf(id))];
  const supersededBy = successorsOf(catalogue, id);
  const ancestors = closure(supersedes, supersedesOf).filter((p) => p !== id);
  const successors = closure(supersededBy, (p) => successorsOf(catalogue, p)).filter(
    (p) => p !== id,
  );
  return {
    part: id,
    prototype: part.origin.prototype?.id ?? null,
    variants: catalogue.parts
      .filter((p) => p.origin.prototype?.id === id)
      .map((p) => p.id)
      .sort(compareCodePoints),
    supersedes,
    supersededBy,
    ancestors,
    successors,
  };
}

export interface CostLine extends QuantityLine {
  readonly path: string;
  readonly revision: string;
  readonly units: number;
}

export interface LoadoutCost {
  readonly month: string;
  readonly lines: readonly CostLine[];
  readonly totals: Readonly<Partial<Record<QuantityKind, number>>>;
  readonly dataIssues: readonly FitDataIssue[];
}

function loadoutCost(input: {
  readonly catalogue: CatalogueData;
  readonly loadout: LoadoutData;
  readonly month: string;
}): LoadoutCost {
  const { catalogue, loadout, month } = input;
  assertMonth(month, "loadoutCost");
  const lines: CostLine[] = [];
  const dataIssues: FitDataIssue[] = [];

  const visit = (
    bySlot: Readonly<Record<string, readonly NestedLoadoutEntry[]>>,
    basePath: string,
    parentUnits: number,
  ): void => {
    for (const slot of Object.keys(bySlot).sort(compareCodePoints)) {
      const ordered = (bySlot[slot] ?? [])
        .map((entry) => ({ entry, key: canonicalSerialize(entry) }))
        .sort(
          (x, y) =>
            compareCodePoints(x.entry.part, y.entry.part) || compareCodePoints(x.key, y.key),
        );
      const ordinals = new Map<string, number>();
      for (const { entry } of ordered) {
        const n = (ordinals.get(entry.part) ?? 0) + 1;
        ordinals.set(entry.part, n);
        const path = `${basePath}entries/${slot}/${entry.part}#${n}`;
        const part = findPart(catalogue, entry.part);
        if (part === undefined) {
          dataIssues.push({
            code: "FIT_DATA_UNKNOWN_PART",
            path,
            detail: { part: entry.part, slot },
            message: `Entry names part '${entry.part}', which is not in the part catalogue.`,
          });
          continue;
        }
        const units = parentUnits * (entry.mountCount ?? 1);
        const gunsPerMount = specAt(part, month)["gunsPerMount"];
        const contained =
          part.family === "gun_mount" && typeof gunsPerMount === "number" ? gunsPerMount : 1;
        const revision = revisionAt(part, month);
        const scope =
          part.family === "gun_mount" ? "mount" : part.family === "gun" ? "gun" : "fitting";
        for (const line of quantityLines(part.quantities, scope, part.id, units, contained)) {
          lines.push({ ...line, path, revision, units });
        }
        visit(entry.entries ?? {}, `${path}/`, units);
      }
    }
  };

  const topLevel: Record<string, NestedLoadoutEntry[]> = {};
  for (const entry of loadout.entries) (topLevel[entry.slot] ??= []).push(entry);
  visit(topLevel, "", 1);

  const sorted = lines.sort(
    (a, b) => compareCodePoints(a.path, b.path) || compareCodePoints(a.id, b.id),
  );
  const totals: Partial<Record<QuantityKind, number>> = {};
  for (const line of sorted) totals[line.kind] = (totals[line.kind] ?? 0) + line.contribution;
  const orderedTotals = Object.fromEntries(
    Object.entries(totals).sort(([a], [b]) => compareCodePoints(a, b)),
  );
  return {
    month,
    lines: sorted,
    totals: orderedTotals,
    dataIssues: dataIssues.sort((a, b) => compareCodePoints(a.path, b.path)),
  };
}

export interface PartCatalogue extends CatalogueData {
  readonly compatibility: CompatibilityModel;
  readonly partOf: (id: string) => FlattenedPart | undefined;
  readonly slotLookup: (platform: string) => (slotId: string) => SlotData | undefined;
  readonly resolve: (id: string, month: string) => ResolvedPart | null;
  readonly available: (input: Omit<AvailablePartsInput, "catalogue">) => AvailableParts;
  readonly forSlot: (input: Omit<PartsForSlotInput, "catalogue">) => PartsForSlot;
  readonly lineage: (id: string) => PartLineage | null;
  readonly validate: (input: {
    readonly loadout: LoadoutData;
    readonly month: string;
    readonly conditions?: FitConditions;
  }) => FitResult;
  readonly cost: (input: { readonly loadout: LoadoutData; readonly month: string }) => LoadoutCost;
}

export function partCatalogue(input: {
  readonly parts: readonly FlattenedPart[];
  readonly slotTemplates?: readonly SlotTemplateData[];
  readonly platforms?: readonly PlatformData[];
}): PartCatalogue {
  const data: CatalogueData = {
    parts: input.parts,
    slotTemplates: input.slotTemplates ?? [],
    platforms: input.platforms ?? [],
  };
  const compatibility: CompatibilityModel = {
    slotTemplates: data.slotTemplates,
    platforms: data.platforms,
  };
  const byPartId = new Map(data.parts.map((part) => [part.id, part] as const));
  return {
    ...data,
    compatibility,
    partOf: (id) => byPartId.get(id),
    slotLookup: (platform) => {
      const slots = platformSlots(compatibility, platform) ?? [];
      return (slotId) => slots.find((slot) => slot.id === slotId);
    },
    resolve: (id, month) => resolvePart(data, id, month),
    available: (query) => availableParts({ ...query, catalogue: data }),
    forSlot: (query) => partsForSlot({ ...query, catalogue: data }),
    lineage: (id) => lineage(data, id),
    validate: (query) => validateLoadoutFit({ ...query, catalogue: data }),
    cost: (query) => loadoutCost({ ...query, catalogue: data }),
  };
}
