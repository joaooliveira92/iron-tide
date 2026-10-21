// S-5 (spec #73 R5/R6/R8, ADR-0247): the month-end presence step. It runs after battle resolution, reads the snapshot and
// the optional presence ruleset section, and records one typed `PresenceShortfall` event per nation-area with a shortfall.
// It mutates no state (S-2/S-3 own the consequences) and draws no randomness. With the section absent it does nothing.
import { measurePresence } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { presenceShortfallEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

export function runPresenceMeasurementStep(ctx: MonthContext): void {
  const rules = ctx.engineOptions?.presence;
  if (rules === undefined) return;

  const snapshot = ctx.currentSnapshot;
  for (const row of measurePresence(snapshot, rules)) {
    if (row.shortfallTons === 0) continue;
    const nation = snapshot["nations"].get(row.nationId);
    if (nation === undefined || (!nation["isPlayable"] && !nation["isAI"])) continue;
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
  }
}
