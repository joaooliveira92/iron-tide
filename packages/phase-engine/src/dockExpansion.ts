// DESIGN-16 sections 5-6 (spec SB3-R16/R17): the engine half of dock expansion. The `dock_expansion_v1` policy and its
// pure integer arithmetic live in `@bluewave/ship-design`; this module owns the campaign-state project shape, the
// both-conditions completion rule, and the seeded private opportunity event. Pure and deterministic: keyed random
// decisions only (`event/month/nation/private_dock_expansion`), each recorded; no wall-clock, no ambient input.
import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomDecision, RandomEngine, RandomLedger } from "@bluewave/random";
import {
  DOCK_EXPANSION_BASE_DURATION_MONTHS,
  dockExpansionEraStepForMonth,
  dockExpansionFinalDurationMonths,
  DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  raiseDockLimitsByStep,
  type DockMassLimits,
} from "@bluewave/ship-design";

/** The project type a dock expansion is stored as (DESIGN-16 section 5; SB3-R16). */
export const DOCK_EXPANSION_PROJECT_TYPE = "INFRASTRUCTURE" as const;

// Re-exported so the desktop projection can read the compiled duration and era step from `@bluewave/phase-engine`
// without a second ship-design import (SB3-R33).
export {
  DOCK_EXPANSION_BASE_DURATION_MONTHS,
  DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  dockExpansionEraStepForMonth,
  dockExpansionFinalDurationMonths,
} from "@bluewave/ship-design";

/** The stable cost-formula identifier recorded for the shipped work model (DESIGN-16 section 5.1). */
export const DOCK_EXPANSION_COST_FORMULA_ID = "dock_expansion_work_v1" as const;

/**
 * The shipped total work of one expansion step, in construction work units.
 *
 * BALANCE TARGET: DESIGN-16 fixes the duration (12 months) and the era step, but gives no work figure. This value is
 * deliberately sourced here as a versioned ruleset constant rather than an opaque balance-file number, so a replay is
 * self-describing; the manual supplies no total. It is a genuinely unsourced value and is not presented as derived.
 */
export const DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS = 1_200 as const;

/** DESIGN-16 section 5.3: a project is an expansion only when the authorization-locked step is present. */
export function isDockExpansionProject(project: ConstructionProject): boolean {
  return (
    project.projectType === DOCK_EXPANSION_PROJECT_TYPE && project.dockExpansionStepKg !== undefined
  );
}

/**
 * DESIGN-16 section 5.3: a dock expansion completes only after BOTH elapsed active project months reach the final
 * duration AND paid completed work reaches total work. Elapsed time alone MUST NOT complete the project.
 */
export function dockExpansionCompletes(project: ConstructionProject): boolean {
  const duration = project.dockExpansionDurationMonths;
  const stepKg = project.dockExpansionStepKg;
  if (duration === undefined || stepKg === undefined) return false;
  if (!Number.isSafeInteger(duration) || duration <= 0) return false;
  if (!(Number(project.totalWork) > 0)) return false;
  const elapsed = project.elapsedActiveMonths ?? 0;
  return elapsed >= duration && Number(project.paidWork) >= Number(project.totalWork);
}

/**
 * DESIGN-16 section 5.4: a month contributes an active elapsed month only while the project is genuinely ACTIVE (or
 * ACCELERATED). HALTED, DELAYED, AWAITING_CAPACITY, PLANNED and terminal months contribute zero.
 */
export function dockExpansionMonthIsActive(status: ConstructionProject["status"]): boolean {
  return status === "ACTIVE" || status === "ACCELERATED";
}

export interface DockExpansionProjectInput {
  readonly projectId: string;
  readonly possessionId: string;
  readonly authorizedMonth: string;
  readonly stepKg: number;
  /** Clamped final duration; defaults to the shipped 12 months. */
  readonly durationMonths?: number;
  /** Overrides the shipped total work (tests / future cost formula). */
  readonly totalWork?: number;
}

/**
 * The normal dock-expansion project an authorization or a private opportunity creates (DESIGN-16 section 5). It is a
 * `building`/`INFRASTRUCTURE` project with the era step and duration frozen on it; it never raises the dock itself.
 */
export function dockExpansionProjectFor(input: DockExpansionProjectInput): ConstructionProject {
  return {
    id: input.projectId,
    type: "building",
    projectType: DOCK_EXPANSION_PROJECT_TYPE,
    targetId: input.possessionId,
    designVersionId: "",
    totalWork: SafeInt(input.totalWork ?? DOCK_EXPANSION_BASE_TOTAL_WORK_UNITS),
    completedWork: SafeInt.ZERO,
    paidWork: SafeInt.ZERO,
    status: "PLANNED",
    startedAt: input.authorizedMonth,
    elapsedActiveMonths: 0,
    dockExpansionDurationMonths: input.durationMonths ?? DOCK_EXPANSION_BASE_DURATION_MONTHS,
    dockExpansionStepKg: input.stepKg,
  };
}

/** The stable reason an authorization cannot create an expansion (out-of-schedule month or invalid duration). */
export type DockExpansionAuthorizationReason = "AUTHORIZED" | "NO_ERA_STEP" | "INVALID_DURATION";

export type DockExpansionAuthorizationResult =
  | {
      readonly ok: true;
      readonly snapshot: CampaignSnapshot;
      readonly project: ConstructionProject;
      readonly stepKg: number;
      readonly durationMonths: number;
    }
  | { readonly ok: false; readonly reason: DockExpansionAuthorizationReason };

/**
 * DESIGN-16 section 5.2: authorize a dock-expansion project for a nation, locking the applicable era step at the
 * authorization month. Later calendar advancement does not change the stored step, because it is persisted here once.
 * The duration is the clamped final duration; the caller may supply a duration multiplier.
 */
export function authorizeDockExpansion(
  snapshot: CampaignSnapshot,
  request: {
    readonly nationId: string;
    readonly possessionId: string;
    readonly campaignMonth: string;
    readonly durationMultiplierBp?: number;
  },
): DockExpansionAuthorizationResult {
  const nation = snapshot["nations"].get(request.nationId);
  if (!nation) return { ok: false, reason: "NO_ERA_STEP" };
  const stepKg = dockExpansionEraStepForMonth(request.campaignMonth);
  if (stepKg === null) return { ok: false, reason: "NO_ERA_STEP" };
  const durationMonths = dockExpansionFinalDurationMonths(
    DOCK_EXPANSION_BASE_DURATION_MONTHS,
    request.durationMultiplierBp ?? DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  );
  if (!Number.isSafeInteger(durationMonths) || durationMonths <= 0)
    return { ok: false, reason: "INVALID_DURATION" };
  const project = dockExpansionProjectFor({
    projectId: `dock-expansion-${request.nationId}-${request.possessionId}-${request.campaignMonth}`,
    possessionId: request.possessionId,
    authorizedMonth: request.campaignMonth,
    stepKg,
    durationMonths,
  });
  const nations = new Map(snapshot["nations"]).set(request.nationId, {
    ...nation,
    constructionProjects: [...nation["constructionProjects"], project],
  });
  return { ok: true, snapshot: { ...snapshot, nations }, project, stepKg, durationMonths };
}

/** The dock a completed expansion raises: every covered mass limit moves by the same locked step. */
export function applyDockExpansionStep(dock: DockMassLimits, stepKg: number): DockMassLimits {
  return raiseDockLimitsByStep(dock, stepKg);
}

// DESIGN-16 section 6: the private industrial dock-expansion opportunity (SB3-R17)

/** The typed seeded event identifier (DESIGN-16 section 6). */
export const PRIVATE_DOCK_EXPANSION_EVENT_ID = "private_dock_expansion_opportunity_v1" as const;

/** The stream family DESIGN-16 section 6 fixes. */
export const PRIVATE_DOCK_EXPANSION_STREAM_FAMILY =
  "event/month/nation/private_dock_expansion" as const;

/** DESIGN-16 section 6: minimum trailing-12-month dock utilisation, in basis points. */
export const PRIVATE_DOCK_EXPANSION_MIN_UTILIZATION_BP = 7_500 as const;

/** DESIGN-16 section 6: event cooldown, in months. */
export const PRIVATE_DOCK_EXPANSION_COOLDOWN_MONTHS = 60 as const;

/** DESIGN-16 section 6: the trailing window the utilisation threshold is measured over. */
export const PRIVATE_DOCK_EXPANSION_TRAILING_MONTHS = 12 as const;

/**
 * The shipped event weight, in basis points of a fired opportunity.
 *
 * BALANCE TARGET: DESIGN-16 section 6 requires an `event weight` but fixes no number, and the manual says only that
 * dock size "may occasionally increase by itself". This is a genuinely unsourced value, authored as a versioned
 * constant here (not an opaque balance-file number), with the draw recorded in the random-decision ledger.
 */
export const PRIVATE_DOCK_EXPANSION_EVENT_WEIGHT_BP = 2_500 as const;

/** Stable ledger outcomes for the keyed opportunity check. */
export const PRIVATE_DOCK_EXPANSION_TRIGGERED = "PRIVATE_DOCK_EXPANSION_TRIGGERED" as const;
export const PRIVATE_DOCK_EXPANSION_NOT_TRIGGERED = "PRIVATE_DOCK_EXPANSION_NOT_TRIGGERED" as const;

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1);

/**
 * DESIGN-16 section 6: the trailing-12-month dock utilisation of one possession, floored to whole basis points, or
 * `null` when fewer than twelve explicit monthly records exist. Absence of records is never inferred into a value.
 */
export function trailingDockUtilizationBp(
  utilization: readonly { readonly month: string; readonly utilizationBp: number }[],
  campaignMonth: string,
): number | null {
  const end = monthIndex(campaignMonth);
  if (!Number.isFinite(end)) return null;
  const window = utilization.filter((h) => {
    const i = monthIndex(h.month);
    return Number.isFinite(i) && i <= end && i > end - PRIVATE_DOCK_EXPANSION_TRAILING_MONTHS;
  });
  if (window.length < PRIVATE_DOCK_EXPANSION_TRAILING_MONTHS) return null;
  const sum = window.reduce(
    (total, h) =>
      total +
      (Number.isSafeInteger(h.utilizationBp) ? Math.min(10_000, Math.max(0, h.utilizationBp)) : 0),
    0,
  );
  return Math.floor(sum / PRIVATE_DOCK_EXPANSION_TRAILING_MONTHS);
}

export type PrivateDockExpansionReason =
  | "ELIGIBLE"
  | "NO_STATE"
  | "NO_EXPLICIT_ELIGIBILITY"
  | "INSUFFICIENT_HISTORY"
  | "BELOW_UTILIZATION"
  | "COOLDOWN"
  | "ACTIVE_EVENT";

export interface PrivateDockExpansionEligibility {
  readonly nationId: string;
  /** The ascending-first eligible possession, or `null` when none is eligible. */
  readonly possessionId: string | null;
  readonly eligible: boolean;
  readonly reason: PrivateDockExpansionReason;
  readonly trailingUtilizationBp: number | null;
}

/** Whether the nation already has an in-flight dock-expansion project (at most one active event per nation). */
export function hasActivePrivateDockExpansion(nation: NationState): boolean {
  return nation["constructionProjects"].some(
    (p) => isDockExpansionProject(p) && p["status"] !== "COMPLETED" && p["status"] !== "CANCELLED",
  );
}

/**
 * DESIGN-16 section 6: the eligibility of the ascending-first eligible possession of a nation, in ascending possession
 * identifier order. A nation without explicit state, or a possession without explicit eligibility, is never inferred
 * into development. The cooldown and the one-active-event rule gate the whole nation first.
 */
export function privateDockExpansionEligibility(
  nation: NationState,
  campaignMonth: string,
): PrivateDockExpansionEligibility {
  const base = { nationId: nation["id"], possessionId: null } as const;
  const state = nation["dockExpansion"];
  if (state === undefined)
    return { ...base, eligible: false, reason: "NO_STATE", trailingUtilizationBp: null };
  if (hasActivePrivateDockExpansion(nation))
    return { ...base, eligible: false, reason: "ACTIVE_EVENT", trailingUtilizationBp: null };
  const last = state.lastOpportunityMonth;
  if (
    last !== undefined &&
    monthIndex(campaignMonth) - monthIndex(last) < PRIVATE_DOCK_EXPANSION_COOLDOWN_MONTHS
  )
    return { ...base, eligible: false, reason: "COOLDOWN", trailingUtilizationBp: null };

  const possessions = [...state.possessions].sort((a, b) =>
    a.possessionId < b.possessionId ? -1 : a.possessionId > b.possessionId ? 1 : 0,
  );
  const explicit = possessions.filter((p) => p.eligible);
  if (explicit.length === 0)
    return {
      ...base,
      eligible: false,
      reason: "NO_EXPLICIT_ELIGIBILITY",
      trailingUtilizationBp: null,
    };

  let sawHistoryShortfall = false;
  let sawBelowThreshold = false;
  for (const possession of explicit) {
    const trailing = trailingDockUtilizationBp(possession.utilization, campaignMonth);
    if (trailing === null) {
      sawHistoryShortfall = true;
      continue;
    }
    if (trailing < PRIVATE_DOCK_EXPANSION_MIN_UTILIZATION_BP) {
      sawBelowThreshold = true;
      continue;
    }
    return {
      nationId: nation["id"],
      possessionId: possession.possessionId,
      eligible: true,
      reason: "ELIGIBLE",
      trailingUtilizationBp: trailing,
    };
  }
  return {
    ...base,
    eligible: false,
    reason: sawBelowThreshold
      ? "BELOW_UTILIZATION"
      : sawHistoryShortfall
        ? "INSUFFICIENT_HISTORY"
        : "NO_EXPLICIT_ELIGIBILITY",
    trailingUtilizationBp: null,
  };
}

export interface PrivateDockExpansionInput {
  readonly snapshot: CampaignSnapshot;
  readonly campaignMonth: string;
  readonly randomEngine: RandomEngine;
  readonly randomLedger: RandomLedger;
}

export interface PrivateDockExpansionTrigger {
  readonly nationId: string;
  readonly possessionId: string;
  readonly projectId: string;
}

export interface PrivateDockExpansionOutcome {
  readonly snapshot: CampaignSnapshot;
  readonly decisions: readonly RandomDecision[];
  readonly triggered: readonly PrivateDockExpansionTrigger[];
}

/**
 * DESIGN-16 section 6: resolve every nation's private dock-expansion opportunity for a month. Nations are processed in
 * ascending nation identifier order and possessions in ascending possession identifier order. An eligible nation draws
 * once on the keyed stream family `event/month/nation/private_dock_expansion`; every draw is recorded. A success
 * creates a NORMAL expansion project — never an immediate dock-size increase — and starts the `60`-month cooldown.
 */
export function resolvePrivateDockExpansion(
  input: PrivateDockExpansionInput,
): PrivateDockExpansionOutcome {
  const decisions: RandomDecision[] = [];
  const triggered: PrivateDockExpansionTrigger[] = [];
  const nations = new Map(input.snapshot["nations"]);
  const ordered = [...input.snapshot["nations"].entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  let changed = false;

  for (const [nationId, nation] of ordered) {
    const eligibility = privateDockExpansionEligibility(nation, input.campaignMonth);
    if (!eligibility.eligible || eligibility.possessionId === null) continue;
    const possessionId = eligibility.possessionId;
    const stepKg = dockExpansionEraStepForMonth(input.campaignMonth);
    if (stepKg === null) continue;

    const stream = input.randomEngine.stream(
      `${PRIVATE_DOCK_EXPANSION_STREAM_FAMILY}/${nationId}/${input.campaignMonth}/${possessionId}`,
    );
    const draw = Math.floor(stream.next() * 10_000);
    const fired = draw < PRIVATE_DOCK_EXPANSION_EVENT_WEIGHT_BP;
    const decision: RandomDecision = {
      streamId: PRIVATE_DOCK_EXPANSION_STREAM_FAMILY,
      entityKey: possessionId,
      phase: "appropriation",
      rulesetVersion: PRIVATE_DOCK_EXPANSION_EVENT_ID,
      inputHash: sha256Hex(
        canonicalSerialize({
          nationId,
          possessionId,
          campaignMonth: input.campaignMonth,
          trailingUtilizationBp: eligibility.trailingUtilizationBp,
        }),
      ),
      draw,
      outcome: fired ? PRIVATE_DOCK_EXPANSION_TRIGGERED : PRIVATE_DOCK_EXPANSION_NOT_TRIGGERED,
      reasonCode: fired ? PRIVATE_DOCK_EXPANSION_TRIGGERED : PRIVATE_DOCK_EXPANSION_NOT_TRIGGERED,
    };
    input.randomLedger.record(decision);
    decisions.push(decision);
    if (!fired) continue;

    const projectId = `private-dock-expansion-${nationId}-${possessionId}-${input.campaignMonth}`;
    const project = dockExpansionProjectFor({
      projectId,
      possessionId,
      authorizedMonth: input.campaignMonth,
      stepKg,
    });
    const state = nation["dockExpansion"];
    nations.set(nationId, {
      ...nation,
      constructionProjects: [...nation["constructionProjects"], project],
      ...(state === undefined
        ? {}
        : { dockExpansion: { ...state, lastOpportunityMonth: input.campaignMonth } }),
    });
    changed = true;
    triggered.push({ nationId, possessionId, projectId });
  }

  return {
    snapshot: changed ? { ...input.snapshot, nations } : input.snapshot,
    decisions,
    triggered,
  };
}
