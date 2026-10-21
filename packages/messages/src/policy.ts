import type { DomainEventBody } from "@bluewave/events";
import type { MessageCategory, MessageSeverity, TurnPhase } from "./schema.js";

/**
 * The pure, total, deterministic classification of one domain-event body: which
 * category and severity it projects to, which phase it is attributed to, the
 * localization keys, and its aggregation/deduplication identity. No ambient
 * state; a function of the body alone.
 */
export interface MessageClassification {
  readonly category: MessageCategory;
  readonly severity: MessageSeverity;
  readonly phase: TurnPhase;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly aggregateKey?: string;
  readonly deduplicationKey?: string;
  readonly playerVisible: boolean;
}

function classification(base: Omit<MessageClassification, "playerVisible">): MessageClassification {
  return { ...base, playerVisible: base.severity !== "TRACE" };
}

/**
 * Classify a domain-event body. Total over the frozen `DomainEventBody` union;
 * an unrecognised body fails closed with a `TRACE`/`SYSTEM` classification so a
 * future event kind can never be silently shown as a material outcome.
 */
export function classifyEventBody(body: DomainEventBody): MessageClassification {
  switch (body.kind) {
    case "NationBudgetChanged": {
      if (body.delta === 0) {
        return classification({
          category: "FINANCE",
          severity: "TRACE",
          phase: "appropriation",
          titleKey: "messages.finance.noChange.title",
          bodyKey: "messages.finance.noChange.body",
          deduplicationKey: `finance:budget:${body.nationId}`,
        });
      }
      if (body.newTreasury < 0) {
        return classification({
          category: "FINANCE",
          severity: "CRITICAL",
          phase: "appropriation",
          titleKey: "messages.finance.deficit.title",
          bodyKey: "messages.finance.deficit.body",
          deduplicationKey: `finance:budget:${body.nationId}`,
        });
      }
      return classification({
        category: "FINANCE",
        severity: "NORMAL",
        phase: "appropriation",
        titleKey: "messages.finance.budgetChanged.title",
        bodyKey: "messages.finance.budgetChanged.body",
        deduplicationKey: `finance:budget:${body.nationId}`,
      });
    }
    case "ConstructionProgressed": {
      if (body.workAdded === 0) {
        return classification({
          category: "CONSTRUCTION",
          severity: "TRACE",
          phase: "construction_processing",
          titleKey: "messages.construction.noProgress.title",
          bodyKey: "messages.construction.noProgress.body",
          aggregateKey: "construction:progress",
        });
      }
      return classification({
        category: "CONSTRUCTION",
        severity: "LOW",
        phase: "construction_processing",
        titleKey: "messages.construction.progress.title",
        bodyKey: "messages.construction.progress.body",
        aggregateKey: "construction:progress",
      });
    }
    case "ShipRebuilt":
      return classification({
        category: "CONSTRUCTION",
        severity: "NORMAL",
        phase: "construction_processing",
        titleKey: "messages.construction.rebuilt.title",
        bodyKey: "messages.construction.rebuilt.body",
        deduplicationKey: `construction:rebuilt:${body.shipId}`,
      });
    case "ConstructionDelayed":
      return classification({
        category: "CONSTRUCTION",
        severity: "HIGH",
        phase: "construction_processing",
        titleKey: "messages.construction.delayed.title",
        bodyKey: "messages.construction.delayed.body",
        deduplicationKey: `construction:delayed:${body.projectId}:${body.reason}`,
      });
    case "ConstructionProjectCancelled":
      return classification({
        category: "CONSTRUCTION",
        severity: "HIGH",
        phase: "construction_processing",
        titleKey: "messages.construction.cancelled.title",
        bodyKey: "messages.construction.cancelled.body",
        deduplicationKey: `construction:cancelled:${body.projectId}`,
      });
    case "ResearchProgressed": {
      if (body.newPoints === body.previousPoints) {
        return classification({
          category: "RESEARCH",
          severity: "TRACE",
          phase: "resolve_research",
          titleKey: "messages.research.noProgress.title",
          bodyKey: "messages.research.noProgress.body",
          aggregateKey: "research:progress",
        });
      }
      return classification({
        category: "RESEARCH",
        severity: "LOW",
        phase: "resolve_research",
        titleKey: "messages.research.progress.title",
        bodyKey: "messages.research.progress.body",
        aggregateKey: "research:progress",
      });
    }
    case "TechnologyDiscovered":
      return classification({
        category: "RESEARCH",
        severity: "CRITICAL",
        phase: "resolve_research",
        titleKey: "messages.research.breakthrough.title",
        bodyKey: "messages.research.breakthrough.body",
        deduplicationKey: `research:breakthrough:${body.techId}`,
      });
    case "BattleInitiated":
      return classification({
        category: "BATTLE",
        severity: "HIGH",
        phase: "battle_generation",
        titleKey: "messages.battle.initiated.title",
        bodyKey: "messages.battle.initiated.body",
        deduplicationKey: `battle:initiated:${body.battleId}`,
      });
    case "BattleResolved":
      return classification({
        category: "BATTLE",
        severity: "CRITICAL",
        phase: "battle_resolution",
        titleKey: "messages.battle.resolved.title",
        bodyKey: "messages.battle.resolved.body",
        deduplicationKey: `battle:resolved:${body.battleId}`,
      });
    case "BattleDeclined":
      return classification({
        category: "BATTLE",
        severity: "HIGH",
        phase: "battle_resolution",
        titleKey: "messages.battle.declined.title",
        bodyKey: "messages.battle.declined.body",
        deduplicationKey: `battle:declined:${body.battleId}`,
      });
    default:
      return classification({
        category: "SYSTEM",
        severity: "TRACE",
        phase: "closing_validation",
        titleKey: "messages.system.unknown.title",
        bodyKey: "messages.system.unknown.body",
      });
  }
}

/** Canonical severity rank — lower sorts first (most severe). */
export const SEVERITY_RANK: Readonly<Record<MessageSeverity, number>> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  TRACE: 4,
};
