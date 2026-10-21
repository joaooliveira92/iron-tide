// S-5 (spec #73 R5/R6/R8, ADR-0247): the month-end presence step. It runs after battle resolution, reads the snapshot and
// the optional presence ruleset section, and records one typed `PresenceShortfall` event per nation-area with a shortfall.
// A nation at war and blockaded is exempt (R7). With penalty parameters it also records typed prestige-loss and
// revolt-pressure requests. It mutates no state (S-2/S-3 own the consequences) and draws no randomness. With the section absent it does nothing.
import { isPresenceExempt, measurePresence, type PresenceAreaRow } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { presencePenaltyRequestEvent, presenceShortfallEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

/**
 * Returns the shortfall rows that count this month (non-exempt, positive), in (nation, area) order: the demand the
 * foreign-station deployment (ADR-0249) routes toward. Empty when the section is absent.
 */
export function runPresenceMeasurementStep(ctx: MonthContext): PresenceAreaRow[] {
  const rules = ctx.engineOptions?.presence;
  if (rules === undefined) return [];
  const demand: PresenceAreaRow[] = [];

  const snapshot = ctx.currentSnapshot;
  const exempt = new Map<string, boolean>();
  for (const row of measurePresence(snapshot, rules)) {
    if (row.shortfallTons === 0) continue;
    // R7: at war and blockaded, the requirement is suspended in every area (no shortfall, no penalty request).
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
