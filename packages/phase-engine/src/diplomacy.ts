import type {
  BlockadeState,
  DiplomaticRelation,
  CampaignSnapshot,
  NationState,
  WarDeclaration,
  WarParticipantMembership,
} from "@bluewave/campaign";
import {
  applyExerciseTension,
  BLOCKADE_WAR_SCORE_PER_MONTH,
  NAP_VIOLATION_PENALTY,
  planTensionDrift,
  resolveTensionDriftStep,
  TENSION_DRIFT_DRAW_RANGE_BP,
  TENSION_DRIFT_STREAM_FAMILY,
  TENSION_PEACE,
  TENSION_WAR,
} from "@bluewave/campaign";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type {
  AcceptPeaceCommand,
  DeclareBlockadeCommand,
  DeclareWarCommand,
} from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

export function getPairRelation(snapshot: CampaignSnapshot, a: string, b: string) {
  const key = pairKey(a, b);
  return (
    snapshot["politics"]["relations"].find((r) => pairKey(r["nationA"], r["nationB"]) === key) ??
    null
  );
}

export function updateRelation(
  snapshot: CampaignSnapshot,
  a: string,
  b: string,
  patch: Partial<{
    relation: "neutral" | "allied" | "at_war" | "trade_agreement";
    tension: number;
    nap: boolean;
  }>,
): CampaignSnapshot {
  const key = pairKey(a, b);
  const relations = snapshot["politics"]["relations"].map((r) =>
    pairKey(r["nationA"], r["nationB"]) === key
      ? {
          ...r,
          ...patch,
          relation: patch["relation"] ?? r["relation"],
        }
      : r,
  );
  return {
    ...snapshot,
    politics: { ...snapshot["politics"], relations },
  };
}

export function applyDeclareWar(
  snapshot: CampaignSnapshot,
  body: DeclareWarCommand,
  campaignMonth: string,
): CampaignSnapshot {
  const declarer = body["nationId"];
  const target = body["targetNationId"];
  const warId = `war_${declarer}_${target}_${campaignMonth}`;
  const attackerSideId = `side_${declarer}`;
  const defenderSideId = `side_${target}`;

  const pair = getPairRelation(snapshot, declarer, target);
  let napPenaltyNations = snapshot["nations"];
  if (pair && pair["nap"]) {
    const current = snapshot["nations"].get(declarer);
    if (current) {
      const penalty = NAP_VIOLATION_PENALTY as number;
      const newTreasury = Math.max(0, (current["treasury"] as number) - penalty);
      const updatedNation: NationState = { ...current, treasury: SafeInt(newTreasury) };
      napPenaltyNations = new Map(snapshot["nations"]);
      napPenaltyNations.set(declarer, updatedNation);
    }
  }

  const war: WarDeclaration = {
    id: warId,
    attackerSideId,
    defenderSideId,
    attackerSideMembers: [declarer],
    defenderSideMembers: [target],
    attackerWarScore: 0,
    defenderWarScore: 0,
    attackerId: declarer,
    defenderId: target,
    startDate: campaignMonth,
    status: "DECLARED_NOT_ACTIVE",
  };

  const attackerMembership: WarParticipantMembership = {
    warId,
    nationId: declarer,
    sideId: attackerSideId,
    entryMonth: campaignMonth,
    status: "ACTIVE",
    nationalContributionPoints: 0,
  };
  const defenderMembership: WarParticipantMembership = {
    warId,
    nationId: target,
    sideId: defenderSideId,
    entryMonth: campaignMonth,
    status: "ACTIVE",
    nationalContributionPoints: 0,
  };

  let baseSnapshot = { ...snapshot, nations: napPenaltyNations };

  let next = {
    ...baseSnapshot,
    wars: {
      ...baseSnapshot["wars"],
      wars: [...baseSnapshot["wars"]["wars"], war],
      participantMemberships: [
        ...baseSnapshot["wars"]["participantMemberships"],
        attackerMembership,
        defenderMembership,
      ],
    },
  };

  next = updateRelation(next, declarer, target, {
    relation: "at_war",
    tension: TENSION_WAR,
    nap: false,
  });

  return next;
}

export function applyAcceptPeace(
  snapshot: CampaignSnapshot,
  body: AcceptPeaceCommand,
  campaignMonth: string,
): CampaignSnapshot {
  const war = snapshot["wars"]["wars"].find((w) => w["id"] === body["warId"]);
  if (!war) return snapshot;

  const wars = snapshot["wars"]["wars"].map((w) =>
    w["id"] === war["id"] ? { ...w, status: "ENDED" as const, endDate: campaignMonth } : w,
  );

  const participantMemberships = snapshot["wars"]["participantMemberships"].map((m) =>
    m["warId"] === war["id"] && m["status"] === "ACTIVE"
      ? { ...m, status: "EXITED" as const, exitMonth: campaignMonth }
      : m,
  );

  let next = {
    ...snapshot,
    wars: { ...snapshot["wars"], wars, participantMemberships },
  };

  next = updateRelation(next, war["attackerId"], war["defenderId"], {
    relation: "neutral",
    tension: TENSION_PEACE,
    nap: false,
  });

  return next;
}

export function applySetRelation(
  snapshot: CampaignSnapshot,
  nationId: string,
  partnerNationId: string,
  relation: "allied" | "neutral",
  tension: number,
): CampaignSnapshot {
  return updateRelation(snapshot, nationId, partnerNationId, { relation, tension });
}

export function applySetNap(
  snapshot: CampaignSnapshot,
  nationId: string,
  partnerNationId: string,
  nap: boolean,
): CampaignSnapshot {
  return updateRelation(snapshot, nationId, partnerNationId, { nap, tension: TENSION_PEACE });
}

export function applyDeclareBlockade(
  snapshot: CampaignSnapshot,
  body: DeclareBlockadeCommand,
  campaignMonth: string,
): CampaignSnapshot {
  const blockade: BlockadeState = {
    blockaderId: body["nationId"],
    blockadedNationId: body["targetNationId"],
    areaId: body["areaId"],
    establishedMonth: campaignMonth,
  };
  return {
    ...snapshot,
    wars: {
      ...snapshot["wars"],
      blockadeState: [...snapshot["wars"]["blockadeState"], blockade],
    },
  };
}

export function resolveDiplomacyWars(
  state: CampaignSnapshot["wars"],
  campaignMonth: string,
): CampaignSnapshot["wars"] {
  let wars = state["wars"];
  let changed = false;

  const atWarWars = new Set(wars.filter((w) => w["status"] !== "ENDED").map((w) => w["id"]));

  for (const blockade of state["blockadeState"]) {
    if (blockade["establishedMonth"] > campaignMonth) continue;
    const war = wars.find(
      (w) =>
        atWarWars.has(w["id"]) &&
        (w["status"] === "ACTIVE" || w["status"] === "DECLARED_NOT_ACTIVE") &&
        w["attackerSideMembers"].includes(blockade["blockaderId"]),
    );
    if (!war) continue;
    const side = war["attackerSideMembers"].includes(blockade["blockaderId"])
      ? "attacker"
      : "defender";
    const gain = BLOCKADE_WAR_SCORE_PER_MONTH as number;
    const increment = (current: number) => Math.max(-100, Math.min(100, current + gain));
    const updated =
      side === "attacker"
        ? { ...war, attackerWarScore: increment(war["attackerWarScore"] as number) }
        : { ...war, defenderWarScore: increment(war["defenderWarScore"] as number) };
    wars = wars.map((w) => (w["id"] === war["id"] ? updated : w));
    changed = true;
  }

  if (!changed) return state;
  return { ...state, wars };
}

export function countActiveWarsFor(snapshot: CampaignSnapshot, nationId: string): number {
  return snapshot["wars"]["wars"].filter(
    (w) =>
      w["status"] !== "ENDED" &&
      (w["attackerSideMembers"].includes(nationId) || w["defenderSideMembers"].includes(nationId)),
  ).length;
}

export function settleWar(
  snapshot: CampaignSnapshot,
  warId: string,
  campaignMonth: string,
): CampaignSnapshot {
  const war = snapshot["wars"]["wars"].find((w) => w["id"] === warId);
  if (!war) return snapshot;
  const wars = snapshot["wars"]["wars"].map((w) =>
    w["id"] === warId ? { ...w, status: "ENDED" as const, endDate: campaignMonth } : w,
  );
  const participantMemberships = snapshot["wars"]["participantMemberships"].map((m) =>
    m["warId"] === warId && m["status"] === "ACTIVE"
      ? { ...m, status: "EXITED" as const, exitMonth: campaignMonth }
      : m,
  );
  let next = {
    ...snapshot,
    wars: { ...snapshot["wars"], wars, participantMemberships },
  };
  next = updateRelation(next, war["attackerId"], war["defenderId"], {
    relation: "neutral",
    tension: TENSION_PEACE,
    nap: false,
  });
  return next;
}

function applyExerciseTensionForMonth(ctx: PhaseContext): void {
  const rules = ctx.fleetManagement?.exercise.tension;
  if (rules === undefined) return;
  const relations = ctx.snapshot.read("politics")["relations"];
  let next: readonly DiplomaticRelation[] = relations;
  for (const [nationId, nation] of [...ctx.snapshot.read("nations")].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const record = nation["fleetExercise"];
    if (record === undefined || record.month !== ctx.campaignMonth) continue;
    next = applyExerciseTension(next, nationId, record.shipIds.length, rules);
  }
  if (next === relations) return;
  ctx.snapshot.write("politics", {
    ...ctx.snapshot.read("politics"),
    relations: [...next],
  });
}

function navalBudgetOf(nations: ReadonlyMap<string, NationState>, nationId: string): number {
  const nation = nations.get(nationId);
  if (nation === undefined) return 0;
  return Math.floor((Number(nation.income) * Number(nation.navalAppropriationRateBp)) / 10_000);
}

function applyTensionDriftForMonth(ctx: PhaseContext): void {
  const rules = ctx.engineOptions?.tensionDrift;
  if (rules === undefined) return;
  const nations = ctx.snapshot.read("nations");
  const politics = ctx.snapshot.read("politics");
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const relations = [...politics.relations];
  let changed = false;

  const order = relations
    .map((relation, index) => ({
      relation,
      index,
      key: pairKey(relation.nationA, relation.nationB),
    }))
    .sort((a, b) => compareCodePoints(a.key, b.key));

  for (const { relation, index, key } of order) {
    const plan = planTensionDrift(
      {
        relation: relation.relation,
        tension: relation.tension,
        frictionBp: relation.frictionBp ?? 0,
        navalBudgetA: navalBudgetOf(nations, relation.nationA),
        navalBudgetB: navalBudgetOf(nations, relation.nationB),
      },
      rules,
    );
    if (plan.riseReason === undefined && plan.coolingReason === undefined) continue;

    const entityKey = key.replace("\u0000", "|");
    const draw = Math.floor(
      engine.stream(`${TENSION_DRIFT_STREAM_FAMILY}/${entityKey}/${ctx.campaignMonth}`).next() *
        TENSION_DRIFT_DRAW_RANGE_BP,
    );
    const step = resolveTensionDriftStep(plan, relation.tension, draw);
    ctx.randomLedger.record({
      streamId: TENSION_DRIFT_STREAM_FAMILY,
      entityKey,
      phase: "resolve_diplomacy",
      rulesetVersion,
      inputHash: sha256Hex(
        canonicalSerialize({
          pair: entityKey,
          campaignMonth: ctx.campaignMonth,
          relation: relation.relation,
          tension: relation.tension,
          plan,
        }),
      ),
      draw,
      outcome: step.delta > 0 ? "RISE" : step.delta < 0 ? "COOL" : "HOLD",
      reasonCode: step.reasonCode,
    });
    if (step.delta === 0) continue;
    relations[index] = { ...relation, tension: relation.tension + step.delta };
    changed = true;
  }

  if (!changed) return;
  ctx.snapshot.write("politics", { ...politics, relations });
}

export function runDiplomacyPhase(ctx: PhaseContext): PhaseRunOutcome {
  const wars = ctx.snapshot.read("wars");
  const next = resolveDiplomacyWars(wars, ctx.campaignMonth);
  if (next !== wars) ctx.snapshot.write("wars", next);
  applyExerciseTensionForMonth(ctx);
  applyTensionDriftForMonth(ctx);
  return { status: "continue" };
}

export const diplomacyPhase: MonthPhase = {
  id: "resolve_diplomacy",
  name: "Diplomacy Resolution",
  permissions: {
    reads: ["wars", "nations", "politics", "rulesetVersion"],
    writes: ["wars", "politics"],
    rng: true,
  },
  run: runDiplomacyPhase,
};
