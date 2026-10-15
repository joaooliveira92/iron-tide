import { tensionLabel, type DiplomacyRelationKind } from "@bluewave/campaign-engine";
import type { DeferredFeature } from "../../components/shared/DeferredFeaturesPanel.js";
import { humanizeId } from "../../lib/humanize-id.js";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import type { DiplomacyActionKind, DiplomacyDraftCommand } from "./diplomacy-screen-state.js";

/** Labels for every relation kind the engine can project. */
export const RELATION_LABELS: Readonly<Record<DiplomacyRelationKind, string>> = {
  neutral: "Neutral",
  allied: "Allied",
  at_war: "At war",
  trade_agreement: "Trade agreement",
};

/** Player-facing labels for the 7 draftable command kinds. */
export const ACTION_LABELS: Readonly<Record<string, string>> = {
  DeclareWar: "Declare war",
  AcceptPeace: "Accept peace",
  FormAlliance: "Form alliance",
  BreakAlliance: "Break alliance",
  FormNonAggressionPact: "Form NAP",
  BreakNonAggressionPact: "Break NAP",
  DeclareBlockade: "Blockade",
};

/**
 * The tension-band badge shown next to a relation badge, or null when it would
 * only repeat it. The two vocabularies share exactly one word: a "neutral"
 * relation at a "neutral" tension band. Compared on the typed values, not on
 * display strings.
 */
export function tensionBadgeLabel(relation: DiplomacyRelationKind, tension: number): string | null {
  const band = tensionLabel(tension);
  if (band === "neutral" && relation === "neutral") return null;
  return humanizeId(band);
}

export interface WarScoreSplit {
  readonly yours: number;
  readonly enemy: number;
  /** Player's share of the combined score, 0..1 (0.5 when neither side has scored). */
  readonly yourShare: number;
}

/** The player's score against the enemy's, from the war's attacker/defender scores. */
export function warScoreSplit(war: {
  readonly attackerWarScore: number;
  readonly defenderWarScore: number;
  readonly playerSide: "attacker" | "defender";
}): WarScoreSplit {
  const yours = war.playerSide === "attacker" ? war.attackerWarScore : war.defenderWarScore;
  const enemy = war.playerSide === "attacker" ? war.defenderWarScore : war.attackerWarScore;
  const total = Math.max(0, yours) + Math.max(0, enemy);
  return { yours, enemy, yourShare: total === 0 ? 0.5 : Math.max(0, yours) / total };
}

/**
 * Legal-action affordance for one relations row — derived from the projected
 * relation/nap state ONLY (`declareWar` enabled unless `at_war`, alliance/NAP
 * form/break on the matching relation). This drives which chips render; the
 * engine's own `CommandLifecycle.validate()` remains the authority at issue
 * time (spec D1) — nothing here re-implements it.
 */
export function diplomacyLegalActions(row: {
  readonly relation: DiplomacyScreenProjection["relations"][number]["relation"];
  readonly nap: boolean;
}): DiplomacyActionKind[] {
  const actions: DiplomacyActionKind[] = [];
  if (row.relation !== "at_war") actions.push("DeclareWar");
  if (row.relation === "neutral") actions.push("FormAlliance");
  if (row.relation === "allied") actions.push("BreakAlliance");
  if (row.relation === "at_war") actions.push("DeclareBlockade");
  if (row.nap) actions.push("BreakNonAggressionPact");
  else if (row.relation !== "at_war") actions.push("FormNonAggressionPact");
  return actions;
}

export function nationName(projection: DiplomacyScreenProjection, nationId: string): string {
  return (
    projection.knownNations.find((n) => n.nationId === nationId)?.name ??
    (nationId === projection.playerNationId ? "your nation" : nationId)
  );
}

export function sideLabel(
  projection: DiplomacyScreenProjection,
  memberIds: readonly string[],
): string {
  return memberIds.map((id) => nationName(projection, id)).join(" + ") || "—";
}

export function areaName(projection: DiplomacyScreenProjection, areaId: string): string {
  return projection.areas.find((a) => a.areaId === areaId)?.name ?? areaId;
}

/** The human-readable description of the currently drafted command. */
export function describeDraft(
  projection: DiplomacyScreenProjection,
  draft: DiplomacyDraftCommand,
): string {
  const base = `${ACTION_LABELS[draft.kind] ?? draft.kind}`;
  switch (draft.kind) {
    case "AcceptPeace":
      return `${base} in war ${draft.warId ?? "(unknown)"}`;
    case "DeclareBlockade":
      return `${base} on ${nationName(projection, draft.partnerNationId)}`;
    default:
      return `${base} with ${nationName(projection, draft.partnerNationId)}`;
  }
}

/**
 * RTW3 war-panel items the engine cannot supply yet (docs/research/
 * rtw3-war-panel-engine-surface.md). Shown as an explicit "not modelled" list —
 * never as numbers or controls that look real.
 */
export const DEFERRED_WAR_ITEMS: readonly DeferredFeature[] = [
  {
    id: "trade-protection",
    name: "Trade protection",
    reason: "The engine has no commerce or trade-route state yet.",
  },
  {
    id: "asw",
    name: "Anti-submarine strength",
    reason: "Submarine warfare is modelled in battles only, with no campaign-level rating.",
  },
  {
    id: "submarine-policy",
    name: "Submarine warfare policy",
    reason: "Fleet support, prize rules and unrestricted warfare need an engine command first.",
  },
  {
    id: "invasion",
    name: "Invasion planning",
    reason: "Invasions exist only as a battle mission type, not as a campaign plan.",
  },
];

/**
 * RTW3 intelligence items the engine cannot supply yet (docs/research/
 * rtw3-intel-and-submarines-engine-surface.md). Relations, tension and "likely
 * rival" are real and already shown above.
 */
export const DEFERRED_INTEL_ITEMS: readonly DeferredFeature[] = [
  {
    id: "intel-levels",
    name: "Intelligence level per nation",
    reason: "Campaign state has only an empty intelligence placeholder.",
  },
  {
    id: "intel-spending",
    name: "Intelligence spending",
    reason: "There is no intelligence budget line in the economy yet.",
  },
  {
    id: "intel-reports",
    name: "Intelligence reports",
    reason: "No report model exists; relations and tension above are the real foreign picture.",
  },
];
