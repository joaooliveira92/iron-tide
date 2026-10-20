import type { CompiledDesign, DesignDraft } from "./compileShared.js";
import type { DraftEdit } from "./edits.js";
import type { Finding } from "./findings.js";
import type { ComponentCategory } from "./component.js";

export type ChangeKind = "FITTINGS" | "MAIN_ARMAMENT" | "ARMOUR" | "MACHINERY" | "STRUCTURE";
export type RevisionTier = "T0_FREE" | "T1_REVISION" | "T2_REDESIGN" | "T3_RECONSTRUCTION";

export interface RevisionBalance {
  /** Hull progress thresholds, bp of total hull work. */
  readonly freeBelowBp: number;
  readonly revisionBelowBp: number;
  readonly redesignBelowBp: number;
  /** T1: rework work = bp of work already done on the affected packages. */
  readonly reworkBp: number;
  readonly t1DelayMonths: number;
  /** T2: study cost multiplier, hull progress kept, delay. */
  readonly redesignStudyCostBp: number;
  readonly redesignKeptBp: number;
  readonly t2DelayMonths: number;
  /**
   * The manual's in-place design-revision limits (printed p27; ADR-0132): the largest change that may still be made as a
   * revision before it must become a redesign or a rebuild. Distinct from the retained-hull rebuild limits (DESIGN-23 §21).
   */
  readonly inPlace: RevisionLimits;
}

/** The p27 in-place revision limits, all magnitudes (ADR-0132), in canonical units. */
export interface RevisionLimits {
  /** Largest displacement increase, bp of the current (1_000 = 10 %). */
  readonly displacementIncreaseBp: number;
  /** Displacement may always rise by at least this much, kg (1_000_000 = 1_000 t), even below the percentage. */
  readonly displacementMinAllowanceKg: number;
  /** Largest designed-speed change either way, milli-knots (1_000 = 1 kn). */
  readonly speedChangeMilliKnots: number;
  /** Largest vertical (belt) armour change either way, micrometres (25_400 = 1 in). */
  readonly verticalArmourChangeUm: number;
  /** Largest horizontal (deck) armour change either way, micrometres (12_700 = 0.5 in). */
  readonly horizontalArmourChangeUm: number;
  /** Main-gun calibre at or below which the main battery may be re-chosen; above it, only a refresh is allowed. */
  readonly mainGunMaxUm: number;
}

/**
 * Structural checks on a revision balance, so a bad content value fails loudly when the content is built instead of
 * producing odd tiers in play. Besides ranges it enforces the order of harshness the rules rely on: a redesign never costs
 * less than a revision (in lost work or in delay), and thresholds ascend. Returns problems; empty means valid.
 */
export function checkRevisionBalance(b: RevisionBalance): string[] {
  const problems: string[] = [];
  const bp = (name: string, v: number) => {
    if (!Number.isSafeInteger(v) || v < 0 || v > 10_000)
      problems.push(`${name} must be an integer in 0..10000 bp, got ${String(v)}`);
  };
  const months = (name: string, v: number, min: number) => {
    if (!Number.isSafeInteger(v) || v < min)
      problems.push(
        `${name} must be an integer of at least ${String(min)} months, got ${String(v)}`,
      );
  };
  bp("freeBelowBp", b.freeBelowBp);
  bp("revisionBelowBp", b.revisionBelowBp);
  bp("redesignBelowBp", b.redesignBelowBp);
  bp("reworkBp", b.reworkBp);
  bp("redesignKeptBp", b.redesignKeptBp);
  if (!Number.isSafeInteger(b.redesignStudyCostBp) || b.redesignStudyCostBp < 0)
    problems.push(
      `redesignStudyCostBp must be a non-negative integer, got ${String(b.redesignStudyCostBp)}`,
    );
  months("t1DelayMonths", b.t1DelayMonths, 1); // spec 15.4: a revision delays at least a month
  months("t2DelayMonths", b.t2DelayMonths, 1);
  if (!(b.freeBelowBp < b.revisionBelowBp && b.revisionBelowBp < b.redesignBelowBp))
    problems.push("thresholds must ascend: freeBelowBp < revisionBelowBp < redesignBelowBp");
  if (b.t2DelayMonths < b.t1DelayMonths)
    problems.push(
      "a redesign must not delay less than a revision (t2DelayMonths >= t1DelayMonths)",
    );
  if (b.reworkBp > 10_000 - b.redesignKeptBp)
    problems.push(
      "a redesign must not lose less work than a revision adds (reworkBp <= 10000 - redesignKeptBp)",
    );
  const l = b.inPlace;
  if (l === undefined || typeof l !== "object") {
    problems.push("inPlace revision limits are required (ADR-0132)");
  } else {
    const nonNegative = (name: string, v: number) => {
      if (!Number.isSafeInteger(v) || v < 0)
        problems.push(`inPlace.${name} must be a non-negative integer, got ${String(v)}`);
    };
    nonNegative("displacementIncreaseBp", l.displacementIncreaseBp);
    nonNegative("displacementMinAllowanceKg", l.displacementMinAllowanceKg);
    nonNegative("speedChangeMilliKnots", l.speedChangeMilliKnots);
    nonNegative("verticalArmourChangeUm", l.verticalArmourChangeUm);
    nonNegative("horizontalArmourChangeUm", l.horizontalArmourChangeUm);
    nonNegative("mainGunMaxUm", l.mainGunMaxUm);
  }
  return problems;
}

/** The design facts the in-place revision limits compare (ADR-0132). */
export interface RevisionFacts {
  readonly displacementKg: number;
  readonly speedMilliKnots: number;
  /** Thickest vertical (belt) armour, micrometres (0 if none). */
  readonly verticalArmourUm: number;
  /** Thickest horizontal (deck) armour, micrometres (0 if none). */
  readonly horizontalArmourUm: number;
  /** Largest main-gun calibre, micrometres (0 if none). */
  readonly maxMainGunUm: number;
  /** Largest secondary/dual-purpose gun calibre, micrometres (0 if none). */
  readonly maxSecondaryGunUm: number;
}

/** Read the revision facts from a compiled design and its draft. */
export function revisionFactsOf(compiled: CompiledDesign, draft: DesignDraft): RevisionFacts {
  const belt = draft.armour.regions.filter((r) => r.region.startsWith("BELT_"));
  const deck = draft.armour.regions.filter((r) => r.region.startsWith("DECK_"));
  const mainGuns = compiled.components.filter((k) => k.category === "MAIN_GUN");
  const secondaries = compiled.components.filter(
    (k) => k.category === "SECONDARY_GUN" || k.category === "DUAL_PURPOSE_GUN",
  );
  return {
    displacementKg: compiled.totalKg,
    speedMilliKnots: compiled.machinery?.maxSpeedMilliKnots ?? 0,
    verticalArmourUm: belt.reduce((m, r) => Math.max(m, r.thicknessUm), 0),
    horizontalArmourUm: deck.reduce((m, r) => Math.max(m, r.thicknessUm), 0),
    maxMainGunUm: mainGuns.reduce((m, k) => Math.max(m, k.attr.caliberUm ?? 0), 0),
    maxSecondaryGunUm: secondaries.reduce((m, k) => Math.max(m, k.attr.caliberUm ?? 0), 0),
  };
}

const revFinding = (
  id: string,
  what: string,
  why: string,
  consequence: string,
  inputs: Record<string, number>,
  threshold: number,
  value: number,
): Finding => ({
  id,
  severity: "BLOCKING",
  what,
  why,
  consequence,
  remedies: [
    { id: "smaller_change", description: "Change less so the revision stays in place." },
    { id: "redesign", description: "Ask for a redesign or a rebuild instead." },
    { id: "new_design", description: "Leave the project and design a new class." },
  ],
  evidence: { formulaId: "DESIGN-21-27", inputs, threshold, value },
});

/**
 * The manual's in-place design-revision limits (printed p27; ADR-0132): a change beyond any of these is no longer a
 * revision but a redesign or rebuild. Pure and deterministic. The main-gun rule reads the largest main-gun calibre:
 * above the limit it may not change, at or below it it may.
 */
export function inPlaceRevisionFindings(
  source: RevisionFacts,
  target: RevisionFacts,
  limits: RevisionLimits,
): Finding[] {
  const findings: Finding[] = [];
  const allowance = Math.max(
    Math.ceil((source.displacementKg * limits.displacementIncreaseBp) / 10_000),
    limits.displacementMinAllowanceKg,
  );
  if (target.displacementKg - source.displacementKg > allowance)
    findings.push(
      revFinding(
        "REVISION_DISPLACEMENT_EXCEEDED",
        "The revision would grow the ship too much.",
        `Displacement rises ${target.displacementKg - source.displacementKg} kg; an in-place revision allows ${allowance} kg.`,
        "Instead of a revision, this is a redesign or a rebuild.",
        { fromKg: source.displacementKg, toKg: target.displacementKg },
        allowance,
        target.displacementKg - source.displacementKg,
      ),
    );
  const speedDelta = target.speedMilliKnots - source.speedMilliKnots;
  if (Math.abs(speedDelta) > limits.speedChangeMilliKnots)
    findings.push(
      revFinding(
        "REVISION_SPEED_EXCEEDED",
        "The revision would change the speed too much.",
        `Speed changes ${speedDelta} milli-knots; an in-place revision allows ${limits.speedChangeMilliKnots} either way.`,
        "Instead of a revision, this is a redesign or a rebuild.",
        { fromMilliKnots: source.speedMilliKnots, toMilliKnots: target.speedMilliKnots },
        limits.speedChangeMilliKnots,
        Math.abs(speedDelta),
      ),
    );
  const verticalDelta = target.verticalArmourUm - source.verticalArmourUm;
  if (Math.abs(verticalDelta) > limits.verticalArmourChangeUm)
    findings.push(
      revFinding(
        "REVISION_VERTICAL_ARMOUR_EXCEEDED",
        "The revision would change the belt armour too much.",
        `Vertical armour changes ${verticalDelta} um; an in-place revision allows ${limits.verticalArmourChangeUm} either way.`,
        "Instead of a revision, this is a redesign or a rebuild.",
        { fromUm: source.verticalArmourUm, toUm: target.verticalArmourUm },
        limits.verticalArmourChangeUm,
        Math.abs(verticalDelta),
      ),
    );
  const horizontalDelta = target.horizontalArmourUm - source.horizontalArmourUm;
  if (Math.abs(horizontalDelta) > limits.horizontalArmourChangeUm)
    findings.push(
      revFinding(
        "REVISION_HORIZONTAL_ARMOUR_EXCEEDED",
        "The revision would change the deck armour too much.",
        `Horizontal armour changes ${horizontalDelta} um; an in-place revision allows ${limits.horizontalArmourChangeUm} either way.`,
        "Instead of a revision, this is a redesign or a rebuild.",
        { fromUm: source.horizontalArmourUm, toUm: target.horizontalArmourUm },
        limits.horizontalArmourChangeUm,
        Math.abs(horizontalDelta),
      ),
    );
  if (source.maxMainGunUm > limits.mainGunMaxUm && target.maxMainGunUm !== source.maxMainGunUm)
    findings.push(
      revFinding(
        "REVISION_MAIN_GUN_UNCHANGEABLE",
        "The main guns above 6 inches cannot be changed.",
        `A ${source.maxMainGunUm} um main gun may only be refreshed with a gun of the same calibre in place.`,
        "Changing the main battery above 6 inches needs a redesign or a rebuild.",
        { fromUm: source.maxMainGunUm, toUm: target.maxMainGunUm },
        limits.mainGunMaxUm,
        target.maxMainGunUm,
      ),
    );
  if (
    source.maxSecondaryGunUm > limits.mainGunMaxUm &&
    target.maxSecondaryGunUm !== source.maxSecondaryGunUm
  )
    findings.push(
      revFinding(
        "REVISION_SECONDARY_GUN_LIMIT",
        "The heavy secondary guns cannot be changed.",
        `A ${source.maxSecondaryGunUm} um secondary gun may only be refreshed with a gun of the same calibre in place.`,
        "Changing the secondary battery above 6 inches needs a redesign or a rebuild.",
        { fromUm: source.maxSecondaryGunUm, toUm: target.maxSecondaryGunUm },
        limits.mainGunMaxUm,
        target.maxSecondaryGunUm,
      ),
    );
  return findings;
}

export interface BuildProgress {
  readonly hullDoneWork: number;
  readonly hullTotalWork: number;
  readonly armourStarted: boolean;
  readonly machineryStarted: boolean;
  readonly launched: boolean;
  /** Work already done on packages affected by a fittings change (for T1 rework). */
  readonly affectedDoneWork: number;
}

export interface RevisionDecision {
  readonly tier: RevisionTier;
  readonly progressBp: number;
  readonly reworkWorkMicro: number;
  readonly delayMonths: number;
  readonly studyCostMultiplierBp: number;
  /** Hull work retained after the change (T2 reduces; T3 is handled by a rebuild project). */
  readonly hullDoneWorkAfter: number;
  /** True when the change must become a REBUILD/CONVERSION/cancel decision (DESIGN-23 §20-23). */
  readonly requiresRebuildProject: boolean;
  readonly reasonCodes: readonly string[];
}

export const STRUCTURE_KEYS: ReadonlySet<string> = new Set([
  "hullFormId",
  "lengthWl",
  "beam",
  "draught",
  "depthToMainDeck",
  "blockCoeffBp",
  "materialId",
  "structuralSchemeId",
  "subdivisionGrade",
  "freeboardProfile",
]);

/**
 * Maps a draft edit to the kind of change it is, or null when it changes the brief only (`set_requirement`: a brief is not
 * a build change, as in `draftChangeKinds`). `categoryOf` resolves a placement's component category.
 */
export function changeKindOf(
  e: DraftEdit,
  categoryOf: (instanceId: string) => ComponentCategory | undefined,
): ChangeKind | null {
  switch (e.kind) {
    case "set_requirement":
      return null;
    case "batch":
      // A batch has no single kind; use `changeKindsOf`. Reported as its first inner kind so callers that only know
      // singles still see a build change.
      return e.edits.length === 0 ? null : changeKindOf(e.edits[0]!, categoryOf);
    case "set_side":
      return categoryOf(e.instanceId) === "MAIN_GUN" ? "MAIN_ARMAMENT" : "FITTINGS";
    case "set_aluminium_superstructure":
      return "STRUCTURE";
    case "set_hull":
      return Object.keys(e.patch).some((k) => STRUCTURE_KEYS.has(k)) ? "STRUCTURE" : "FITTINGS";
    case "set_machinery":
      return Object.keys(e.patch).some(
        (k) => k === "plantId" || k === "installedKw" || k === "enginePriorityBp",
      )
        ? "MACHINERY"
        : "FITTINGS";
    case "set_armour_region":
    case "remove_armour_region":
    case "set_armour_regions":
    case "set_armour_scheme":
      return "ARMOUR";
    case "add_placement":
    case "set_fire_control":
    case "set_colonial_service":
    case "set_tertiary":
      return "FITTINGS";
    case "remove_placement":
    case "move_placement":
    case "set_param":
      return categoryOf(e.instanceId) === "MAIN_GUN" ? "MAIN_ARMAMENT" : "FITTINGS";
  }
}

/** Every kind of change an edit makes (a batch contributes each inner edit's kind; a brief-only edit contributes none). */
export function changeKindsOf(
  e: DraftEdit,
  categoryOf: (instanceId: string) => ComponentCategory | undefined,
): ChangeKind[] {
  const inner = e.kind === "batch" ? e.edits : [e];
  const kinds = new Set<ChangeKind>();
  for (const i of inner) {
    const k = changeKindOf(i, categoryOf);
    if (k !== null) kinds.add(k);
  }
  return [...kinds];
}

const TIER_RANK: Record<RevisionTier, number> = {
  T0_FREE: 0,
  T1_REVISION: 1,
  T2_REDESIGN: 2,
  T3_RECONSTRUCTION: 3,
};
const maxTier = (a: RevisionTier, b: RevisionTier): RevisionTier =>
  TIER_RANK[a] >= TIER_RANK[b] ? a : b;

/** Spec §15.4: when changes stay cheap and when they become redesign or reconstruction. Pure. */
export function classifyRevision(
  kinds: readonly ChangeKind[],
  p: BuildProgress,
  b: RevisionBalance,
): RevisionDecision {
  const progressBp =
    p.hullTotalWork <= 0
      ? 10_000
      : Math.min(10_000, Math.floor((p.hullDoneWork * 10_000) / p.hullTotalWork));
  const reasons: string[] = [];
  let tier: RevisionTier =
    progressBp < b.freeBelowBp
      ? "T0_FREE"
      : progressBp < b.revisionBelowBp
        ? "T1_REVISION"
        : progressBp < b.redesignBelowBp
          ? "T2_REDESIGN"
          : "T3_RECONSTRUCTION";
  if (tier !== "T0_FREE") reasons.push(`REVISION_PROGRESS_${tier}`);

  const hard = kinds.some(
    (k) => k === "STRUCTURE" || k === "MACHINERY" || k === "MAIN_ARMAMENT" || k === "ARMOUR",
  );
  if (hard && tier === "T1_REVISION") {
    tier = "T2_REDESIGN";
    reasons.push("REVISION_ESCALATED_STRUCTURAL");
  }
  if (
    tier === "T0_FREE" &&
    ((p.armourStarted && kinds.includes("ARMOUR")) ||
      (p.machineryStarted && kinds.includes("MACHINERY")))
  ) {
    tier = "T1_REVISION";
    reasons.push("REVISION_COMPONENT_ORDERED");
  }
  if (kinds.includes("STRUCTURE") && progressBp >= b.freeBelowBp) {
    tier = maxTier(tier, "T2_REDESIGN");
    reasons.push("REVISION_HULL_GEOMETRY");
  }
  if (p.launched) {
    tier = "T3_RECONSTRUCTION";
    reasons.push("REVISION_AFTER_LAUNCH");
  }

  switch (tier) {
    case "T0_FREE":
      return {
        tier,
        progressBp,
        reworkWorkMicro: 0,
        delayMonths: 0,
        studyCostMultiplierBp: 0,
        hullDoneWorkAfter: p.hullDoneWork,
        requiresRebuildProject: false,
        reasonCodes: reasons,
      };
    case "T1_REVISION":
      return {
        tier,
        progressBp,
        reworkWorkMicro: Math.floor((p.affectedDoneWork * b.reworkBp) / 10_000),
        delayMonths: b.t1DelayMonths,
        studyCostMultiplierBp: 0,
        hullDoneWorkAfter: p.hullDoneWork,
        requiresRebuildProject: false,
        reasonCodes: reasons,
      };
    case "T2_REDESIGN":
      return {
        tier,
        progressBp,
        reworkWorkMicro: 0,
        delayMonths: b.t2DelayMonths,
        studyCostMultiplierBp: b.redesignStudyCostBp,
        hullDoneWorkAfter: Math.floor((p.hullDoneWork * b.redesignKeptBp) / 10_000),
        requiresRebuildProject: false,
        reasonCodes: reasons,
      };
    case "T3_RECONSTRUCTION":
      return {
        tier,
        progressBp,
        reworkWorkMicro: 0,
        delayMonths: 0,
        studyCostMultiplierBp: 0,
        hullDoneWorkAfter: p.hullDoneWork,
        requiresRebuildProject: true,
        reasonCodes: reasons,
      };
  }
}
