/**
 * Presentation state for the application toolbar. The toolbar renders whatever
 * this module describes — it never reads engine data directly and never decides
 * what a number means. Metrics the engine does not yet expose are returned as
 * explicit placeholders rather than invented values.
 */

import { monthName } from "../lib/campaign-month.js";

/** Which shell the toolbar is decorating. Drives the adaptive second row. */
export type ActiveView = "menu" | "new_game" | "playing" | "options" | "editor";

export interface CampaignMonth {
  readonly year: number;
  readonly month: number;
}

/** The slice of the campaign projection the toolbar consumes. */
export interface HeaderCampaign {
  readonly month: CampaignMonth;
  readonly treasury: number;
  /** The player nation's name — INC-1's `PlayerProjection.nationName`. */
  readonly nationName: string;
  /**
   * Projected monthly surplus/deficit — INC-1's
   * `PlayerProjection.projectedSurplusDeficit`.
   */
  readonly projectedSurplusDeficit: number;
  /** True when the player nation is at war with anyone. */
  readonly atWar: boolean;
  /**
   * Forward-wired active-alerts count slot: `null` until the INC-2
   * priorities projection lands, so the toolbar shows an explicit
   * placeholder — never a fabricated count.
   */
  readonly activeAlertsCount: number | null;
}

export type MetricIcon = "budget" | "prestige" | "tension" | "nation" | "alerts" | "balance";

export interface HeaderMetric {
  readonly icon: MetricIcon;
  readonly label: string;
  readonly value: string;
  /** True when the value is not backed by engine data yet. */
  readonly placeholder: boolean;
}

export interface HeaderAction {
  readonly code: string;
  readonly label: string;
  readonly icon: "validate" | "save";
}

export type SecondaryRow =
  | {
      readonly kind: "status";
      readonly leading: string;
      readonly trailing: string;
    }
  | {
      readonly kind: "campaign";
      readonly metrics: readonly HeaderMetric[];
      readonly status: string;
    }
  | {
      readonly kind: "editor";
      readonly scenario: string;
      readonly actions: readonly HeaderAction[];
    }
  | { readonly kind: "wizard"; readonly heading: string; readonly hint: string }
  | {
      readonly kind: "preferences";
      readonly label: string;
      readonly detail: string;
    };

/** The concrete member of the `SecondaryRow` union each focused presenter renders. */
export type StatusRowModel = Extract<SecondaryRow, { kind: "status" }>;
export type CampaignRowModel = Extract<SecondaryRow, { kind: "campaign" }>;
export type EditorRowModel = Extract<SecondaryRow, { kind: "editor" }>;
export type WizardRowModel = Extract<SecondaryRow, { kind: "wizard" }>;

/** A new-game step's own heading and hint, replacing the generic setup-assistant copy. */
export type WizardStepCopy = Pick<WizardRowModel, "heading" | "hint">;
export type PreferencesRowModel = Extract<SecondaryRow, { kind: "preferences" }>;

const NO_VALUE = "—";
const THOUSAND = 1000;
const groupDigits = new Intl.NumberFormat("en-GB", { useGrouping: true });

/**
 * Sums of a thousand or more are shown in thousands, truncated so the toolbar
 * never reports more money than the treasury holds.
 */
export function formatTreasury(treasury: number): string {
  if (!Number.isFinite(treasury)) return NO_VALUE;

  const sign = treasury < 0 ? "-" : "";
  const magnitude = Math.abs(treasury);

  if (magnitude < THOUSAND) return `${sign}£${groupDigits.format(magnitude)}`;
  return `${sign}£${groupDigits.format(Math.trunc(magnitude / THOUSAND))}k`;
}

export function formatCampaignMonth(month: CampaignMonth): string {
  const name = monthName(month.month);
  if (name === undefined) return `${month.month}/${month.year}`;
  return `${name} ${month.year}`;
}

export function headerTitleFor(campaign: HeaderCampaign | null): string {
  if (campaign === null) return "Bluewave";
  return `Bluewave — ${formatCampaignMonth(campaign.month)}`;
}

const EDITOR_ACTIONS: readonly HeaderAction[] = [
  { code: "validate", label: "Validate parameters", icon: "validate" },
  { code: "save", label: "Save changes", icon: "save" },
];

export function describeSecondaryRow(
  view: ActiveView,
  campaign: HeaderCampaign | null,
  wizardStep?: WizardStepCopy,
): SecondaryRow {
  switch (view) {
    case "editor":
      return {
        kind: "editor",
        scenario: `Active scenario: editing initial parameters (${campaign?.month.year ?? 1890})`,
        actions: EDITOR_ACTIONS,
      };

    case "playing":
      return {
        kind: "campaign",
        metrics: campaignMetrics(campaign),
        status: campaign?.atWar === true ? "At war" : "Armed peace",
      };

    case "new_game":
      return {
        kind: "wizard",
        heading: wizardStep?.heading ?? "Campaign setup assistant",
        hint: wizardStep?.hint ?? "Select the historical scenario to continue",
      };

    case "options":
      return {
        kind: "preferences",
        label: "Preferences:",
        detail: "Storage directory and interface settings",
      };

    case "menu":
      return {
        kind: "status",
        leading: "Active database (SQLite)",
        trailing: "Ready for operation",
      };
  }
}

function campaignMetrics(campaign: HeaderCampaign | null): readonly HeaderMetric[] {
  return [
    {
      icon: "nation",
      label: "Nation",
      value: campaign === null ? NO_VALUE : campaign.nationName,
      placeholder: campaign === null,
    },
    {
      icon: "budget",
      label: "Budget",
      value: campaign === null ? NO_VALUE : formatTreasury(campaign.treasury),
      placeholder: campaign === null,
    },
    {
      icon: "balance",
      label: "Projected balance",
      value: campaign === null ? NO_VALUE : formatTreasury(campaign.projectedSurplusDeficit),
      placeholder: campaign === null,
    },
    {
      icon: "alerts",
      label: "Alerts",
      value:
        campaign === null || campaign.activeAlertsCount === null
          ? NO_VALUE
          : String(campaign.activeAlertsCount),
      placeholder: campaign === null || campaign.activeAlertsCount === null,
    },
    // Prestige and world tension are not part of the player projection yet.
    { icon: "prestige", label: "Prestige", value: NO_VALUE, placeholder: true },
    {
      icon: "tension",
      label: "World tension",
      value: NO_VALUE,
      placeholder: true,
    },
  ];
}
