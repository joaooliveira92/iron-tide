import {
  isPresenceExempt,
  measurePresence,
  type CampaignSnapshot,
  type PresenceAreaRow,
  type PresenceMeasurementRules,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { presencePenaltyRequestEvent, presenceShortfallEvent } from "./events.js";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";

export type PresenceSnapshot = Pick<CampaignSnapshot, "nations" | "world" | "designs" | "wars">;

export function presenceDemand(
  snapshot: PresenceSnapshot,
  rules: PresenceMeasurementRules,
  campaignMonth: string,
): PresenceAreaRow[] {
  const demand: PresenceAreaRow[] = [];
  const exempt = new Map<string, boolean>();
  for (const row of measurePresence(snapshot, rules)) {
    if (row.shortfallTons === 0) continue;
    let isExempt = exempt.get(row.nationId);
    if (isExempt === undefined) {
      isExempt = isPresenceExempt(snapshot, row.nationId, campaignMonth);
      exempt.set(row.nationId, isExempt);
    }
    if (isExempt) continue;
    const nation = snapshot.nations.get(row.nationId);
    if (nation === undefined || (!nation["isPlayable"] && !nation["isAI"])) continue;
    demand.push(row);
  }
  return demand;
}

export function runPresenceMeasurementPhase(ctx: PhaseContext): PhaseRunOutcome {
  const rules = ctx.engineOptions?.presence;
  if (rules === undefined) return { status: "continue" };

  const demand = presenceDemand(ctx.snapshot.view(), rules, ctx.campaignMonth);
  for (const row of demand) {
    ctx.eventLedger.append(
      presenceShortfallEvent(
        row.nationId,
        row.areaId,
        SafeInt(row.requiredTons),
        SafeInt(row.presentTons),
        SafeInt(row.shortfallTons),
        ctx.nextSeq(),
        ctx.campaignMonth,
      ),
    );
    if (rules.penaltyRequests !== true) continue;
    for (const kind of ["PrestigeLossRequested", "RevoltPressureRequested"] as const) {
      ctx.eventLedger.append(
        presencePenaltyRequestEvent(
          kind,
          row.nationId,
          row.areaId,
          SafeInt(row.shortfallTons),
          ctx.nextSeq(),
          ctx.campaignMonth,
        ),
      );
    }
  }
  return { status: "continue" };
}

export const presenceMeasurementPhase: MonthPhase = {
  id: "presence_measurement",
  name: "Presence Measurement",
  permissions: {
    reads: ["nations", "world", "designs", "wars"],
    writes: [],
    rng: false,
  },
  run: runPresenceMeasurementPhase,
};
