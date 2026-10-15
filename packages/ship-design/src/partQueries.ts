/**
 * Pure part queries for agents and the designer (ship-part-model SPM-R15, ticket 07).
 *
 * Every query reads a `PartCatalogue` (flattened parts, slot templates, platforms) and
 * returns plain, codepoint-ordered data: no I/O, no clock, no hidden state. A new part is
 * found by every slot whose interface and constraints it satisfies; there is no
 * compatibility list to maintain (story 2).
 *
 * - `resolvePart`: a part at a month, its revision applied;
 * - `availableParts`: what is fittable at a month, and what changed in it;
 * - `partsForSlot`: every part a slot accepts;
 * - `lineage`: supersession ancestry and successors;
 * - `validateLoadout`: `validateLoadoutFit` with the unlocked-technology input;
 * - `loadoutCost`: each quantity component's value, basis, multiplier and contribution.
 *
 * A malformed `month` is a caller error and throws (an invariant break); expected
 * outcomes (unknown ids, unknown slots) are data in the result.
 */
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
import { validateLoadoutFit, type FitInput } from "./partFit.js";
import { evaluateConstraints, specAt, type ResolvedSpec } from "./partFitConstraints.js";
import type { FitDataIssue, FitNationInput, FitResult } from "./partFitTypes.js";
import { isMonth, lifecycleStatus, shiftMonth, type LifecycleStatus } from "./partLifecycle.js";
import { quantityLines, type QuantityLine } from "./partQuantities.js";

/** The catalogue every query reads. */
export interface PartCatalogue {
  readonly parts: readonly FlattenedPart[];
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
}

function assertMonth(month: string, query: string): void {
  if (!isMonth(month)) throw new Error(`partQueries.${query}: '${month}' is not a YYYY-MM month`);
}

const byId = (a: { readonly id: string }, b: { readonly id: string }): number =>
  compareCodePoints(a.id, b.id);

function findPart(catalogue: PartCatalogue, id: string): FlattenedPart | undefined {
  return catalogue.parts.find((p) => p.id === id);
}

/** The revision in force at `month`: the last `from` not after it, or `"base"`. */
export function revisionAt(part: FlattenedPart, month: string): string {
  let revision = "base";
  for (const r of part.revisions) {
    if (r.from > month) break;
    revision = r.from;
  }
  return revision;
}

// resolvePart

export interface ResolvedPart {
  readonly id: string;
  readonly family: FlattenedPart["family"];
  readonly provides: FlattenedPart["provides"];
  readonly month: string;
  /** The `from` of the last revision applied, or `"base"`. */
  readonly revision: string;
  readonly spec: ResolvedSpec;
  readonly status: LifecycleStatus;
  /** The parts whose lifecycle `supersedes` this one, id-ordered. */
  readonly supersededBy: readonly string[];
}

/** A part at a month with its revision applied; `null` when the id is not in the catalogue. */
export function resolvePart(
  catalogue: PartCatalogue,
  id: string,
  month: string,
): ResolvedPart | null {
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

function successorsOf(catalogue: PartCatalogue, id: string): string[] {
  return catalogue.parts
    .filter((p) => p.lifecycle.supersedes?.includes(id) === true)
    .map((p) => p.id)
    .sort(compareCodePoints);
}

// availableParts

export interface AvailablePartsInput {
  readonly catalogue: PartCatalogue;
  /** `YYYY-MM`. */
  readonly month: string;
  /** National access, as for fit validation (a part's own `nation`, denials, calibre cap). */
  readonly nation?: FitNationInput;
  /**
   * Technology ids unlocked at `month`. When absent, technology prerequisites are not
   * evaluated (the part model holds no unlock history).
   */
  readonly unlockedTechnologies?: readonly string[];
  /** Technology ids unlocked in the previous month; defaults to `unlockedTechnologies`. */
  readonly previouslyUnlockedTechnologies?: readonly string[];
}

export type PartChangeKind = "INTRODUCED" | "REVISED" | "RETIRED";

export interface PartChange {
  readonly part: string;
  readonly kind: PartChangeKind;
  /** The month the change takes effect (always the query month). */
  readonly month: string;
}

export interface AvailableParts {
  readonly month: string;
  /** Fittable parts at `month`, id-ordered. */
  readonly available: readonly string[];
  /** Fittable at `month` and not fittable the month before, id-ordered. */
  readonly newlyFittable: readonly string[];
  /** Lifecycle starts, re-ratings and retirements taking effect in `month`. */
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

/** What is fittable at a month for a nation, and what changed in that month (stories 17, 18). */
export function availableParts(input: AvailablePartsInput): AvailableParts {
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

// partsForSlot

export type SlotOwner = { readonly platform: string } | { readonly part: string };

export interface PartsForSlotInput {
  readonly catalogue: PartCatalogue;
  /** The platform, or the part, that declares the slot. */
  readonly owner: SlotOwner;
  readonly slot: string;
  /** The month whose revisions the constraints are evaluated against. */
  readonly month: string;
}

export interface UndecidedPart {
  readonly part: string;
  /** The constraint that names a fact the candidate (alone) cannot answer. */
  readonly constraints: readonly string[];
}

export interface PartsForSlot {
  readonly status: "OK" | "UNKNOWN_OWNER" | "UNKNOWN_SLOT";
  readonly slot: string;
  /** Parts whose interface and every evaluable constraint the slot accepts, id-ordered. */
  readonly parts: readonly string[];
  /**
   * Parts the slot's interface accepts but whose constraints need facts a lone part lacks
   * (a mount's calibre needs its guns). They are neither accepted nor rejected here.
   */
  readonly undecided: readonly UndecidedPart[];
}

function resolveOwnSlot(slots: readonly SlotData[], id: string): SlotData | undefined {
  const slot = slots.find((s) => s.id === id);
  if (slot?.mirrors === undefined) return slot;
  const sibling = slots.find((s) => s.id === slot.mirrors && s.mirrors === undefined);
  return sibling === undefined ? undefined : { ...sibling, id };
}

/**
 * Every part a slot accepts, by interface and constraints only. Lifecycle, nation and
 * technology are `availableParts` concerns; combine the two lists to get "fits and is
 * fittable". `massKgMax` is evaluated for one installed unit.
 */
export function partsForSlot(input: PartsForSlotInput): PartsForSlot {
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

// lineage

export interface PartLineage {
  readonly part: string;
  /** The prototype a variant extends (its flatten origin). */
  readonly prototype: string | null;
  /** Parts that extend this one, id-ordered. */
  readonly variants: readonly string[];
  /** Direct supersession: parts this one succeeds / parts that succeed it. */
  readonly supersedes: readonly string[];
  readonly supersededBy: readonly string[];
  /** Transitive supersession, nearest first within each generation, never repeating a part. */
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

/** A part's supersession ancestry and successors; `null` when the id is unknown. */
export function lineage(catalogue: PartCatalogue, id: string): PartLineage | null {
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

// validateLoadout

export interface ValidateLoadoutInput {
  readonly catalogue: PartCatalogue;
  readonly loadout: LoadoutData;
  readonly month: string;
  readonly nation?: FitNationInput;
  /** Unlocked technology ids; a part requiring others is `FIT_TECHNOLOGY_LOCKED`. */
  readonly unlockedTechnologies?: readonly string[];
  readonly ammunitionCompatibility?: FitInput["ammunitionCompatibility"];
  readonly mountCountRanges?: FitInput["mountCountRanges"];
}

/** The fit findings of a loadout (SPM-R12): `validateLoadoutFit` over a catalogue. */
export function validateLoadout(input: ValidateLoadoutInput): FitResult {
  const { catalogue } = input;
  return validateLoadoutFit({
    parts: catalogue.parts,
    slotTemplates: catalogue.slotTemplates,
    platforms: catalogue.platforms,
    loadout: input.loadout,
    month: input.month,
    ...(input.nation === undefined ? {} : { nation: input.nation }),
    ...(input.unlockedTechnologies === undefined
      ? {}
      : { unlockedTechnologies: input.unlockedTechnologies }),
    ...(input.ammunitionCompatibility === undefined
      ? {}
      : { ammunitionCompatibility: input.ammunitionCompatibility }),
    ...(input.mountCountRanges === undefined ? {} : { mountCountRanges: input.mountCountRanges }),
  });
}

// loadoutCost

export interface CostLine extends QuantityLine {
  /** `entries/<slot>/<part>#<n>[/entries/…]`, the same address fit findings use. */
  readonly path: string;
  /** The revision of the part applied at the query month. */
  readonly revision: string;
  /** Installed units of the part: nested entries multiply by their parent's units (SPM-R13). */
  readonly units: number;
}

export interface LoadoutCost {
  readonly month: string;
  readonly lines: readonly CostLine[];
  /** Sum of contributions per quantity kind, kind-ordered; kinds with no line are absent. */
  readonly totals: Readonly<Partial<Record<QuantityKind, number>>>;
  readonly dataIssues: readonly FitDataIssue[];
}

/**
 * The quantity components of every entry in a loadout, each with its value, basis,
 * multiplier and contribution (SPM-R13). Cost is computed from the loadout as given: run
 * `validateLoadout` first to know whether it fits. An entry naming an unknown part is a
 * data issue and contributes nothing.
 */
export function loadoutCost(input: {
  readonly catalogue: PartCatalogue;
  readonly loadout: LoadoutData;
  readonly month: string;
}): LoadoutCost {
  const { catalogue, loadout, month } = input;
  assertMonth(month, "loadoutCost");
  const lines: CostLine[] = [];
  const dataIssues: FitDataIssue[] = [];

  /** Entries per slot in the canonical order fit validation uses, so `#n` is stable. */
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
