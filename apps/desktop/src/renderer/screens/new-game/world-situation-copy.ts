import { interpolate } from "../../content/uiCatalogue.js";
import { formatConjunctionList } from "../../lib/presentation-format/index.js";
import type { TensionLabel } from "@bluewave/campaign-engine";
import type {
  PowerOutlook,
  RelationKind,
  RelevanceReason,
  RelevanceTier,
} from "./world-situation.js";

/**
 * Player-facing copy for the World Situation Briefing. Every string is a whole
 * sentence or label under a stable key, with `{named}` placeholders a translator
 * can reorder — nothing is assembled from fragments. The table is the seam the
 * UI catalogue (ADR-0209) will absorb; until then it lives beside the screen.
 */
const MESSAGES = {
  "world.eyebrow": "Foreign Intelligence",
  "world.title": "World Situation Briefing",
  "world.activeNation": "Active nation",
  "world.campaignDate": "Campaign opens",
  "world.startingNote":
    "This is the situation at the start of the campaign. Relations and standing will change as it unfolds.",
  "world.reviewOnly": "Review only. Nothing on this page changes your standing.",
  "world.assessment.heading": "Strategic assessment",
  "world.assessment.fallback":
    "No authored assessment exists for {nation}. Powers below are placed by their holdings and recorded relations.",
  "world.theater.primary": "Primary theatre",
  "world.theater.none":
    "No holdings of yours could be placed in a theatre, so no power is marked as sharing your waters.",
  "world.posture.heading": "Opening posture",
  "world.posture.status": "Formal standing",
  "world.posture.outlook": "Outlook",
  "world.posture.noAllies": "No allies at the outset.",
  "world.board.heading": "Theatres of interest",
  "world.board.caption": "A schematic grouping by theatre, not a chart.",
  "world.board.others": "Other theatres ({count})",
  "world.board.yours": "Your theatre",
  "world.board.powersIn": "Powers present",

  "navigator.heading": "Foreign powers",
  "navigator.hint":
    "Up and Down arrows move between powers. Home and End jump to the first and last.",
  "navigator.expand": "Show {count} more powers",
  "navigator.collapse": "Hide these powers",
  "navigator.selected": "Selected",

  "tier.immediate.title": "Immediate interests",
  "tier.immediate.description": "At war, close to war, or sharing your waters.",
  "tier.wide_reach.title": "Powers of wide reach",
  "tier.wide_reach.description": "Territory across several theatres, but none in yours.",
  "tier.distant.title": "Distant powers",
  "tier.distant.description": "No holdings in your waters and little overseas reach.",

  "status.allied": "Allied",
  "status.trade_agreement": "Trade agreement",
  "status.neutral": "Neutral",
  "status.at_war": "At war",
  "status.allied.detail": "A formal alliance binds the two powers.",
  "status.trade_agreement.detail":
    "A trade agreement is in force. It carries no military obligation.",
  "status.neutral.detail": "No alliance, agreement or war stands between you.",
  "status.at_war.detail": "The two powers are formally at war.",
  "status.pact.in_force": "A non-aggression pact is in force.",
  "status.pact.absent": "No non-aggression pact is in force.",

  "attitude.cordial": "Cordial",
  "attitude.neutral": "Reserved",
  "attitude.strained": "Strained",
  "attitude.hostile": "Hostile",
  "attitude.war_imminent": "On the brink",
  "attitude.cordial.detail": "Warm relations with little friction.",
  "attitude.neutral.detail": "Neither warm nor hostile.",
  "attitude.strained.detail": "Friction is visible and growing.",
  "attitude.hostile.detail": "Open hostility. Incidents are likely.",
  "attitude.war_imminent.detail": "War is close.",

  "tension.label": "Tension",
  "tension.value": "{tension} of 10",
  "tension.meaning": "A higher number means a worse relationship, closer to war.",
  "tension.meterLabel": "Tension {tension} of 10, where 10 is war",

  "outlook.flashpoint": "Likely flashpoint",
  "outlook.uncertain": "Uncertain",
  "outlook.stable": "Stable",
  "outlook.flashpoint.detail": "Could become a crisis early in the campaign.",
  "outlook.uncertain.detail": "Could shift either way. Worth watching.",
  "outlook.stable.detail": "No sign of trouble at the outset.",

  "confidence.label": "Intelligence confidence",
  "confidence.ungraded": "Not graded. Intelligence is not rated at the start of a campaign.",
  "confidence.confirmed": "Confirmed",
  "confidence.estimated": "Estimated",
  "confidence.uncertain": "Uncertain",

  "reason.at_war": "You are at war with {power}. Everything else follows from that.",
  "reason.high_tension":
    "Relations with {power} stand at {tension} of 10 and are close to breaking.",
  "reason.shares_theater": "{power} holds {holdings} in {theater}, the same waters as your fleet.",
  "reason.overseas_reach": "{power} holds territory in {count} theatres, but none in yours.",
  "reason.no_contact":
    "{power} holds nothing in your theatres. It matters mostly through the wider balance of power.",

  "dossier.heading": "Dossier",
  "dossier.empty": "Select a power to read its dossier.",
  "dossier.whyHeading": "Why this matters",
  "dossier.relationHeading": "Relationship",
  "dossier.status": "Formal status",
  "dossier.attitude": "Attitude",
  "dossier.outlook": "Outlook",
  "dossier.presenceHeading": "Presence in your waters",
  "dossier.presence.none": "No known holdings in your theatres.",
  "dossier.navalHeading": "Naval establishment",
  "dossier.naval.budget": "Naval budget",
  "dossier.naval.shipbuilding": "Shipbuilding",
  "dossier.naval.doctrine": "Doctrine",
  "dossier.viewHeading": "How they see the situation",
  "dossier.pressureHeading": "Pressure and opportunity",
  "dossier.pressure.rival": "{power} names your nation among its likely rivals.",
  "dossier.pressure.flashpoint": "A crisis here would pull your fleet toward the contested waters.",
  "dossier.pressure.uncertain": "Neither side has committed. Early moves could settle it.",
  "dossier.pressure.stable": "A quiet relationship. It lets you spend attention elsewhere.",
  "dossier.noProfile":
    "No authored briefing exists for this power. Only its recorded relations and holdings are shown.",
  "dossier.announce": "Dossier: {power}. {status}. Attitude {attitude}. Outlook {outlook}.",

  "legend.heading": "How to read this briefing",
  "legend.status":
    "Formal status is the standing between governments: allied, trade agreement, neutral or at war.",
  "legend.attitude":
    "Attitude is how the two powers feel about each other, read from the tension score.",
  "legend.scale": "Tension runs from 0 to 10. A higher number is worse.",
  "legend.band": "{band}: {range}",
  "legend.outlook":
    "Outlook weighs tension against proximity. A strained relation in shared waters is likelier to break than one across the world.",
  "legend.confidence":
    "Intelligence confidence says how well a report is known. None is graded yet.",

  "state.empty.title": "No foreign powers on record",
  "state.empty.body":
    "The campaign lists no other powers, so there is nothing to review. You can continue.",
  "state.noTheaters.title": "Theatre data unavailable",
  "state.noTheaters.body":
    "Powers are listed by relationship only, because their holdings could not be placed.",

  "actions.back": "Back",
  "actions.continue.hint": "Continuing opens {next}.",
} as const;

export type WorldMessageKey = keyof typeof MESSAGES;

/** Resolves a briefing message, interpolating `{named}` placeholders. */
export function worldText(
  key: WorldMessageKey,
  params: Readonly<Record<string, string | number | boolean>> = {},
): string {
  return interpolate(MESSAGES[key], params);
}

export const statusLabel = (status: RelationKind): string => worldText(`status.${status}`);
export const statusDetail = (status: RelationKind): string => worldText(`status.${status}.detail`);
export const attitudeLabel = (band: TensionLabel): string => worldText(`attitude.${band}`);
export const attitudeDetail = (band: TensionLabel): string => worldText(`attitude.${band}.detail`);
export const outlookLabel = (outlook: PowerOutlook): string => worldText(`outlook.${outlook}`);
export const outlookDetail = (outlook: PowerOutlook): string =>
  worldText(`outlook.${outlook}.detail`);
export const tierTitle = (tier: RelevanceTier): string => worldText(`tier.${tier}.title`);
export const tierDescription = (tier: RelevanceTier): string =>
  worldText(`tier.${tier}.description`);

export const formatList = formatConjunctionList;

export interface ReasonParams {
  readonly power: string;
  readonly tension: number;
  readonly holdings: readonly string[];
  readonly theaters: readonly string[];
  readonly theaterCount: number;
}

/** The one-sentence "why this matters" for a power's placement. */
export function reasonText(reason: RelevanceReason, params: ReasonParams): string {
  switch (reason) {
    case "at_war":
      return worldText("reason.at_war", { power: params.power });
    case "high_tension":
      return worldText("reason.high_tension", { power: params.power, tension: params.tension });
    case "shares_theater":
      return worldText("reason.shares_theater", {
        power: params.power,
        holdings: formatList(params.holdings),
        theater: formatList(params.theaters),
      });
    case "overseas_reach":
      return worldText("reason.overseas_reach", {
        power: params.power,
        count: params.theaterCount,
      });
    case "no_contact":
      return worldText("reason.no_contact", { power: params.power });
  }
}
