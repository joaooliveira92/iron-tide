import type { CampaignSnapshot } from "@bluewave/campaign";
import type { EventResolutionRules, GameEvent } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  MonthExecutor,
  unifiedSnapshotHash,
  type EventEngineContent,
} from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const PLAYER = "uk";
const SEED = "event-draw-cross-process-seed";
const MONTHS = 6;

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL cross-process fixture",
} as const;

const effects = { budgetBp: 0, unrest: 0 };

const incident: GameEvent = {
  id: "cross_process_incident",
  titleKey: "event.cross_process_incident.title",
  bodyKey: "event.cross_process_incident.body",
  gates: {},
  weightBp: 10_000,
  cooldownMonths: 24,
  once: false,
  defaultAnswerId: "protest",
  answers: [
    { id: "mobilise", stance: "hawk", labelKey: "event.a", effects },
    { id: "protest", stance: "dove", labelKey: "event.b", effects },
  ],
  provenance,
};

const evenWeights = { hawkBp: 4_000, doveBp: 4_000, neutralBp: 2_000 };

const rules: EventResolutionRules = {
  sectionVersion: 1,
  defaultAnswerAfterMonths: 3,
  aiStanceWeightsBp: {
    liberal_democracy: { hawkBp: 2_000, doveBp: 6_000, neutralBp: 2_000 },
    limited_democracy: evenWeights,
    autocratic: { hawkBp: 6_000, doveBp: 2_000, neutralBp: 2_000 },
    fascist: { hawkBp: 7_000, doveBp: 1_000, neutralBp: 2_000 },
    communist: evenWeights,
    eastern: evenWeights,
  },
  traitShifts: [],
  provenance,
};

interface MonthRecord {
  readonly month: number;
  readonly snapshotHash: string;
  readonly randomLedgerHash: string;
  readonly eventDraws: number;
  readonly playerPending: string | null;
  readonly playerFired: string;
  readonly aiFired: number;
}

function run(): readonly MonthRecord[] {
  const { state } = compileProductionCampaign();
  const events: EventEngineContent = { rules, catalogue: [incident] };
  let current: CampaignSnapshot = state.snapshot;
  const records: MonthRecord[] = [];
  for (let month = 1; month <= MONTHS; month += 1) {
    const result = new MonthExecutor().execute(
      current,
      [],
      SEED,
      new DiagnosticCollector(),
      undefined,
      { events, playerNationId: PLAYER },
    );
    const player = result.finalSnapshot.nations.get(PLAYER)!.eventHistory!;
    const aiFired = [...result.finalSnapshot.nations.values()]
      .filter((nation) => nation.id !== PLAYER)
      .reduce((sum, nation) => sum + (nation.eventHistory?.fired.length ?? 0), 0);
    records.push({
      month,
      snapshotHash: unifiedSnapshotHash(result.finalSnapshot),
      randomLedgerHash: result.randomLedger.hash(),
      eventDraws: result.randomLedger.all.filter((d) => d.streamId === "events").length,
      playerPending: player.pending?.eventId ?? null,
      playerFired: player.fired.map((r) => `${r.month}:${r.answerId}:${r.resolvedBy}`).join(","),
      aiFired,
    });
    current = {
      ...result.finalSnapshot,
      turnNumber: SafeInt(Number(current.turnNumber) + 1),
    };
  }
  return records;
}

try {
  process.stdout.write(JSON.stringify({ success: true, months: run() }) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ success: false, error: String(err) }) + "\n");
}
