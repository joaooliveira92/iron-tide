import type { CompiledDesign } from "./compile.js";
import { computeCost, treasuryCostUnits } from "./cost.js";
import { generateCandidates, type AiEnvironment, type ArchetypeId, type Candidate } from "./ai.js";
import {
  effectiveDesignWeights,
  rankCandidatesForNation,
  scoreDesign,
  type DesignScoreFacts,
} from "./nationalDesignPolicy.js";
import {
  applyNationalConstructionEconomics,
  resolveNationalConstruction,
  accessEffect,
  DEFAULT_ACCESS_POLICY,
  type ComponentAccessPolicy,
} from "./nationalConstruction.js";
import type { NationNavalProfile } from "./nationProfile.js";
import { HULL_TYPE_FOR_SHIP_TYPE, type ShipTypeId } from "./shipTypes.js";
import { starterFor, type StarterDesign } from "./shipTypeRoster.js";
import type { ShipBuildingContent } from "./shipBuildingContent.js";

export const PROCUREMENT_TYPES: readonly ShipTypeId[] = ["B", "CA", "CL", "DD", "KE", "AMC"];

export type RoleGroup = "capital" | "cruiser" | "light" | "colonial";

export function roleGroupOf(type: ShipTypeId): RoleGroup {
  if (type === "B") return "capital";
  if (type === "CA" || type === "CL") return "cruiser";
  if (type === "DD") return "light";
  return "colonial";
}

export type ShipStatus = "ACTIVE" | "BUILDING" | "UNAVAILABLE";

export interface FleetShipView {
  readonly shipType: ShipTypeId;
  readonly status: ShipStatus;
}

export function shipTypeForHullType(hullType: string): ShipTypeId | null {
  for (const [type, hull] of Object.entries(HULL_TYPE_FOR_SHIP_TYPE))
    if (hull === hullType) return type as ShipTypeId;
  return null;
}

export interface FleetAssessment {
  readonly active: Readonly<Record<ShipTypeId, number>>;
  readonly building: Readonly<Record<ShipTypeId, number>>;
  readonly unavailable: Readonly<Record<ShipTypeId, number>>;
}

const zeroCounts = (): Record<ShipTypeId, number> =>
  Object.fromEntries(PROCUREMENT_TYPES.map((t) => [t, 0])) as Record<ShipTypeId, number>;

export function assessFleet(fleet: readonly FleetShipView[]): FleetAssessment {
  const active = zeroCounts();
  const building = zeroCounts();
  const unavailable = zeroCounts();
  for (const s of fleet) {
    if (!PROCUREMENT_TYPES.includes(s.shipType)) continue;
    if (s.status === "ACTIVE") active[s.shipType]++;
    else if (s.status === "BUILDING") building[s.shipType]++;
    else unavailable[s.shipType]++;
  }
  return { active, building, unavailable };
}

export function targetCounts(
  profile: NationNavalProfile,
  baseCount = 8,
): Record<ShipTypeId, number> {
  const p = profile.procurementPolicy;
  const shares: Record<ShipTypeId, number> = {
    B: p.battleLineShareBp,
    CA: p.cruiserShareBp,
    CL: p.cruiserShareBp,
    DD: p.torpedoCraftShareBp,
    KE: p.colonialShareBp,
    AMC: p.colonialShareBp,
    BB: 0,
    BC: 0,
    CV: 0,
    CVL: 0,
    AV: 0,
    SS: 0,
    MTB: 0,
    TR: 0,
  };
  const total = PROCUREMENT_TYPES.reduce((a, t) => a + shares[t], 0) || 1;
  return Object.fromEntries(
    PROCUREMENT_TYPES.map((t) => [t, Math.round((shares[t] / total) * baseCount)]),
  ) as Record<ShipTypeId, number>;
}

export function computeFleetDeficits(
  profile: NationNavalProfile,
  assessment: FleetAssessment,
  baseCount = 8,
): Record<ShipTypeId, number> {
  const targets = targetCounts(profile, baseCount);
  return Object.fromEntries(
    PROCUREMENT_TYPES.map((t) => {
      const owned = assessment.active[t] + assessment.building[t];
      return [t, Math.max(0, targets[t] - owned)];
    }),
  ) as Record<ShipTypeId, number>;
}

export function chooseProcurementRole(
  profile: NationNavalProfile,
  deficits: Readonly<Record<ShipTypeId, number>>,
): ShipTypeId | null {
  for (const type of profile.procurementPolicy.buildOrder)
    if (PROCUREMENT_TYPES.includes(type) && (deficits[type] ?? 0) > 0) return type;
  return null;
}

export function archetypesForNation(
  profile: NationNavalProfile,
  type: ShipTypeId,
): readonly ArchetypeId[] {
  const s = profile.softPreferences;
  const picked: ArchetypeId[] = [];
  const add = (a: ArchetypeId) => {
    if (!picked.includes(a)) picked.push(a);
  };
  add("BALANCED");
  if (s.enduranceWeightBp >= 12_000) add("LONG_RANGE");
  if (s.riskToleranceBp >= 7000) add("AGGRESSIVE");
  if (s.riskToleranceBp <= 5000) add("CONSERVATIVE");
  if (s.speedOverArmourBp >= 6000) add("AGGRESSIVE");
  if (type === "KE" || type === "AMC") add("LOW_COST");
  if (s.torpedoOnCruisersBp >= 12_000 && (type === "CL" || type === "DD")) add("AGGRESSIVE");
  return picked;
}

export function designScoreFacts(
  compiled: CompiledDesign,
  costUnits: number,
  buildMonths: number,
): DesignScoreFacts {
  const speed = compiled.machinery?.maxSpeedMilliKnots ?? 0;
  const range = compiled.machinery?.rangeNmAtCruise ?? 0;
  let firepower = 0;
  let torpedoes = 0;
  for (const c of compiled.components) {
    const barrels = c.params["barrels"] ?? 1;
    const tubes = c.params["tubes"] ?? 0;
    if (
      c.category === "MAIN_GUN" ||
      c.category === "SECONDARY_GUN" ||
      c.category === "DUAL_PURPOSE_GUN"
    )
      firepower += (c.attr["caliberUm"] ?? 0) * barrels;
    if (c.category === "TORPEDO_TUBE") torpedoes += tubes;
  }
  const armourKg = compiled.ledger.armour ?? 0;
  const protection = compiled.totalKg > 0 ? Math.round((armourKg * 20_000) / compiled.totalKg) : 0;
  return {
    firepowerBp: Math.min(20_000, Math.round(firepower / 100)),
    protectionBp: Math.min(20_000, protection),
    speedBp: Math.min(20_000, Math.round(speed / 2)),
    enduranceBp: Math.min(20_000, Math.round(range / 4)),
    torpedoBp: Math.min(20_000, torpedoes * 2_000),
    reliabilityBp: 10_000,
    colonialBp: 10_000,
    costUnits,
    buildMonths,
    overweightBp: 0,
    obsolescenceBp: 0,
  };
}

export interface CandidateView {
  readonly designId: string;
  readonly legal: boolean;
  readonly dockFits: boolean;
  readonly score: number;
  readonly costUnits: number;
  readonly rejection?: string;
}

export interface ProcurementDecision {
  readonly nationId: string;
  readonly month: string;
  readonly deficits: Readonly<Record<ShipTypeId, number>>;
  readonly role: ShipTypeId | null;
  readonly candidates: readonly CandidateView[];
  readonly rejectionReasons: readonly string[];
  readonly selectedDesignId: string | null;
  readonly selectedDraft: Candidate["draft"] | null;
  readonly costUnits: number | null;
  readonly accessEffects: readonly string[];
  readonly noProcurementReason: string | null;
}

export interface ProcurementInput {
  readonly profile: NationNavalProfile;
  readonly month: string;
  readonly seed: string;
  readonly decisionId: string;
  readonly budgetUnits: number;
  readonly fleet: readonly FleetShipView[];
  readonly content: ShipBuildingContent;
  readonly starters: readonly StarterDesign[];
  readonly recentClassIds?: readonly string[];
  readonly accessPolicy?: ComponentAccessPolicy;
  readonly candidateCount?: number;
  readonly compilesPerArchetype?: number;
}

const clampCandidateCount = (n: number | undefined): number => Math.max(12, Math.min(30, n ?? 20));

export const DIVERSITY_PENALTY_BP = 1500;

export function planProcurementDecision(input: ProcurementInput): ProcurementDecision {
  const { profile, month, seed, decisionId, budgetUnits, content, starters } = input;
  const accessPolicy = input.accessPolicy ?? DEFAULT_ACCESS_POLICY;
  const assessment = assessFleet(input.fleet);
  const deficits = computeFleetDeficits(profile, assessment);
  const role = chooseProcurementRole(profile, deficits);

  const baseDecision: Omit<
    ProcurementDecision,
    | "candidates"
    | "rejectionReasons"
    | "selectedDesignId"
    | "selectedDraft"
    | "costUnits"
    | "accessEffects"
    | "noProcurementReason"
  > = { nationId: profile.nationId, month, deficits, role };

  const accessEffects: string[] = [];
  for (const [label, status] of [
    ["heavy guns", profile.industrialProfile.heavyGunProduction],
    ["armour plate", profile.industrialProfile.armourPlateProduction],
  ] as const) {
    const effect = accessEffect(status, accessPolicy);
    accessEffects.push(
      `${label}: ${status.toLowerCase().replaceAll("_", " ")} (cost ×${effect.costMultiplierBp / 10_000})`,
    );
  }

  if (role === null)
    return {
      ...baseDecision,
      candidates: [],
      rejectionReasons: [],
      selectedDesignId: null,
      selectedDraft: null,
      costUnits: null,
      accessEffects,
      noProcurementReason: "no_deficit",
    };

  const starter = starterFor(role, starters, month, profile.nationId);
  if (starter === null)
    return {
      ...baseDecision,
      candidates: [],
      rejectionReasons: [`no starter design for ${role}`],
      selectedDesignId: null,
      selectedDraft: null,
      costUnits: null,
      accessEffects,
      noProcurementReason: "no_starter",
    };

  let modifiers;
  try {
    modifiers = resolveNationalConstruction(profile, month, accessPolicy);
  } catch {
    return {
      ...baseDecision,
      candidates: [],
      rejectionReasons: ["national supply unavailable"],
      selectedDesignId: null,
      selectedDraft: null,
      costUnits: null,
      accessEffects,
      noProcurementReason: "supply_unavailable",
    };
  }

  const aiEnv: AiEnvironment = content.aiEnvironmentFor(month, profile.nationId);
  const generated: readonly Candidate[] = generateCandidates(aiEnv, {
    base: starter.draft,
    seed: `${seed}:${decisionId}:${role}`,
    nationKey: profile.nationId,
    candidates: clampCandidateCount(input.candidateCount),
    compilesPerArchetype: input.compilesPerArchetype ?? 24,
    archetypes: archetypesForNation(profile, role),
  }).candidates;

  const recent = new Set(input.recentClassIds ?? []);
  const weights = effectiveDesignWeights(profile, role, `${seed}:${decisionId}`);
  const env = content.environmentFor(month, profile.nationId);
  const unitMicro = content.treasuryUnitMicro;
  const rejectionReasons: string[] = [];

  const scored = generated.map((candidate) => {
    const compiled = candidate.compiled;
    const blocking = compiled.findings.filter((f) => f.severity === "BLOCKING");
    const dockFits = !compiled.findings.some((f) => f.id === "NO_FACILITY_FITS");
    const baseCostUnits = treasuryCostUnits(
      computeCost(compiled, candidate.draft, env.costBalance, env.costCtx).total,
      unitMicro,
    );
    const economics = applyNationalConstructionEconomics(baseCostUnits, 0, modifiers);
    const facts = designScoreFacts(compiled, economics.costUnits, 0);
    let score = compiled.valid ? scoreDesign(weights, facts) : Number.NEGATIVE_INFINITY;
    const classPenalty = recent.has(compiled.naturalClass ?? "") ? DIVERSITY_PENALTY_BP : 0;
    score -= classPenalty;
    let rejection: string | undefined;
    if (!compiled.valid || blocking.length > 0)
      rejection = blocking[0] ? `blocking: ${blocking[0].id}` : "invalid";
    else if (!dockFits) rejection = "no_dock";
    else if (economics.costUnits > budgetUnits) rejection = "unaffordable";
    if (rejection !== undefined)
      rejectionReasons.push(`${candidate.draft.requirement.category}: ${rejection}`);
    return {
      designId: `${profile.nationId}_${role}_${String(scoredIndex(candidate))}`,
      legal: compiled.valid && blocking.length === 0 && dockFits,
      dockFits,
      score,
      costUnits: economics.costUnits,
      rejection,
      _candidate: candidate,
    };
  });

  const eligible = scored.filter((s) => s.rejection === undefined);
  const ranked = rankCandidatesForNation(
    eligible.map((s) => ({
      designId: s.designId,
      facts: designScoreFacts(s._candidate.compiled, s.costUnits, 0),
      _s: s,
    })),
    weights,
  );

  const views: CandidateView[] = scored.map((s) => ({
    designId: s.designId,
    legal: s.legal,
    dockFits: s.dockFits,
    score: s.score,
    costUnits: s.costUnits,
    ...(s.rejection !== undefined ? { rejection: s.rejection } : {}),
  }));

  if (ranked.length === 0)
    return {
      ...baseDecision,
      candidates: views,
      rejectionReasons,
      selectedDesignId: null,
      selectedDraft: null,
      costUnits: null,
      accessEffects,
      noProcurementReason:
        rejectionReasons.length > 0 ? "no_legal_affordable_design" : "no_candidates",
    };

  const chosen = ranked[0]!._s;
  return {
    ...baseDecision,
    candidates: views,
    rejectionReasons,
    selectedDesignId: chosen.designId,
    selectedDraft: chosen._candidate.draft,
    costUnits: chosen.costUnits,
    accessEffects,
    noProcurementReason: null,
  };
}

function scoredIndex(candidate: Candidate): number {
  const d = candidate.draft;
  return d.hull.lengthWl + d.hull.beam * 3 + d.machinery.installedKw * 7 + d.placements.length * 11;
}
