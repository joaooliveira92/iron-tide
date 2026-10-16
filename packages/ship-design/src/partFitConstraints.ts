/**
 * The slot-constraint rules of fit validation (ship-part-model SPM-R3, SPM-R12 stage 2).
 * Every constraint key of `SlotConstraintsSchema` is evaluated here against the **resolved
 * spec** of the entry's part at the design month. A constraint the entry cannot answer
 * (a key that names a fact its family does not have) is a data issue, never a pass.
 *
 * Only the one waivable constraint, `diameterUmEqualsBore`, consults `legacyExceptions`,
 * and only on the parent launcher for exactly the child torpedo it names (SPM-R7, I-22).
 */
import type { FlattenedPart, NestedLoadoutEntry, SlotData } from "@bluewave/content-schema";
import { basisMultiplier } from "./partQuantities.js";
import { UM_PER_INCH } from "./units.js";
import type { FitAppliedWaiver, FitDetail } from "./partFitTypes.js";

export type ResolvedSpec = Readonly<Record<string, unknown>>;

/**
 * The part's spec at `month`: every revision up to it applied in flattened order. This
 * mirrors content-schema `resolvePartRevision`, which a runtime-free package may not import
 * (ship-design imports `@bluewave/content-schema` as types only).
 */
export function specAt(part: FlattenedPart, month: string): ResolvedSpec {
  let spec: Record<string, unknown> = { ...part.spec };
  for (const revision of part.revisions) {
    if (revision.from > month) break;
    spec = { ...spec, ...revision.spec };
  }
  return spec;
}

function num(spec: ResolvedSpec, key: string): number | undefined {
  const value = spec[key];
  return typeof value === "number" ? value : undefined;
}

function text(spec: ResolvedSpec, key: string): string | undefined {
  const value = spec[key];
  return typeof value === "string" ? value : undefined;
}

/** What a constraint check emits; the traversal turns these into findings and data issues. */
export type ConstraintOutcome =
  | { readonly kind: "VIOLATED"; readonly constraint: string; readonly detail: FitDetail }
  | { readonly kind: "UNEVALUABLE"; readonly constraint: string; readonly detail: FitDetail }
  | { readonly kind: "WAIVED"; readonly waiver: Omit<FitAppliedWaiver, "path"> };

/** A resolved part with its spec at the design month. */
export interface ResolvedFitPart {
  readonly part: FlattenedPart;
  readonly spec: ResolvedSpec;
}

export interface ConstraintInput {
  readonly slot: SlotData;
  readonly subject: ResolvedFitPart;
  readonly mountCount: number;
  /** The entry's parent part when it fills one of that part's own slots. */
  readonly parent: ResolvedFitPart | null;
  /** The entry's nested `guns` children (for a gun mount's calibre), already resolved. */
  readonly nestedGuns: readonly ResolvedFitPart[];
}

/** Contained units per installed unit: a gun mount's `gunsPerMount`, otherwise one. */
function containedPerUnit(subject: ResolvedFitPart): number {
  return subject.part.family === "gun_mount" ? (num(subject.spec, "gunsPerMount") ?? 1) : 1;
}

/** The mass of the entry's own part: each component at its basis multiplier (SPM-R13). */
export function entryMassKg(subject: ResolvedFitPart, mountCount: number): number {
  const per = containedPerUnit(subject);
  return subject.part.quantities
    .filter((q) => q.kind === "massKg")
    .reduce((sum, q) => sum + q.value * basisMultiplier(q.basis, mountCount, per), 0);
}

function rangeOutcome(
  constraint: string,
  value: number,
  min: number | undefined,
  max: number | undefined,
): ConstraintOutcome | null {
  if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
    return {
      kind: "VIOLATED",
      constraint,
      detail: { value, min: min ?? null, max: max ?? null },
    };
  }
  return null;
}

/** Evaluate every constraint the slot declares; outcomes are in the closed key order. */
export function evaluateConstraints(input: ConstraintInput): readonly ConstraintOutcome[] {
  const c = input.slot.constraints;
  if (c === undefined) return [];
  const { subject } = input;
  const out: ConstraintOutcome[] = [];
  const unevaluable = (constraint: string, why: string) =>
    out.push({ kind: "UNEVALUABLE", constraint, detail: { reason: why } });
  const push = (o: ConstraintOutcome | null) => {
    if (o !== null) out.push(o);
  };

  if (c.calibreInchesMin !== undefined || c.calibreInchesMax !== undefined) {
    const calibres =
      subject.part.family === "gun"
        ? [num(subject.spec, "calibreUm")]
        : subject.part.family === "gun_mount"
          ? input.nestedGuns.map((g) => num(g.spec, "calibreUm"))
          : [];
    const known = calibres.filter((v): v is number => v !== undefined);
    if (known.length === 0 || known.length !== calibres.length) {
      unevaluable(
        "calibreInches",
        subject.part.family === "gun" || subject.part.family === "gun_mount"
          ? "no gun calibre is known for the entry"
          : "the part is not a gun or gun mount",
      );
    } else {
      const min = c.calibreInchesMin === undefined ? undefined : c.calibreInchesMin * UM_PER_INCH;
      const max = c.calibreInchesMax === undefined ? undefined : c.calibreInchesMax * UM_PER_INCH;
      for (const calibre of [...new Set(known)].sort((a, b) => a - b)) {
        push(rangeOutcome("calibreInches", calibre, min, max));
      }
    }
  }

  if (c.mountTypes !== undefined) {
    const mountType = text(subject.spec, "mountType");
    if (subject.part.family !== "gun_mount" || mountType === undefined) {
      unevaluable("mountTypes", "the part is not a gun mount");
    } else if (!c.mountTypes.some((t) => t === mountType)) {
      out.push({
        kind: "VIOLATED",
        constraint: "mountTypes",
        detail: { value: mountType, allowed: [...c.mountTypes] },
      });
    }
  }

  if (c.gunsPerMount !== undefined) {
    const guns = num(subject.spec, "gunsPerMount");
    if (subject.part.family !== "gun_mount" || guns === undefined) {
      unevaluable("gunsPerMount", "the part is not a gun mount");
    } else if (!c.gunsPerMount.includes(guns)) {
      out.push({
        kind: "VIOLATED",
        constraint: "gunsPerMount",
        detail: { value: guns, allowed: c.gunsPerMount.map(String) },
      });
    }
  }

  if (c.diameterUmMin !== undefined || c.diameterUmMax !== undefined) {
    const diameter = num(subject.spec, "diameterUm");
    if (subject.part.family !== "torpedo" || diameter === undefined) {
      unevaluable("diameterUm", "the part is not a torpedo");
    } else {
      push(rangeOutcome("diameterUm", diameter, c.diameterUmMin, c.diameterUmMax));
    }
  }

  if (c.diameterUmEqualsBore === true) {
    const diameter = num(subject.spec, "diameterUm");
    const bore = input.parent === null ? undefined : num(input.parent.spec, "boreDiameterUm");
    if (subject.part.family !== "torpedo" || diameter === undefined) {
      unevaluable("diameterUmEqualsBore", "the part is not a torpedo");
    } else if (input.parent === null || bore === undefined) {
      unevaluable("diameterUmEqualsBore", "the slot's parent part declares no bore");
    } else if (diameter !== bore) {
      const waiver =
        input.parent.part.family === "torpedo_launcher"
          ? input.parent.part.legacyExceptions?.find(
              (e) =>
                e.code === "DQ-TORPEDO-001" &&
                e.waives === "diameterUmEqualsBore" &&
                e.forPart === subject.part.id,
            )
          : undefined;
      if (waiver !== undefined) {
        out.push({
          kind: "WAIVED",
          waiver: {
            launcher: input.parent.part.id,
            torpedo: subject.part.id,
            code: waiver.code,
            waives: waiver.waives,
            boreDiameterUm: bore,
            torpedoDiameterUm: diameter,
          },
        });
      } else {
        out.push({
          kind: "VIOLATED",
          constraint: "diameterUmEqualsBore",
          detail: {
            boreDiameterUm: bore,
            torpedoDiameterUm: diameter,
            launcher: input.parent.part.id,
          },
        });
      }
    }
  }

  if (c.launchTypes !== undefined) {
    const launchType = text(subject.spec, "launchType");
    if (subject.part.family !== "torpedo_launcher" || launchType === undefined) {
      unevaluable("launchTypes", "the part is not a torpedo launcher");
    } else if (!c.launchTypes.some((t) => t === launchType)) {
      out.push({
        kind: "VIOLATED",
        constraint: "launchTypes",
        detail: { value: launchType, allowed: [...c.launchTypes] },
      });
    }
  }

  if (c.massKgMax !== undefined) {
    const mass = entryMassKg(subject, input.mountCount);
    if (mass > c.massKgMax) {
      out.push({
        kind: "VIOLATED",
        constraint: "massKgMax",
        detail: { value: mass, max: c.massKgMax },
      });
    }
  }
  return out;
}

/** The nested `guns` children of an entry, for the calibre of a gun mount. */
export function gunChildren(entry: NestedLoadoutEntry): readonly NestedLoadoutEntry[] {
  return entry.entries?.["guns"] ?? [];
}
