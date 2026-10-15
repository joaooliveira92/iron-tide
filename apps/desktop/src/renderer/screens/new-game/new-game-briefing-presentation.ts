import {
  Flame,
  Frown,
  Handshake,
  HeartHandshake,
  Meh,
  Scale,
  Skull,
  Smile,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { OpeningBriefingRelationsRow, TensionLabel } from "@bluewave/campaign-engine";

/** Presentation vocabulary for one diplomatic relation: its words, icon and colours. */
export interface RelationPresentation {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly className: string;
}

/** Icon + colour vocabulary per diplomatic relation, shared by the relation pill. */
export const RELATION_PRESENTATION: Readonly<
  Record<OpeningBriefingRelationsRow["relation"], RelationPresentation>
> = {
  allied: {
    label: "Allied",
    icon: HeartHandshake,
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  trade_agreement: {
    label: "Trade agreement",
    icon: Handshake,
    className: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  neutral: {
    label: "Neutral",
    icon: Scale,
    className: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-300",
  },
  at_war: {
    label: "At war",
    icon: Swords,
    className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

/** Presentation vocabulary for one tension band: its icon and the text/bar colours. */
export interface TensionPresentation {
  readonly icon: LucideIcon;
  readonly text: string;
  readonly bar: string;
}

/** Icon + colour vocabulary per tension band; the same bands the engine exposes. */
export const TENSION_PRESENTATION: Readonly<Record<TensionLabel, TensionPresentation>> = {
  cordial: { icon: Smile, text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  neutral: { icon: Meh, text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  strained: { icon: Frown, text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
  hostile: { icon: Flame, text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
  war_imminent: { icon: Skull, text: "text-red-600 dark:text-red-400", bar: "bg-red-600" },
};

/**
 * Orders relations most-hostile first (ties broken by name) so the page reads as
 * intelligence — the powers that matter surface at the top instead of in content
 * order. Pure: returns a new array, never mutates the projection.
 */
export function sortRelationsByTension(
  relations: readonly OpeningBriefingRelationsRow[],
): OpeningBriefingRelationsRow[] {
  return [...relations].sort((a, b) => b.tension - a.tension || a.name.localeCompare(b.name));
}
