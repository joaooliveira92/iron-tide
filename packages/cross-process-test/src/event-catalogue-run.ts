import type { CampaignSnapshot } from "@bluewave/campaign";
import { eventResolutionFromRulesets, tensionDriftFromRulesets } from "@bluewave/content-compiler";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Data } from "effect";
import {
  MonthExecutor,
  unifiedSnapshotHash,
  type EventEngineContent,
  type MonthExecutorEngineOptions,
} from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

export const EVENT_RUN_PLAYER = "uk";

export class EventCatalogueRunError extends Data.TaggedError("EventCatalogueRunError")<{
  readonly detail: string;
}> {}

export interface EventRunMonth {
  readonly month: number;
  readonly snapshotHash: string;
  readonly randomLedgerHash: string;
  readonly eventDraws: number;
  readonly pending: readonly string[];
  readonly oldestPendingAge: number;
}

export interface EventRunFired {
  readonly nationId: string;
  readonly eventId: string;
  readonly month: string;
  readonly answerId: string;
  readonly resolvedBy: string;
}

export interface EventRun {
  readonly months: readonly EventRunMonth[];
  readonly fired: readonly EventRunFired[];
  readonly contentHash: string;
  readonly catalogueSize: number;
  readonly nationIds: readonly string[];
  readonly careerEndedMonth: number | null;
}

function monthIndex(label: string): number {
  const [year, month] = label.split("-").map(Number);
  return year! * 12 + month!;
}

const START_MONTH_INDEX = monthIndex("1880-01");

export function runEventCatalogue(seed: string, monthCount: number): EventRun {
  const { state, bundle, contentHash } = compileProductionCampaign();
  const resolution = eventResolutionFromRulesets(bundle.rulesets);
  if (resolution === undefined || !resolution.ok) {
    throw new EventCatalogueRunError({ detail: "eventResolution is missing or invalid" });
  }
  const catalogue = bundle.campaign?.events ?? [];
  const events: EventEngineContent = { rules: resolution.value, catalogue };
  const drift = tensionDriftFromRulesets(bundle.rulesets);
  const constructionEvents = bundle.campaign?.constructionEvents;
  const options: MonthExecutorEngineOptions = {
    events,
    playerNationId: EVENT_RUN_PLAYER,
    ...(drift !== undefined && drift.ok ? { tensionDrift: drift.value } : {}),
    ...(constructionEvents !== undefined ? { constructionEvents } : {}),
  };
  let current: CampaignSnapshot = state.snapshot;
  const months: EventRunMonth[] = [];
  const fired: EventRunFired[] = [];
  const seen = new Set<string>();
  const nationIds = [...current.nations.keys()].sort();
  let careerEndedMonth: number | null = null;
  for (let month = 1; month <= monthCount; month += 1) {
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(current, [], seed, collector, undefined, options);
    if (result.outcome === "career_ended") {
      careerEndedMonth = month;
      break;
    }
    if (result.outcome !== "completed") {
      throw new EventCatalogueRunError({
        detail: `month ${month} ended '${result.outcome}': ${collector.all
          .slice(0, 3)
          .map((d) => `${String(d.code)} ${d.message}`)
          .join("; ")}`,
      });
    }
    const pending: string[] = [];
    let oldestPendingAge = 0;
    const now = START_MONTH_INDEX + month - 1;
    for (const nation of result.finalSnapshot.nations.values()) {
      for (const record of nation.eventHistory?.fired ?? []) {
        const key = `${nation.id}/${record.eventId}/${record.month}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fired.push({
          nationId: nation.id,
          eventId: record.eventId,
          month: record.month,
          answerId: record.answerId,
          resolvedBy: record.resolvedBy,
        });
      }
      const open = nation.eventHistory?.pending;
      if (open === undefined) continue;
      pending.push(`${nation.id}:${open.eventId}`);
      oldestPendingAge = Math.max(oldestPendingAge, now - monthIndex(open.drawnMonth));
    }
    months.push({
      month,
      snapshotHash: unifiedSnapshotHash(result.finalSnapshot),
      randomLedgerHash: result.randomLedger.hash(),
      eventDraws: result.randomLedger.all.filter((d) => d.streamId === "events").length,
      pending: pending.sort(),
      oldestPendingAge,
    });
    current = {
      ...result.finalSnapshot,
      turnNumber: SafeInt(Number(current.turnNumber) + 1),
    };
  }
  return {
    months,
    fired,
    contentHash,
    catalogueSize: catalogue.length,
    nationIds,
    careerEndedMonth,
  };
}
