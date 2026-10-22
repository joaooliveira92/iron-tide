"use strict";

import type { MonthlyReportEntry } from "../../../shared/campaign-command-contract.js";
import { campaignNationLabel } from "../../content/presentationContent.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { monthLabel, signed } from "./month-report-format.js";

/** Prose summary for a single month, flowing as narrative text. */
export function narrativeMonthSummary(
  month: MonthlyReportEntry,
  previousMonth: MonthlyReportEntry | undefined,
  areaName: (id: string) => string,
  format: PresentationFormat,
): string {
  const parts: string[] = [];

  const treasurySentence = narrativeTreasurySection(month.treasury, month.battleOutcomes, format);
  if (treasurySentence) parts.push(treasurySentence);

  const constructionSentence = narrativeConstructionSection(month.construction, format);
  if (constructionSentence) parts.push(constructionSentence);

  const researchSentence = narrativeResearchSection(month.research);
  if (researchSentence) parts.push(researchSentence);

  const fleetSentence = narrativeFleetSection(month.fleet, month.construction);
  if (fleetSentence) parts.push(fleetSentence);

  const prioritiesSentence = narrativePrioritiesSection(
    month.priorities,
    previousMonth?.priorities,
  );
  if (prioritiesSentence) parts.push(prioritiesSentence);

  const battleSentence = narrativeBattleSection(month.battleOutcomes, areaName);
  if (battleSentence) parts.push(battleSentence);

  return parts.join(" ") + narrativeClosing(month);
}

/** Narrative for Treasury section: finance flow per ledger row. */
function narrativeTreasurySection(
  treasury: MonthlyReportEntry["treasury"],
  battles: MonthlyReportEntry["battleOutcomes"],
  format: PresentationFormat,
): string {
  const lines: string[] = [];

  if (treasury.ledgerRows.length === 0 && battles.length === 0) {
    return `The month ended with treasury ${signed(treasury.netChange, format)}`;
  }

  for (const row of treasury.ledgerRows) {
    const direction = row.amount < 0 ? "lost" : "gained";
    lines.push(`${row.description} ${direction} ${signed(row.amount, format)}`);
  }

  if (treasury.ledgerRows.length > 0) {
    lines.push(`treasury moved ${signed(treasury.netChange, format)}`);
  }

  if (battles.length > 0) {
    lines.push(`${battles.length} engagement${battles.length === 1 ? "" : "s"} affected treasury`);
  }

  return lines.join("; ") + ".";
}

/** Narrative for Construction section: projects, completed ships, new starts. */
function narrativeConstructionSection(
  construction: MonthlyReportEntry["construction"],
  format: PresentationFormat,
): string {
  if (
    construction.projects.length === 0 &&
    construction.completedShips.length === 0 &&
    construction.newlyActiveProjectIds.length === 0
  ) {
    return "No construction activity this month — production diverted elsewhere.";
  }

  const parts: string[] = [];

  for (const project of construction.projects) {
    const num = (value: number) => format.number(value);
    parts.push(
      `construction on ${project.projectId}: work ${num(project.previousWork)}→${num(project.newWork)} (+${num(project.newWork - project.previousWork)})`,
    );
  }

  for (const ship of construction.completedShips) {
    parts.push(`completed ${ship.name}`);
  }

  for (const id of construction.newlyActiveProjectIds) {
    parts.push(`began construction on ${id}`);
  }

  return parts.join(". ") + ".";
}

/** Narrative for Research section: tech progress and discoveries. */
function narrativeResearchSection(research: MonthlyReportEntry["research"]): string {
  if (research.progress.length === 0 && research.discoveries.length === 0) {
    return "No research activity this month — focus shifted elsewhere.";
  }

  const parts: string[] = [];

  for (const entry of research.progress) {
    parts.push(`research advance: ${entry.techId}: ${entry.previousPoints}→${entry.newPoints}`);
  }

  for (const disc of research.discoveries) {
    parts.push(`discovered ${disc.techId}`);
  }

  return parts.join(". ") + ".";
}

/** Narrative for Fleet section: commissioned ships and total strength. */
function narrativeFleetSection(
  fleet: MonthlyReportEntry["fleet"],
  construction: MonthlyReportEntry["construction"],
): string {
  if (fleet.additions.length === 0 && construction.completedShips.length === 0) {
    return "Fleet held at its existing strength — no new ships.";
  }

  const parts: string[] = [];

  for (const ship of fleet.additions) {
    parts.push(`commissioned ${ship.name}`);
  }

  if (fleet.additions.length > 0 || construction.completedShips.length > 0) {
    parts.push(`the fleet now has ${fleet.totalActiveShips} active ships`);
  }

  return parts.join(". ") + ".";
}

/** Narrative for Priorities section: new / resolved / continuing changes. */
function narrativePrioritiesSection(
  current: MonthlyReportEntry["priorities"],
  previous: MonthlyReportEntry["priorities"] | undefined,
): string {
  if (current.length === 0 && (!previous || previous.length === 0)) {
    return "Priorities untouched this month — stable strategic picture.";
  }

  const created: { fingerprint: string; title: string }[] = [];
  const resolved: { fingerprint: string; title: string }[] = [];
  const continuing: { fingerprint: string; title: string }[] = [];

  const prevFingerprints = previous ? new Set(previous.map((p) => p.fingerprint)) : new Set();

  for (const priority of current) {
    if (prevFingerprints.has(priority.fingerprint)) {
      continuing.push(priority);
    } else {
      created.push(priority);
    }
  }

  for (const priority of previous ?? []) {
    if (!current.some((p) => p.fingerprint === priority.fingerprint)) {
      resolved.push(priority);
    }
  }

  const parts: string[] = [];

  if (created.length > 0) {
    parts.push(`emerged from the previous month: ${created.map((p) => p.title).join(", ")}.`);
  }
  if (resolved.length > 0) {
    parts.push(`resolved from this list: ${resolved.map((p) => p.title).join(", ")}.`);
  }
  if (continuing.length > 0 && created.length === 0 && resolved.length === 0) {
    parts.push(`continuing: ${continuing.map((p) => p.title).join(", ")}.`);
  }

  return parts.join(" ");
}

/** Narrative for Battle Outcomes section: who won where, by how much. */
function narrativeBattleSection(
  battles: MonthlyReportEntry["battleOutcomes"],
  areaName: (id: string) => string,
): string {
  if (battles.length === 0) {
    return "No engagements this month — peaceful conditions.";
  }

  const parts: string[] = [];

  for (const battle of battles) {
    const attacker = campaignNationLabel(battle.attackerId);
    const defender = campaignNationLabel(battle.defenderId);
    const area = areaName(battle.areaId);

    if (battle.winnerId === null) {
      const attackerLosses = battle.attackerLosses.length;
      const defenderLosses = battle.defenderLosses.length;
      parts.push(
        `${attacker} vs ${defender}, drawn in ${area}.${attacker} lost ${attackerLosses} ship${attackerLosses === 1 ? "" : "s"}, ${defender} lost ${defenderLosses} ship${defenderLosses === 1 ? "" : "s"}`,
      );
    } else {
      const winnerLabel = campaignNationLabel(battle.winnerId);
      const loserId = battle.winnerId === battle.attackerId ? battle.defenderId : battle.attackerId;
      const loserLabel = campaignNationLabel(loserId);
      const wLossKey = battle.winnerId === battle.attackerId ? "attackerLosses" : "defenderLosses";
      const lLossKey = battle.winnerId === battle.attackerId ? "defenderLosses" : "attackerLosses";

      const wLoss = battle[wLossKey] as readonly string[];
      const lLosses = battle[lLossKey] as readonly string[];

      parts.push(
        `${winnerLabel} defeated ${loserLabel} in ${area}.${winnerLabel} lost ${wLoss.length} ship${wLoss.length === 1 ? "" : "s"}, ${loserLabel} lost ${lLosses.length} ship${lLosses.length === 1 ? "" : "s"}`,
      );
    }
  }

  return parts.join(". ") + ".";
}

/** Closing narrative: one-line summary of the month's character. */
function narrativeClosing(month: MonthlyReportEntry): string {
  const ledgerActive = month.treasury.ledgerRows.length > 0;
  const constructionActive =
    month.construction.projects.length > 0 ||
    month.construction.completedShips.length > 0 ||
    month.construction.newlyActiveProjectIds.length > 0;
  const researchActive =
    month.research.progress.length > 0 || month.research.discoveries.length > 0;
  const fleetActive = month.fleet.additions.length > 0;
  const prioritiesActive = month.priorities.length > 0;
  const battleActive = month.battleOutcomes.length > 0;

  const hit = [
    ledgerActive,
    constructionActive,
    researchActive,
    fleetActive,
    prioritiesActive,
    battleActive,
  ].filter(Boolean).length;

  if (hit === 0) return "";
  if (hit <= 1) return "The month was quiet across all domains.";
  if (hit <= 3) return "Multiple domains saw notable activity this month.";
  return "Several critical developments across treasury, operations and strategy defined this month.";
}

/** React component: renders each event as a distinct row with entity links. */
export function NarrativeMonthSummary({
  reports,
  areaName,
}: {
  readonly reports: readonly MonthlyReportEntry[];
  readonly areaName?: (id: string) => string;
}) {
  const format = usePresentationFormat();
  const [latest, ...earlier] = reports;
  const description =
    latest === undefined
      ? "The narrative month report appears here after you advance the month."
      : `Narrative summary for ${monthLabel(latest.period.from)}.`;

  if (latest === undefined) {
    return (
      <div className="space-y-4 text-sm leading-relaxed">
        <p className="text-muted-foreground italic">{description}</p>
        <p className="text-muted-foreground">No months have been advanced yet in this campaign.</p>
      </div>
    );
  }

  const narrative = narrativeMonthSummary(latest, earlier[0], areaName ?? humanizeId, format);

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p className="text-muted-foreground italic">{description}</p>
      <p className="whitespace-pre-line text-foreground">{narrative}</p>

      {earlier.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Earlier months ({earlier.length})
          </summary>
          <ul className="mt-2 space-y-3 pl-4 border-l-2 border-border">
            {earlier.map((report, index) => {
              const key = `${report.period.from.year}-${report.period.from.month}`;
              return (
                <li key={key} className="space-y-1">
                  <p className="font-medium text-xs">{monthLabel(report.period.from)}</p>
                  <p className="whitespace-pre-line text-xs text-muted-foreground">
                    {narrativeMonthSummary(
                      report,
                      earlier[index + 1],
                      areaName ?? humanizeId,
                      format,
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Earlier months are kept with this campaign.
          </p>
        </details>
      )}
    </div>
  );
}
