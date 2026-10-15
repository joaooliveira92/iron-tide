// packages/phase-engine/src/aiProcurement.ts
// Phase 3.6: ai_procurement — the live AI naval procurement lifecycle (ADR-0091). For each AI nation with a
// NationNavalProfile it plans a procurement decision, submits it as a design study through the same command/study
// boundaries the player uses, and — once the study approves the design — places an order through the authoritative
// placeConstructionOrder policy. It never writes designs, studies or projects directly, and it never duplicates a
// study or an order for the same unresolved deficit.
import type { CampaignSnapshot, NationState, ProcurementIntent } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { CommandIdempotencyMap, type SubmitDesignCommand } from "@bluewave/commands";
import { AiCommandGenerator } from "@bluewave/ai";
import {
  assessFleet,
  chooseProcurementRole,
  compileDesign,
  computeFleetDeficits,
  HULL_TYPE_FOR_SHIP_TYPE,
  planProcurementDecision,
  roleGroupOf,
  shipTypeForHullType,
  type DesignDraft,
  type FleetShipView,
  type NationNavalProfile,
  type RoleGroup,
  type ShipBuildingContent,
  type ShipTypeId,
} from "@bluewave/ship-design";
import { applySubmitDesign } from "./commands.js";
import { placeConstructionOrder } from "./constructionOrder.js";
import type { MonthContext } from "./monthContext.js";

/** Named, configurable procurement policy constants (ADR-0091 §5, §6, §7). */
export const AI_PROCUREMENT = {
  /** Keep this share of the treasury in reserve when computing a planning affordability ceiling. */
  RESERVE_BP: 2000,
  /** Bounded retries after a rejected study submission. */
  MAX_ATTEMPTS: 3,
  /** An approved-but-unaffordable intent expires after this many months. */
  APPROVED_EXPIRY_MONTHS: 12,
} as const;

export type { RoleGroup };
const ACTIVE_STATUSES: readonly ProcurementIntent["status"][] = [
  "PLANNED",
  "STUDY_SUBMITTED",
  "STUDY_IN_PROGRESS",
  "APPROVED",
];

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1);

/** The fleet as the assessment sees it, including AI commitments so deficits are not double-procured. */
export function fleetViewForNation(
  snapshot: CampaignSnapshot,
  nation: NationState,
): FleetShipView[] {
  const view: FleetShipView[] = [];
  const typeOfDesign = (designVersionId: string): ShipTypeId | null => {
    const hullType = snapshot["designs"].get(designVersionId)?.["hullType"];
    return hullType === undefined ? null : shipTypeForHullType(hullType);
  };
  for (const fleet of nation.fleets)
    for (const ship of fleet.ships) {
      const type = typeOfDesign(ship.designVersionId);
      if (type === null) continue;
      if (ship.isUnderConstruction) view.push({ shipType: type, status: "BUILDING" });
      else if (ship.availability !== undefined)
        view.push({ shipType: type, status: "UNAVAILABLE" });
      else view.push({ shipType: type, status: "ACTIVE" });
    }
  for (const project of nation.constructionProjects) {
    if (project.projectType !== "NEW_CONSTRUCTION" || project.status === "COMPLETED") continue;
    const type = typeOfDesign(project.designVersionId);
    if (type !== null) view.push({ shipType: type, status: "BUILDING" });
  }
  // Open procurement intents are commitments: an approved design awaiting an order or a study in flight.
  for (const intent of nation.procurementIntents ?? [])
    if (ACTIVE_STATUSES.includes(intent.status))
      view.push({ shipType: intent.role as ShipTypeId, status: "BUILDING" });
  return view;
}

function setNation(ctx: MonthContext, nationId: string, next: NationState): void {
  const nations = new Map(ctx.currentSnapshot["nations"]);
  nations.set(nationId, next);
  ctx.currentSnapshot = { ...ctx.currentSnapshot, nations };
}

const info = (ctx: MonthContext, code: string, message: string, entityId: string): void => {
  ctx.collector.addInfo(code, message, { stage: "ai_procurement", entityId });
};

const freshGenerator = (ctx: MonthContext): AiCommandGenerator =>
  new AiCommandGenerator({
    campaignId: ctx.currentSnapshot["campaignId"],
    turnNumber: ctx.turnNumber,
    expectedSnapshotHash: sha256Hex(canonicalSerialize(ctx.currentSnapshot)),
  });

/**
 * Run one month of AI procurement for every AI nation that has a naval profile. Deterministic and idempotent:
 * re-running it for the same snapshot and seed produces the same intents, studies and orders.
 */
export function runAiProcurementPhase(ctx: MonthContext): void {
  const content = ctx.engineOptions?.shipBuilding;
  if (content === undefined || content.navalProfiles.length === 0) return;
  if (ctx.phaseGuard.rng("ai_procurement", ctx.randomSeed) === null) return; // fail closed without an RNG

  const idempotency = new CommandIdempotencyMap();
  const nations = [...ctx.currentSnapshot["nations"].values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const nation of nations) {
    if (!nation.isAI) continue;
    if (content.navalProfileFor(nation.id, ctx.campaignMonth) === null) continue;
    // Procurement is best-effort and must never abort a month: any unexpected error is recorded as a structured
    // deferral so the rest of the month pipeline (and the app) keeps running.
    try {
      processNation(ctx, nation.id, ctx.campaignMonth, content, idempotency);
    } catch (e) {
      info(
        ctx,
        "AI_PROCUREMENT_DEFERRED",
        `procurement error: ${e instanceof Error ? e.message : String(e)}`,
        nation.id,
      );
    }
  }
}

function processNation(
  ctx: MonthContext,
  nationId: string,
  month: string,
  content: ShipBuildingContent,
  idempotency: CommandIdempotencyMap,
): void {
  const profile = content.navalProfileFor(nationId, month);
  if (profile === null) return;
  const slot = ctx.slots.find((s) => s["nationId"] === nationId);
  if (slot === undefined) return;

  const start = ctx.currentSnapshot["nations"].get(nationId);
  if (start === undefined) return;
  const advanced: ProcurementIntent[] = [];
  for (const intent of start.procurementIntents ?? []) {
    // Re-fetch the nation each iteration: an earlier intent may have mutated the snapshot.
    const nation = ctx.currentSnapshot["nations"].get(nationId)!;
    advanced.push(advanceIntent(ctx, intent, content, month, nation));
  }
  let intents = advanced;

  // Plan a new intent only when no active intent occupies its role group and deficits remain.
  const current = ctx.currentSnapshot["nations"].get(nationId)!;
  const fleet = fleetViewForNation(ctx.currentSnapshot, current);
  const deficits = computeFleetDeficits(profile, assessFleet(fleet));
  const activeGroups = new Set(
    intents
      .filter((i) => ACTIVE_STATUSES.includes(i.status))
      .map((i) => roleGroupOf(i.role as ShipTypeId)),
  );
  const role = chooseProcurementRole(profile, deficits);
  if (role !== null && !activeGroups.has(roleGroupOf(role))) {
    const planned = planNewIntent(ctx, nationId, role, profile, content, month, idempotency, fleet);
    if (planned !== null) intents = [...intents, planned];
  }

  const latest = ctx.currentSnapshot["nations"].get(nationId)!;
  setNation(ctx, nationId, { ...latest, procurementIntents: [...intents] });
}

/** Update one intent for the current month. */
function advanceIntent(
  ctx: MonthContext,
  initial: ProcurementIntent,
  content: ShipBuildingContent,
  month: string,
  nation: NationState,
): ProcurementIntent {
  let intent = initial;
  if (intent.status === "STUDY_SUBMITTED" || intent.status === "STUDY_IN_PROGRESS") {
    const study = (nation.designStudies ?? []).find(
      (s) => s.designStudyId === intent.designStudyId,
    );
    const design = ctx.currentSnapshot["designs"].get(intent.submittedDesignId ?? "");
    if (study !== undefined && study.status === "COMPLETED" && design !== undefined) {
      info(
        ctx,
        "AI_DESIGN_STUDY_APPROVED",
        `${intent.role} study approved (${study.designStudyId})`,
        nation.id,
      );
      // Fall through to the order path: approval and ordering may happen in the same month.
      intent = { ...intent, status: "APPROVED", lastUpdatedAtMonth: month, reason: null };
    } else if (study === undefined && design === undefined) {
      info(ctx, "AI_PROCUREMENT_EXPIRED", `${intent.role} study missing after reload`, nation.id);
      return { ...intent, status: "EXPIRED", lastUpdatedAtMonth: month, reason: "study_missing" };
    } else {
      return { ...intent, status: "STUDY_IN_PROGRESS", lastUpdatedAtMonth: month };
    }
  }

  if (intent.status !== "APPROVED") return intent;

  const design = ctx.currentSnapshot["designs"].get(intent.submittedDesignId ?? "");
  if (design === undefined) {
    info(ctx, "AI_PROCUREMENT_EXPIRED", `${intent.role} approved design missing`, nation.id);
    return { ...intent, status: "EXPIRED", lastUpdatedAtMonth: month, reason: "design_missing" };
  }
  if (design.nationId !== nation.id) {
    info(ctx, "AI_PROCUREMENT_CANCELLED", `${intent.role} design not owned`, nation.id);
    return {
      ...intent,
      status: "CANCELLED",
      lastUpdatedAtMonth: month,
      reason: "ownership_mismatch",
    };
  }
  const profile = content.navalProfileFor(nation.id, month)!;
  const fleet = fleetViewForNation(ctx.currentSnapshot, nation);
  const deficits = computeFleetDeficits(profile, assessFleet(fleet));
  if ((deficits[intent.role as ShipTypeId] ?? 0) <= 0) {
    info(ctx, "AI_PROCUREMENT_CANCELLED", `${intent.role} deficit already satisfied`, nation.id);
    return {
      ...intent,
      status: "CANCELLED",
      lastUpdatedAtMonth: month,
      reason: "deficit_satisfied",
    };
  }
  const draft = design.sourceDraft as DesignDraft | undefined;
  if (
    draft !== undefined &&
    !compileDesign(draft, content.environmentFor(month, nation.id).ctx).valid
  ) {
    info(ctx, "AI_PROCUREMENT_CANCELLED", `${intent.role} design no longer legal`, nation.id);
    return { ...intent, status: "CANCELLED", lastUpdatedAtMonth: month, reason: "design_illegal" };
  }
  if (
    monthIndex(month) - monthIndex(intent.createdAtMonth) >=
    AI_PROCUREMENT.APPROVED_EXPIRY_MONTHS
  ) {
    info(ctx, "AI_PROCUREMENT_EXPIRED", `${intent.role} approved for too long unbuilt`, nation.id);
    return {
      ...intent,
      status: "EXPIRED",
      lastUpdatedAtMonth: month,
      reason: "unaffordable_timeout",
    };
  }

  const [year, mon] = month.split("-");
  const result = placeConstructionOrder(
    ctx.currentSnapshot,
    {
      nationId: nation.id,
      commandId: `ai-ord-${intent.procurementDecisionId}`,
      designVersionId: intent.submittedDesignId!,
      month: { month: Number(mon), year: Number(year) },
    },
    content,
  );
  if (result.ok) {
    ctx.currentSnapshot = result.snapshot;
    info(
      ctx,
      "AI_CONSTRUCTION_ORDER_PLACED",
      `${intent.role} ordered (${result.project.id})`,
      nation.id,
    );
    return {
      ...intent,
      status: "ORDER_PLACED",
      constructionProjectId: result.project.id,
      lastUpdatedAtMonth: month,
      reason: null,
    };
  }
  info(
    ctx,
    "AI_PROCUREMENT_DEFERRED",
    `${intent.role} order deferred: ${result.reason}`,
    nation.id,
  );
  return { ...intent, lastUpdatedAtMonth: month, reason: `deferred:${result.reason}` };
}

/** Plan and submit a new design study for a role; returns the intent, or null when nothing was submitted. */
function planNewIntent(
  ctx: MonthContext,
  nationId: string,
  role: ShipTypeId,
  profile: NationNavalProfile,
  content: ShipBuildingContent,
  month: string,
  idempotency: CommandIdempotencyMap,
  fleet: FleetShipView[],
): ProcurementIntent | null {
  const nation = ctx.currentSnapshot["nations"].get(nationId)!;
  const priorAttempts = (nation.procurementIntents ?? []).filter(
    (i) =>
      i.role === role &&
      (i.status === "REJECTED" || i.status === "CANCELLED" || i.status === "EXPIRED"),
  ).length;
  const attempt = priorAttempts + 1;
  if (attempt > AI_PROCUREMENT.MAX_ATTEMPTS) return null;

  const decisionId = `${nationId}:${String(ctx.turnNumber)}:${role}:${String(attempt)}`;
  const decisionSeed = `${ctx.randomSeed}:procurement:${decisionId}`;
  const budgetCeiling = Math.max(
    0,
    Math.floor((Number(nation.treasury) * (10_000 - AI_PROCUREMENT.RESERVE_BP)) / 10_000),
  );
  const recentClassIds = (nation.procurementIntents ?? []).map((i) => i.candidateDesignId);

  const decision = planProcurementDecision({
    profile,
    month,
    seed: decisionSeed,
    decisionId,
    budgetUnits: budgetCeiling,
    fleet,
    content,
    starters: content.starterDesigns,
    recentClassIds,
  });
  if (decision.selectedDraft === null || decision.role === null) {
    info(
      ctx,
      "AI_PROCUREMENT_DEFERRED",
      `${role} not procured: ${decision.noProcurementReason ?? "no_candidate"}`,
      nationId,
    );
    return null;
  }

  const slugRole = role.toLowerCase();
  const designVersionId =
    `des_ai_${nationId}_${String(ctx.turnNumber)}_${slugRole}_${String(attempt)}`.slice(0, 64);
  const draft = decision.selectedDraft;
  const command = freshGenerator(ctx).buildSubmitDesignCommand(nationId, decisionId, {
    designVersionId,
    designFamilyId: `fam_${designVersionId}`.slice(0, 64),
    className: `AI ${role} ${String(ctx.turnNumber)}`,
    hullType: HULL_TYPE_FOR_SHIP_TYPE[role as keyof typeof HULL_TYPE_FOR_SHIP_TYPE],
    machineryType: draft.machinery.plantId,
    draft,
  });
  // Same boundary the player uses: validate the command, then apply it through the shared applier.
  const slot = ctx.slots.find((s) => s["nationId"] === nationId)!;
  const outcome = ctx.lifecycle.process(command, ctx.currentSnapshot, slot, idempotency);
  if (outcome.type !== "success") {
    const reason =
      (outcome as { diagnostic?: { message?: string } }).diagnostic?.message ?? outcome.type;
    info(ctx, "AI_DESIGN_STUDY_REJECTED", `${role} submission rejected: ${reason}`, nationId);
    return rejectedIntent(
      nationId,
      role,
      decisionId,
      decisionSeed,
      budgetCeiling,
      month,
      attempt,
      reason,
    );
  }
  const before = ctx.currentSnapshot;
  const next = applySubmitDesign(
    before,
    command.body as SubmitDesignCommand,
    content,
    month,
    ctx.collector,
  );
  if (next === before)
    return rejectedIntent(
      nationId,
      role,
      decisionId,
      decisionSeed,
      budgetCeiling,
      month,
      attempt,
      "study_submit_rejected",
    );
  ctx.currentSnapshot = next;
  info(ctx, "AI_DESIGN_STUDY_SUBMITTED", `${role} study submitted (${designVersionId})`, nationId);
  return {
    procurementDecisionId: decisionId,
    nationId,
    role,
    shipType: role,
    candidateDesignId: decision.selectedDesignId ?? designVersionId,
    submittedDesignId: designVersionId,
    designStudyId: `study_${designVersionId}`,
    constructionProjectId: null,
    status: "STUDY_SUBMITTED",
    attemptNumber: attempt,
    createdAtMonth: month,
    lastUpdatedAtMonth: month,
    budgetCeiling: SafeInt(budgetCeiling),
    dockRequirement: null,
    decisionSeed,
    reason: null,
  };
}

function rejectedIntent(
  nationId: string,
  role: ShipTypeId,
  decisionId: string,
  decisionSeed: string,
  budgetCeiling: number,
  month: string,
  attempt: number,
  reason: string,
): ProcurementIntent {
  return {
    procurementDecisionId: decisionId,
    nationId,
    role,
    shipType: role,
    candidateDesignId: decisionId,
    submittedDesignId: null,
    designStudyId: null,
    constructionProjectId: null,
    status: "REJECTED",
    attemptNumber: attempt,
    createdAtMonth: month,
    lastUpdatedAtMonth: month,
    budgetCeiling: SafeInt(budgetCeiling),
    dockRequirement: null,
    decisionSeed,
    reason,
  };
}
