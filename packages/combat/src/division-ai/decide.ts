import type { DivisionRole } from "@bluewave/campaign";
import { BluewaveError } from "@bluewave/contracts";
import type { DivisionOrder } from "../orders/contracts.js";
import type { DivisionAiDivision, DivisionAiView } from "./contracts.js";
import { decodeDivisionAiView } from "./contracts.js";
import { flotillaPlan } from "./flotilla.js";
import { nearestContact } from "./geometry.js";
import {
  DIVISION_AI_MEMORY_VERSION,
  createMemoryEntry,
  decodeDivisionAiMemory,
  sortMemoryEntries,
  type DivisionAiMemory,
  type DivisionAiMemoryEntry,
} from "./memory.js";
import { CORE_BEHAVIOUR, SUPPORT_BEHAVIOUR } from "./coreSupport.js";
import { INDEPENDENT_BEHAVIOUR, PATROL_BEHAVIOUR } from "./patrolIndependent.js";
import {
  awayPoint,
  createPlanContext,
  preset,
  waypoint,
  type DivisionDraft,
  type DivisionPlan,
  type PlanContext,
} from "./plan.js";
import { DIVISION_AI_PLAN_UNAVAILABLE, type DivisionAiMode } from "./reasonCodes.js";
import type { RoleBehaviour } from "./roleBehaviour.js";
import { PROVISIONAL_DIVISION_AI_RULES, type DivisionAiRules } from "./rules.js";
import { SCOUT_BEHAVIOUR, SCREEN_BEHAVIOUR } from "./scoutScreen.js";

export interface DivisionAiDecision {
  readonly orders: readonly DivisionOrder[];
  readonly memory: DivisionAiMemory;
  readonly reasons: Readonly<Record<string, DivisionAiMode>>;
}

const BEHAVIOURS: Readonly<Record<DivisionRole, RoleBehaviour>> = {
  CORE: CORE_BEHAVIOUR,
  SUPPORT: SUPPORT_BEHAVIOUR,
  SCOUT: SCOUT_BEHAVIOUR,
  SCREEN: SCREEN_BEHAVIOUR,
  PATROL: PATROL_BEHAVIOUR,
  INDEPENDENT: INDEPENDENT_BEHAVIOUR,
};

const URGENT_MODES: ReadonlySet<DivisionAiMode> = new Set([
  "MORALE_OPEN_RANGE",
  "MORALE_WITHDRAW",
  "FLOTILLA_ATTACK",
  "FLOTILLA_SELF_DEFENCE",
  "SCOUT_OPEN_RANGE",
  "SUPPORT_COUNTERATTACK_DD",
]);

const EXIT_FREE_MODES: ReadonlySet<DivisionAiMode> = new Set([
  "MORALE_OPEN_RANGE",
  "MORALE_WITHDRAW",
  "FLOTILLA_ATTACK",
  "FLOTILLA_SELF_DEFENCE",
]);

function moralePlan(ctx: PlanContext, division: DivisionAiDivision): DivisionPlan | null {
  if (ctx.tier === 0) return null;
  const foe = nearestContact(division.position, ctx.view.contacts);
  if (foe === null) return null;
  const withdraws = ctx.tier === 2 && (division.role !== "CORE" || !ctx.leadIsPlayer);
  const opensRange =
    ctx.tier === 1 && (division.role === "INDEPENDENT" || division.role === "PATROL");
  if (!withdraws && !opensRange) return null;
  return {
    mode: withdraws ? "MORALE_WITHDRAW" : "MORALE_OPEN_RANGE",
    navigation: waypoint(awayPoint(ctx, division, foe)),
    speed: preset(withdraws ? "SQUADRON_MAX" : "MAX_MINUS_2"),
    formation: division.formation,
  };
}

function holdsMode(
  ctx: PlanContext,
  entry: DivisionAiMemoryEntry,
  candidate: DivisionAiMode,
  behaviour: RoleBehaviour,
): DivisionAiMode | null {
  const held = entry.mode;
  if (held === null || held === candidate) return null;
  if (EXIT_FREE_MODES.has(held) || URGENT_MODES.has(candidate)) return null;
  if (!behaviour.modes.includes(held)) return null;
  const elapsed = ctx.view.minute - entry.modeSinceMinute;
  return elapsed < ctx.rules.minimumDwellMinutes ? held : null;
}

function planFor(
  ctx: PlanContext,
  division: DivisionAiDivision,
  entry: DivisionAiMemoryEntry,
  draft: DivisionDraft,
): DivisionPlan {
  const behaviour = BEHAVIOURS[division.role];
  const forced = moralePlan(ctx, division) ?? flotillaPlan(ctx, division);
  if (forced !== null) return forced;
  const candidate = behaviour.choose(ctx, division, draft);
  const held = holdsMode(ctx, entry, candidate, behaviour);
  const heldPlan = held === null ? null : behaviour.build(ctx, division, draft, held);
  const plan = heldPlan ?? behaviour.build(ctx, division, draft, candidate);
  if (plan === null) {
    throw new BluewaveError(DIVISION_AI_PLAN_UNAVAILABLE, {
      code: DIVISION_AI_PLAN_UNAVAILABLE,
      divisionId: division.divisionId,
      role: division.role,
      mode: candidate,
    });
  }
  return plan;
}

function toOrder(
  ctx: PlanContext,
  division: DivisionAiDivision,
  plan: DivisionPlan,
): DivisionOrder {
  return {
    divisionId: division.divisionId,
    navigation: plan.navigation,
    speed: plan.speed,
    formation: plan.formation,
    role: division.role,
    leadDivisionId: ctx.lead.divisionId,
    control: "AI",
    turnTogether: false,
    issuedAtMinute: ctx.view.minute,
  };
}

export function decideDivisionOrders(
  stateInput: DivisionAiView,
  memoryInput: DivisionAiMemory,
  rules: DivisionAiRules = PROVISIONAL_DIVISION_AI_RULES,
): DivisionAiDecision {
  const view = decodeDivisionAiView(stateInput);
  const memory = decodeDivisionAiMemory(memoryInput);
  const ctx = createPlanContext(view, rules);
  const known = new Map(memory.divisions.map((entry) => [entry.divisionId, entry]));
  const orders: DivisionOrder[] = [];
  const entries: DivisionAiMemoryEntry[] = [];
  const reasons: Record<string, DivisionAiMode> = {};
  const ordered = [...view.divisions].sort((a, b) => (a.divisionId < b.divisionId ? -1 : 1));

  for (const division of ordered) {
    if (division.control !== "AI" || division.divisionId === view.leadDivisionId) continue;
    const entry =
      known.get(division.divisionId) ?? createMemoryEntry(division.divisionId, view.minute);
    const draft: DivisionDraft = {
      supportSide: entry.supportSide,
      attacking: entry.attacking,
      patrolAnchor: entry.patrolAnchor,
      waypointIndex: entry.waypointIndex,
    };
    const plan = planFor(ctx, division, entry, draft);
    orders.push(toOrder(ctx, division, plan));
    reasons[division.divisionId] = plan.mode;
    entries.push({
      divisionId: division.divisionId,
      mode: plan.mode,
      modeSinceMinute: entry.mode === plan.mode ? entry.modeSinceMinute : view.minute,
      supportSide: draft.supportSide,
      attacking: draft.attacking,
      patrolAnchor: draft.patrolAnchor,
      waypointIndex: draft.waypointIndex,
    });
  }

  return {
    orders,
    memory: { version: DIVISION_AI_MEMORY_VERSION, divisions: sortMemoryEntries(entries) },
    reasons,
  };
}
