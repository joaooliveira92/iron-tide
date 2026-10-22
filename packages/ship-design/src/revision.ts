import type { CompiledDesign, DesignDraft } from "./compileShared.js";
import type { DraftEdit } from "./edits.js";
import type { Finding } from "./findings.js";
import type { ComponentCategory } from "./component.js";

export type ChangeKind = "FITTINGS" | "MAIN_ARMAMENT" | "ARMOUR" | "MACHINERY" | "STRUCTURE";
export type RevisionTier = "T0_FREE" | "T1_REVISION" | "T2_REDESIGN" | "T3_RECONSTRUCTION";

export interface RevisionBalance {
  readonly freeBelowBp: number;
  readonly revisionBelowBp: number;
  readonly redesignBelowBp: number;
  readonly reworkBp: number;
  readonly t1DelayMonths: number;
  readonly redesignStudyCostBp: number;
  readonly redesignKeptBp: number;
  readonly t2DelayMonths: number;
  readonly inPlace: RevisionLimits;
}

export interface RevisionLimits {
  readonly displacementIncreaseBp: number;
  readonly displacementMinAllowanceKg: number;
  readonly speedChangeMilliKnots: number;
  readonly verticalArmourChangeUm: number;
  readonly horizontalArmourChangeUm: number;
  readonly mainGunMaxUm: number;
}

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
  months("t1DelayMonths", b.t1DelayMonths, 1);
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

export interface RevisionFacts {
  readonly displacementKg: number;
  readonly speedMilliKnots: number;
  readonly verticalArmourUm: number;
  readonly horizontalArmourUm: number;
  readonly maxMainGunUm: number;
  readonly maxSecondaryGunUm: number;
}

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
  readonly affectedDoneWork: number;
}

export interface RevisionDecision {
  readonly tier: RevisionTier;
  readonly progressBp: number;
  readonly reworkWorkMicro: number;
  readonly delayMonths: number;
  readonly studyCostMultiplierBp: number;
  readonly hullDoneWorkAfter: number;
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

export function changeKindOf(
  e: DraftEdit,
  categoryOf: (instanceId: string) => ComponentCategory | undefined,
): ChangeKind | null {
  switch (e.kind) {
    case "set_requirement":
      return null;
    case "batch":
      return e.edits.length === 0 ? null : changeKindOf(e.edits[0]!, categoryOf);
    case "set_side":
      return categoryOf(e.instanceId) === "MAIN_GUN" ? "MAIN_ARMAMENT" : "FITTINGS";
    case "set_aluminium_superstructure":
      return "STRUCTURE";
    case "set_anti_aircraft":
      return "FITTINGS";
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
