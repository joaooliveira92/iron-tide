import { monthName } from "../lib/campaign-month.js";
import type { PresentationFormat } from "../lib/presentation-format/index.js";
import { translate } from "../lib/strings.js";

export type ActiveView = "menu" | "new_game" | "playing" | "options" | "editor";

export interface CampaignMonth {
  readonly year: number;
  readonly month: number;
}

export interface HeaderCampaign {
  readonly month: CampaignMonth;
  readonly treasury: number;
  readonly nationName: string;
  readonly projectedSurplusDeficit: number;
  readonly atWar: boolean;
  readonly activeAlertsCount: number | null;
}

export type MetricIcon = "budget" | "prestige" | "tension" | "nation" | "alerts" | "balance";

export interface HeaderMetric {
  readonly icon: MetricIcon;
  readonly label: string;
  readonly value: string;
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

export type StatusRowModel = Extract<SecondaryRow, { kind: "status" }>;
export type CampaignRowModel = Extract<SecondaryRow, { kind: "campaign" }>;
export type EditorRowModel = Extract<SecondaryRow, { kind: "editor" }>;
export type WizardRowModel = Extract<SecondaryRow, { kind: "wizard" }>;

export type WizardStepCopy = Pick<WizardRowModel, "heading" | "hint">;
export type PreferencesRowModel = Extract<SecondaryRow, { kind: "preferences" }>;

const NO_VALUE = "—";
const THOUSAND = 1000;

export function formatTreasury(treasury: number, format: PresentationFormat): string {
  if (!Number.isFinite(treasury)) return NO_VALUE;

  const sign = treasury < 0 ? "-" : "";
  const magnitude = Math.abs(treasury);

  if (magnitude < THOUSAND) return `${sign}${format.money(magnitude)}`;
  const thousands = format.number(Math.trunc(magnitude / THOUSAND));
  return `${sign}${thousands}k ${format.currencyLabel}`;
}

export function formatCampaignMonth(month: CampaignMonth): string {
  const name = monthName(month.month);
  if (name === undefined) return `${month.month}/${month.year}`;
  return `${name} ${month.year}`;
}

export function headerTitleFor(campaign: HeaderCampaign | null): string {
  const appName = translate("shell.app.name");
  if (campaign === null) return appName;
  return `${appName} — ${formatCampaignMonth(campaign.month)}`;
}

const EDITOR_ACTIONS: readonly HeaderAction[] = [
  { code: "validate", label: translate("shell.header.editor.validate"), icon: "validate" },
  { code: "save", label: translate("shell.header.editor.save"), icon: "save" },
];

export function describeSecondaryRow(
  view: ActiveView,
  campaign: HeaderCampaign | null,
  format: PresentationFormat,
  wizardStep?: WizardStepCopy,
): SecondaryRow {
  switch (view) {
    case "editor":
      return {
        kind: "editor",
        scenario: `${translate("shell.header.editor.scenario")} (${campaign?.month.year ?? 1890})`,
        actions: EDITOR_ACTIONS,
      };

    case "playing":
      return {
        kind: "campaign",
        metrics: campaignMetrics(campaign, format),
        status:
          campaign?.atWar === true
            ? translate("shell.header.campaign.atWar")
            : translate("shell.header.campaign.armedPeace"),
      };

    case "new_game":
      return {
        kind: "wizard",
        heading: wizardStep?.heading ?? translate("shell.header.wizard.heading"),
        hint: wizardStep?.hint ?? translate("shell.header.wizard.hint"),
      };

    case "options":
      return {
        kind: "preferences",
        label: translate("shell.header.preferences.label"),
        detail: translate("shell.header.preferences.detail"),
      };

    case "menu":
      return {
        kind: "status",
        leading: translate("shell.header.menu.leading"),
        trailing: translate("shell.header.menu.trailing"),
      };
  }
}

function campaignMetrics(
  campaign: HeaderCampaign | null,
  format: PresentationFormat,
): readonly HeaderMetric[] {
  return [
    {
      icon: "nation",
      label: translate("shell.header.metric.nation"),
      value: campaign === null ? NO_VALUE : campaign.nationName,
      placeholder: campaign === null,
    },
    {
      icon: "budget",
      label: translate("shell.header.metric.budget"),
      value: campaign === null ? NO_VALUE : formatTreasury(campaign.treasury, format),
      placeholder: campaign === null,
    },
    {
      icon: "balance",
      label: translate("shell.header.metric.balance"),
      value:
        campaign === null ? NO_VALUE : formatTreasury(campaign.projectedSurplusDeficit, format),
      placeholder: campaign === null,
    },
    {
      icon: "alerts",
      label: translate("shell.header.metric.alerts"),
      value:
        campaign === null || campaign.activeAlertsCount === null
          ? NO_VALUE
          : String(campaign.activeAlertsCount),
      placeholder: campaign === null || campaign.activeAlertsCount === null,
    },
    {
      icon: "prestige",
      label: translate("shell.header.metric.prestige"),
      value: NO_VALUE,
      placeholder: true,
    },
    {
      icon: "tension",
      label: translate("shell.header.metric.tension"),
      value: NO_VALUE,
      placeholder: true,
    },
  ];
}
