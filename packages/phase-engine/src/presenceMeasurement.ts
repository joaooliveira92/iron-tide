import { isPresenceExempt, measurePresence, type PresenceAreaRow } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { presencePenaltyRequestEvent, presenceShortfallEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

export function runPresenceMeasurementStep(ctx: MonthContext): PresenceAreaRow[] {
  const rules = ctx.engineOptions?.presence;
  if (rules === undefined) return [];
  const demand: PresenceAreaRow[] = [];

  const snapshot = ctx.currentSnapshot;
  const exempt = new Map<string, boolean>();
  for (const row of measurePresence(snapshot, rules)) {
    if (row.shortfallTons === 0) continue;
    let isExempt = exempt.get(row.nationId);
    if (isExempt === undefined) {
      isExempt = isPresenceExempt(snapshot, row.nationId, ctx.campaignMonth);
      exempt.set(row.nationId, isExempt);
    }
    if (isExempt) continue;
    const nation = snapshot["nations"].get(row.nationId);
    if (nation === undefined || (!nation["isPlayable"] && !nation["isAI"])) continue;
    demand.push(row);
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
  return demand;
}
