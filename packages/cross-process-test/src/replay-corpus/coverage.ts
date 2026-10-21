import type { MonthResult } from "@bluewave/phase-engine";

import { executeScenario, type ReplayScenario } from "./corpus.js";

/**
 * The authoritative subsystems a replay can exercise: the month executor's phases, in execution
 * order (ADR-0246 Finding A). Using the phases keeps the catalogue tied to the engine's own
 * boundaries instead of a hand-kept list of gameplay features.
 */
export const SUBSYSTEMS = [
  { id: "opening_validation", label: "Opening validation" },
  { id: "weather_generation", label: "Weather generation" },
  { id: "monthly_revenue", label: "Monthly revenue" },
  { id: "command_collection", label: "Command collection" },
  { id: "ai_planning", label: "AI planning" },
  { id: "ai_procurement", label: "AI procurement" },
  { id: "appropriation", label: "Appropriation" },
  { id: "maintenance", label: "Maintenance and readiness" },
  { id: "obligation", label: "Obligations" },
  { id: "construction_processing", label: "Construction" },
  { id: "resolve_diplomacy", label: "Diplomacy" },
  { id: "resolve_research", label: "Research" },
  { id: "resolve_aircraft_development", label: "Aircraft development" },
  { id: "resolve_carrier_operations", label: "Carrier operations" },
  { id: "battle_generation", label: "Battle generation" },
  { id: "battle_resolution", label: "Battle resolution" },
  { id: "closing_validation", label: "Closing validation" },
] as const;

/**
 * Domain event types that identify the phase which emitted them. `NationBudgetChanged` is left
 * out on purpose: every spending phase emits it, and the financial ledger names the phase.
 */
const EVENT_SUBSYSTEM: Readonly<Record<string, string>> = {
  ConstructionProgressed: "construction_processing",
  ConstructionDelayed: "construction_processing",
  ConstructionProjectCancelled: "construction_processing",
  ShipRebuilt: "construction_processing",
  ShipReadinessChanged: "maintenance",
  ResearchProgressed: "resolve_research",
  TechnologyDiscovered: "resolve_research",
  ShipStationAssignmentChanged: "command_collection",
  PresenceShortfall: "battle_resolution",
};

const NEUTRAL_EVENT_TYPES: ReadonlySet<string> = new Set(["NationBudgetChanged"]);

const KNOWN = new Set<string>(SUBSYSTEMS.map((s) => s.id));

/** What one executed month left in the ledgers, attributed to subsystems. */
export interface MonthCoverage {
  readonly subsystems: ReadonlySet<string>;
  /** Event types that are neither attributed nor declared neutral: a gap in this mapping. */
  readonly unattributedEventTypes: ReadonlySet<string>;
}

/**
 * A subsystem is exercised when it leaves a trace: a financial transaction, a random draw, a
 * command, or an attributed event. A phase that ran but wrote nothing is reported uncovered,
 * because the corpus cannot tell a no-op from a skipped phase.
 */
export function monthCoverage(result: MonthResult): MonthCoverage {
  const subsystems = new Set<string>();
  const unattributed = new Set<string>();
  const add = (id: string) => {
    if (KNOWN.has(id)) subsystems.add(id);
  };
  for (const entry of result.financialLedger.all) add(entry.phaseId);
  for (const entry of result.randomLedger.all) add(entry.phase);
  if (result.commandLedger.all.length > 0) add("command_collection");
  for (const entry of result.eventLedger.all) {
    const type = entry.eventType;
    const subsystem = EVENT_SUBSYSTEM[type];
    if (subsystem !== undefined) add(subsystem);
    else if (!NEUTRAL_EVENT_TYPES.has(type)) unattributed.add(type);
  }
  return { subsystems, unattributedEventTypes: unattributed };
}

/** A corpus scenario: a command-free production run plus why it is in the corpus. */
export interface CorpusScenario extends ReplayScenario {
  /** One short sentence: what this replay protects that the others do not. */
  readonly purpose: string;
}

export interface ReplayCoverage {
  readonly scenarioId: string;
  readonly purpose: string;
  readonly months: number;
  /** Catalogue order. */
  readonly subsystems: readonly string[];
}

export interface CoverageReport {
  readonly replays: readonly ReplayCoverage[];
  /** Catalogue subsystems no replay exercised, in catalogue order. */
  readonly uncovered: readonly string[];
  readonly unattributedEventTypes: readonly string[];
}

/** Re-execute each scenario through the real engine and report the subsystems it exercised. */
export function buildCoverageReport(scenarios: readonly CorpusScenario[]): CoverageReport {
  const unattributed = new Set<string>();
  const replays = scenarios.map((scenario): ReplayCoverage => {
    const seen = new Set<string>();
    for (const { result } of executeScenario(scenario)) {
      const month = monthCoverage(result);
      for (const id of month.subsystems) seen.add(id);
      for (const type of month.unattributedEventTypes) unattributed.add(type);
    }
    return {
      scenarioId: scenario.id,
      purpose: scenario.purpose,
      months: scenario.months,
      subsystems: SUBSYSTEMS.map((s) => s.id).filter((id) => seen.has(id)),
    };
  });
  const covered = new Set(replays.flatMap((r) => r.subsystems));
  return {
    replays,
    uncovered: SUBSYSTEMS.map((s) => s.id).filter((id) => !covered.has(id)),
    unattributedEventTypes: [...unattributed].sort(),
  };
}

/** Stable text: LF endings, catalogue order, no paths or timestamps. */
export function formatCoverageReport(report: CoverageReport): string {
  const lines: string[] = [];
  for (const replay of report.replays) {
    const unit = replay.months === 1 ? "month" : "months";
    lines.push(`${replay.scenarioId} (${String(replay.months)} ${unit}): ${replay.purpose}`);
    lines.push(`  exercises: ${replay.subsystems.join(", ") || "(none)"}`);
  }
  lines.push(`uncovered: ${report.uncovered.join(", ") || "(none)"}`);
  if (report.unattributedEventTypes.length > 0) {
    lines.push(`unattributed event types: ${report.unattributedEventTypes.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}
