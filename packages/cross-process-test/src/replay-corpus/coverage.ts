import type { MonthResult } from "@bluewave/phase-engine";

import { executeScenario, type ReplayScenario } from "./corpus.js";

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
  PrestigeLossRequested: "battle_resolution",
  PrestigeChanged: "battle_resolution",
  DivisionExperienceChanged: "battle_resolution",
  RevoltPressureRequested: "battle_resolution",
  ShipDetachedToFleet: "battle_resolution",
  ShipRemovedFromDivision: "battle_resolution",
  ForeignStationShipMoved: "battle_resolution",
  ForeignStationNoRoute: "battle_resolution",
};

const NEUTRAL_EVENT_TYPES: ReadonlySet<string> = new Set(["NationBudgetChanged"]);

const KNOWN = new Set<string>(SUBSYSTEMS.map((s) => s.id));

export interface MonthCoverage {
  readonly subsystems: ReadonlySet<string>;
  readonly unattributedEventTypes: ReadonlySet<string>;
}

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

export interface CorpusScenario extends ReplayScenario {
  readonly purpose: string;
}

export interface ReplayCoverage {
  readonly scenarioId: string;
  readonly purpose: string;
  readonly months: number;
  readonly subsystems: readonly string[];
}

export interface CoverageReport {
  readonly replays: readonly ReplayCoverage[];
  readonly uncovered: readonly string[];
  readonly unattributedEventTypes: readonly string[];
}

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
