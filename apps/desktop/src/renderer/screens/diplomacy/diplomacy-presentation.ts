import {
  tensionLabel,
  type DiplomacyRelationKind,
  type TensionLabel,
} from "@bluewave/campaign-engine";
import type { DeferredFeature } from "../../components/shared/DeferredFeaturesPanel.js";
import { humanizeId } from "../../lib/humanize-id.js";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import type { DiplomacyActionKind, DiplomacyDraftCommand } from "./diplomacy-screen-state.js";

export const RELATION_LABELS: Readonly<Record<DiplomacyRelationKind, string>> = {
  neutral: "Neutral",
  allied: "Allied",
  at_war: "At war",
  trade_agreement: "Trade agreement",
};

export const ACTION_LABELS: Readonly<Record<string, string>> = {
  DeclareWar: "Declare war",
  AcceptPeace: "Accept peace",
  FormAlliance: "Form alliance",
  BreakAlliance: "Break alliance",
  FormNonAggressionPact: "Form NAP",
  BreakNonAggressionPact: "Break NAP",
  DeclareBlockade: "Blockade",
};

export type ActionTone = "diplomatic" | "hostile";

export interface ActionBrief {
  readonly label: string;
  readonly brief: string;
  readonly tone: ActionTone;
}

export const ACTION_BRIEFS: Readonly<Record<DiplomacyActionKind, ActionBrief>> = {
  FormAlliance: {
    label: "Form alliance",
    brief: "Seek a formal alliance",
    tone: "diplomatic",
  },
  BreakAlliance: {
    label: "Break alliance",
    brief: "Dissolve the standing alliance",
    tone: "diplomatic",
  },
  FormNonAggressionPact: {
    label: "Form NAP",
    brief: "Agree not to attack one another",
    tone: "diplomatic",
  },
  BreakNonAggressionPact: {
    label: "Break NAP",
    brief: "Withdraw from the non-aggression pact",
    tone: "diplomatic",
  },
  AcceptPeace: {
    label: "Accept peace",
    brief: "End the war on the current terms",
    tone: "diplomatic",
  },
  DeclareBlockade: {
    label: "Blockade",
    brief: "Close one strategic area to their shipping",
    tone: "hostile",
  },
  DeclareWar: {
    label: "Declare war",
    brief: "Open hostilities when the month advances",
    tone: "hostile",
  },
};

const ACTION_ORDER: readonly DiplomacyActionKind[] = [
  "FormAlliance",
  "FormNonAggressionPact",
  "BreakAlliance",
  "BreakNonAggressionPact",
  "DeclareBlockade",
  "DeclareWar",
];

export function sortActions(actions: readonly DiplomacyActionKind[]): DiplomacyActionKind[] {
  return [...actions].sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
}

export interface TensionTone {
  readonly bar: string;
  readonly text: string;
  readonly edge: string;
  readonly node: string;
  readonly border: string;
}

export const TENSION_TONES: Readonly<Record<TensionLabel, TensionTone>> = {
  cordial: {
    bar: "bg-success",
    text: "text-green-700 dark:text-green-400",
    edge: "bg-success",
    node: "bg-success text-white",
    border: "border-success",
  },
  neutral: {
    bar: "bg-muted-foreground/60",
    text: "text-muted-foreground",
    edge: "bg-border",
    node: "bg-muted-foreground text-white",
    border: "border-muted-foreground",
  },
  strained: {
    bar: "bg-warning",
    text: "text-amber-700 dark:text-amber-400",
    edge: "bg-warning",
    node: "bg-warning text-black",
    border: "border-warning",
  },
  hostile: {
    bar: "bg-destructive/80",
    text: "text-destructive",
    edge: "bg-destructive/80",
    node: "bg-destructive/85 text-white",
    border: "border-destructive/85",
  },
  war_imminent: {
    bar: "bg-destructive",
    text: "text-destructive",
    edge: "bg-destructive",
    node: "bg-destructive text-white",
    border: "border-destructive",
  },
};

export const WAR_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: "Active",
  DECLARED_NOT_ACTIVE: "Declared",
  ENDED: "Ended",
};

export type WarStanding = "ahead" | "behind" | "level";

export function warStanding(split: Pick<WarScoreSplit, "yours" | "enemy">): WarStanding {
  if (split.yours > split.enemy) return "ahead";
  if (split.yours < split.enemy) return "behind";
  return "level";
}

export function monthsBetween(start: string, now: { month: number; year: number }): number {
  const match = /^(\d{4})-(\d{2})/.exec(start);
  if (match === null) return 0;
  const startIndex = Number(match[1]) * 12 + Number(match[2]) - 1;
  return Math.max(0, now.year * 12 + now.month - 1 - startIndex);
}

export function durationLabel(months: number): string {
  if (months === 0) return "this month";
  if (months < 12) return months === 1 ? "1 month" : `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years === 1 ? "1 year" : `${years} years`;
  return rest === 0 ? yearPart : `${yearPart} ${rest} mo`;
}

export function capitalizeFirst(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

export function tensionBadgeLabel(relation: DiplomacyRelationKind, tension: number): string | null {
  const band = tensionLabel(tension);
  if (band === "neutral" && relation === "neutral") return null;
  return humanizeId(band);
}

export interface WarScoreSplit {
  readonly yours: number;
  readonly enemy: number;
  readonly yourShare: number;
}

export function warScoreSplit(war: {
  readonly attackerWarScore: number;
  readonly defenderWarScore: number;
  readonly playerSide: "attacker" | "defender";
}): WarScoreSplit {
  const yours = war.playerSide === "attacker" ? war.attackerWarScore : war.defenderWarScore;
  const enemy = war.playerSide === "attacker" ? war.defenderWarScore : war.attackerWarScore;
  const total = Math.max(0, yours) + Math.max(0, enemy);
  return {
    yours,
    enemy,
    yourShare: total === 0 ? 0.5 : Math.max(0, yours) / total,
  };
}

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

export function describeDraft(
  projection: DiplomacyScreenProjection,
  draft: DiplomacyDraftCommand,
): string {
  const base = `${ACTION_LABELS[draft.kind] ?? draft.kind}`;
  switch (draft.kind) {
    case "AcceptPeace":
      return `${base} with ${nationName(projection, draft.partnerNationId)}`;
    case "DeclareBlockade":
      return `${base} on ${nationName(projection, draft.partnerNationId)}`;
    default:
      return `${base} with ${nationName(projection, draft.partnerNationId)}`;
  }
}

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
