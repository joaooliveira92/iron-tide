import {
  Flame,
  Handshake,
  HeartHandshake,
  Scale,
  ShieldCheck,
  Swords,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import type { TensionLabel } from "@bluewave/campaign-engine";
import type { PowerOutlook, RelationKind } from "./world-situation.js";

/**
 * Icon and colour vocabulary for the briefing. Colour and icon only reinforce
 * the words beside them (copy lives in `world-situation-copy.ts`); each record
 * is exhaustive so a new status, band or outlook cannot ship unstyled.
 */
export interface Tone {
  readonly icon: LucideIcon;
  /** Text colour that holds AA contrast on the briefing surfaces in both themes. */
  readonly text: string;
  /** Meter / marker fill. */
  readonly fill: string;
  /** Left rule on selected or emphasised cards. */
  readonly rule: string;
  /** Top rule on the dossier panel. */
  readonly top: string;
}

export const OUTLOOK_TONE: Readonly<Record<PowerOutlook, Tone>> = {
  flashpoint: {
    icon: Flame,
    text: "text-red-700 dark:text-red-300",
    fill: "bg-red-600 dark:bg-red-400",
    rule: "border-l-red-600 dark:border-l-red-400",
    top: "border-t-red-600 dark:border-t-red-400",
  },
  uncertain: {
    icon: CircleHelp,
    text: "text-amber-800 dark:text-amber-300",
    fill: "bg-amber-600 dark:bg-amber-400",
    rule: "border-l-amber-600 dark:border-l-amber-400",
    top: "border-t-amber-600 dark:border-t-amber-400",
  },
  stable: {
    icon: ShieldCheck,
    text: "text-sky-800 dark:text-sky-300",
    fill: "bg-sky-600 dark:bg-sky-400",
    rule: "border-l-sky-600 dark:border-l-sky-400",
    top: "border-t-sky-600 dark:border-t-sky-400",
  },
};

export const STATUS_ICON: Readonly<Record<RelationKind, LucideIcon>> = {
  allied: HeartHandshake,
  trade_agreement: Handshake,
  neutral: Scale,
  at_war: Swords,
};

/** Meter colour per attitude band; the meter is decorative beside the numeric text. */
export const ATTITUDE_FILL: Readonly<Record<TensionLabel, string>> = {
  cordial: "bg-sky-600 dark:bg-sky-400",
  neutral: "bg-slate-500 dark:bg-slate-400",
  strained: "bg-amber-600 dark:bg-amber-400",
  hostile: "bg-red-600 dark:bg-red-400",
  war_imminent: "bg-red-700 dark:bg-red-300",
};
