/**
 * The string catalogues and resolver (U-4 map D6, ADR-0209). UI strings are keyed
 * by stable identifiers, resolved through a per-language catalogue with a complete
 * `en-US` fallback, so a missing translation falls back to en-US with no raw key
 * ever reaching the screen.
 *
 * The Options screen and the application shell chrome (the screen registry,
 * sidebar sections, site header, global search and the pre-campaign loading
 * view) are migrated onto this catalogue; the remaining released screens'
 * content migrates in a bounded follow-on (U-4 map D6).
 */
import type { LanguagePreference } from "../../shared/preferences-contract.js";

/** The English (en-US) catalogue — the complete fallback. */
export const EN_US_MESSAGES = {
  "settings.title": "Options",
  "settings.description": "Appearance, display, measurements, currency and accessibility.",

  "settings.section.general": "General",
  "settings.section.appearance": "Appearance",
  "settings.section.measurements": "Measurements",
  "settings.section.currency": "Currency and Numbers",
  "settings.section.language": "Language and Region",
  "settings.section.accessibility": "Accessibility",
  "settings.section.advanced": "Advanced",

  "settings.theme.label": "Theme",
  "settings.theme.system": "System",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.theme.highContrast": "High contrast",
  "settings.background.label": "Background",
  "settings.font.label": "Application font",
  "settings.density.label": "Display density",
  "settings.density.comfortable": "Comfortable",
  "settings.density.compact": "Compact",
  "settings.textScale.label": "Text size",
  "settings.textScale.decrease": "Decrease text size",
  "settings.textScale.increase": "Increase text size",

  "settings.measurement.preset": "Measurement units",
  "settings.measurement.imperial": "Imperial",
  "settings.measurement.metric": "Metric",
  "settings.measurement.category.speed": "Speed",
  "settings.measurement.category.length": "Length",
  "settings.measurement.category.calibre": "Calibre",
  "settings.measurement.category.armour": "Armour",
  "settings.measurement.category.range": "Range",
  "settings.measurement.category.mass": "Mass",
  "settings.measurement.category.volume": "Volume",
  "settings.measurement.category.power": "Power",
  "settings.numberScale.label": "Number style",
  "settings.numberScale.full": "Full",
  "settings.numberScale.abbreviated": "Abbreviated",

  "settings.currency.label": "Currency display",
  "settings.currency.navalCredits": "Naval Credits",
  "settings.currency.budgetPoints": "Budget Points",
  "settings.currency.nationalHistorical": "National Historical",
  "settings.currency.unavailable.noActiveNation": "Available once a campaign is open.",
  "settings.currency.unavailable.nationalCurrencyNotConfigured":
    "No validated historical currency is configured for this nation.",
  "settings.currency.unavailable.nationalCurrencyInvalid":
    "The historical currency configuration for this nation is invalid.",
  "settings.currency.unavailable.nationalCurrencyOutsideSupportedPeriod":
    "The historical currency is not defined for this period.",

  "settings.language.label": "Language",
  "settings.language.en": "English",
  "settings.locale.label": "Number and date formatting",
  "settings.locale.en-US": "English (United States)",

  "settings.reducedMotion.label": "Motion",
  "settings.reducedMotion.system": "Follow system",
  "settings.reducedMotion.reduce": "Reduce motion",
  "settings.reducedMotion.noPreference": "No preference",
  "settings.tooltipDetail.label": "Tooltip detail",
  "settings.tooltipDetail.minimal": "Minimal",
  "settings.tooltipDetail.standard": "Standard",
  "settings.tooltipDetail.detailed": "Detailed",

  "settings.reset.all": "Reset all to defaults",
  "settings.reset.section": "Reset section",

  "shell.app.name": "Bluewave",
  "shell.campaign.loading": "Loading campaign…",

  "nav.section.admiralty": "Admiralty",
  "nav.section.operations": "Operations",
  "nav.section.government": "Government",
  "nav.section.foreign": "Foreign",
  "nav.section.developer": "Developer",
  "nav.section.settings": "Settings",

  "nav.screen.overview.label": "Overview",
  "nav.screen.overview.short": "Overview",
  "nav.screen.construction.label": "Construction",
  "nav.screen.construction.short": "Build",
  "nav.screen.fleet.label": "Fleet",
  "nav.screen.fleet.short": "Fleet",
  "nav.screen.simulation.label": "Simulation & Turn",
  "nav.screen.simulation.short": "Sim",
  "nav.screen.tactical-sandbox.label": "Tactical Sandbox",
  "nav.screen.tactical-sandbox.short": "Sandbox",
  "nav.screen.debugging.label": "Debugging & Telemetry",
  "nav.screen.debugging.short": "Debug",
  "nav.screen.map-prototype.label": "Map Prototype",
  "nav.screen.map-prototype.short": "Map",
  "nav.screen.research.label": "Research & Technology",
  "nav.screen.research.short": "Research",
  "nav.screen.diplomacy.label": "Diplomacy & War",
  "nav.screen.diplomacy.short": "Diplomacy",
  "nav.screen.treasury.label": "Treasury",
  "nav.screen.treasury.short": "Treasury",
  "nav.screen.campaign-preferences.label": "Campaign Preferences",
  "nav.screen.campaign-preferences.short": "Prefs",
  "nav.screen.options.label": "Options",
  "nav.screen.options.short": "Options",

  "nav.bottom.landmark": "Campaign",
  "nav.bottom.shipbuilding": "Ship design",

  "shell.header.title.default": "Naval Ministry",
  "shell.header.back": "Go back",
  "shell.header.forward": "Go forward",
  "shell.header.advanceMonth.label": "Advance Month",
  "shell.header.advanceMonth.aria": "Advance month",
  "shell.header.advanceMonth.title": "Resolve the current strategic month",
  "shell.header.advanceMonth.advancing": "Advancing…",
  "shell.header.campaignMenu.aria": "Campaign menu",
  "shell.header.campaignMenu.title": "Save, copy or close the campaign",
  "shell.header.campaignMenu.label": "Campaign",
  "shell.header.menu.save": "Save",
  "shell.header.menu.saving": "Saving…",
  "shell.header.menu.copy": "Copy game…",
  "shell.header.menu.close": "Close campaign…",
  "shell.header.closeDialog.title": "Close this campaign?",
  "shell.header.closeDialog.description":
    "You will be returned to the campaign file screen. Unsaved progress may be lost.",
  "shell.header.closeDialog.cancel": "Cancel",
  "shell.header.closeDialog.confirm": "Close campaign",
  "shell.header.status.prefix": "Status:",
  "shell.header.metric.notReported": "is not reported by the engine yet",

  "shell.header.menu.leading": "Active database (SQLite)",
  "shell.header.menu.trailing": "Ready for operation",
  "shell.header.editor.scenario": "Active scenario: editing initial parameters",
  "shell.header.editor.validate": "Validate parameters",
  "shell.header.editor.save": "Save changes",
  "shell.header.campaign.atWar": "At war",
  "shell.header.campaign.armedPeace": "Armed peace",
  "shell.header.wizard.heading": "Campaign setup assistant",
  "shell.header.wizard.hint": "Select the historical scenario to continue",
  "shell.header.preferences.label": "Preferences:",
  "shell.header.preferences.detail": "Storage directory and interface settings",
  "shell.header.metric.nation": "Nation",
  "shell.header.metric.budget": "Budget",
  "shell.header.metric.balance": "Projected balance",
  "shell.header.metric.alerts": "Alerts",
  "shell.header.metric.prestige": "Prestige",
  "shell.header.metric.tension": "World tension",

  "shell.search.aria": "Search",
  "shell.search.title": "Search (Ctrl+F)",
  "shell.search.dialog.title": "Search",
  "shell.search.dialog.description": "Jump to any campaign screen",
  "shell.search.placeholder": "Search screens…",
  "shell.search.hint": "Type to search screens…",
  "shell.search.empty": "No screens found.",
  "shell.search.group": "Screens",

  "fleet.station.title": "Ships and foreign-station status",
  "fleet.station.intro":
    "Status codes follow the manual's ship list. Assign or clear foreign-station status for the ships you select; the engine checks the whole selection when you advance the month.",
  "fleet.station.empty": "You have no ships to list.",
  "fleet.station.col.select": "Select",
  "fleet.station.col.ship": "Ship",
  "fleet.station.col.area": "Area",
  "fleet.station.col.status": "Status",
  "fleet.station.col.colonial": "c",
  "fleet.station.col.cramped": "a",
  "fleet.station.col.range": "L/S",
  "fleet.station.col.colonial.label": "Colonial service",
  "fleet.station.col.cramped.label": "Cramped accommodation",
  "fleet.station.col.range.label": "Range",
  "fleet.station.selectShip": "Select {ship}",
  "fleet.station.selected": "{n} selected",
  "fleet.station.selectedNone": "No ships selected",
  "fleet.station.action.assign": "Assign to foreign station",
  "fleet.station.action.clear": "Clear foreign station",
  "fleet.station.action.busy": "Waiting for the engine",
  "fleet.station.queued.assign":
    "Foreign-station assignment queued for {n} ship(s). The engine applies it when you advance the month.",
  "fleet.station.queued.clear":
    "Foreign-station clearing queued for {n} ship(s). The engine applies it when you advance the month.",
  "fleet.station.rejected.assign": "Assignment rejected. Nothing was queued.",
  "fleet.station.rejected.clear": "Clearing rejected. Nothing was queued.",
  "fleet.station.rejected.other": "Rejected. Nothing was queued.",
  "fleet.station.reason.EMPTY_BATCH": "No ship was selected.",
  "fleet.station.reason.DUPLICATE_SHIP": "was selected more than once.",
  "fleet.station.reason.NOT_OWNED": "is not one of your ships.",
  "fleet.station.reason.UNDER_CONSTRUCTION": "is still under construction.",
  "fleet.station.reason.NOT_OPERATIONAL": "is not operational.",
  "fleet.station.reason.NOT_ACTIVE":
    "is not on active service; only active-fleet ships can be assigned.",
  "fleet.station.reason.ALREADY_ASSIGNED": "is already on foreign station.",
  "fleet.station.reason.NOT_ASSIGNED": "is not on foreign station.",
  "fleet.station.reason.unknown": "was rejected ({code}).",
  "fleet.station.retry": "The last command may not have reached the engine.",
  "fleet.station.retry.action": "Retry",
  "fleet.station.reload": "Reload",
  "fleet.station.refresh": "Refresh",
  "fleet.status.AF": "Active fleet",
  "fleet.status.RF": "Reserve fleet",
  "fleet.status.MB": "Mothballed",
  "fleet.status.WU": "Working up",
  "fleet.status.FS": "On foreign station",
  "fleet.status.repair.one": "In repair for 1 more month",
  "fleet.status.repair.many": "In repair for {n} more months",
  "fleet.status.overBase":
    "Needs maintenance: should return to an area with sufficient base capacity",
  "fleet.flag.c": "Equipped for colonial service",
  "fleet.flag.a": "Cramped accommodation",
  "fleet.flag.S": "Short range",
  "fleet.flag.none": "None",
  "fleet.presence.title": "Foreign-station presence",
  "fleet.presence.notConfigured":
    "Foreign-station presence is not configured for this campaign, so no requirement applies.",
  "fleet.presence.exempt":
    "Blockade exemption: you are at war and blockaded, so the presence requirement is suspended in every area and no shortfall is charged.",
  "fleet.presence.noAreas": "You have no presence areas.",
  "fleet.presence.col.area": "Area",
  "fleet.presence.col.required": "Required",
  "fleet.presence.col.present": "Present",
  "fleet.presence.col.shortfall": "Shortfall",
  "fleet.presence.tons": "{n} t",
  "fleet.presence.met": "None (requirement met)",
  "fleet.presence.suspended": "None (suspended)",
  "fleet.overBase.title": "Ships beyond the base limit",
  "fleet.overBase.none": "No ships are beyond a base limit.",
  "fleet.overBase.item": "{ship} in {area}",

  // T-1 03 (#112): the battle offer dialog. Kept in the renderer catalogue, not the compiled content catalogue,
  // so a dormant feature does not move the content lock; the keys are stable and migrate with the go-live ticket.
  "messages.offer.request.title": "Battle offered",
  "messages.offer.request.body":
    "A battle is offered at {areaId} between {attackerId} and {defenderId}. Review the estimate of the enemy force, then choose how to proceed.",
  "ui.offer.field.mission": "Mission",
  "ui.offer.field.class": "Acceptance class",
  "ui.offer.field.area": "Area",
  "ui.offer.field.sides": "Sides",
  "ui.offer.field.yourSide": "Your side",
  "ui.offer.sides.value": "{attackerId} (attacker) against {defenderId} (defender)",
  "ui.offer.mission.FLEET_BATTLE": "Fleet battle",
  "ui.offer.mission.CRUISER_BATTLE": "Cruiser battle",
  "ui.offer.class.OPTIONAL": "Optional",
  "ui.offer.class.POLITICALLY_EXPECTED": "Politically expected",
  "ui.offer.class.OPERATIONALLY_UNAVOIDABLE": "Operationally unavoidable",
  "ui.offer.side.ATTACKER": "Attacker",
  "ui.offer.side.DEFENDER": "Defender",
  "ui.offer.force.heading": "Your force",
  "ui.offer.force.ship": "{name} ({classId})",
  "ui.offer.estimate.EXACT": "Enemy strength: {strength}",
  "ui.offer.estimate.BANDED": "Enemy strength: about {strength} (banded estimate)",
  "ui.offer.estimate.PERTURBED": "Enemy strength: about {strength} (an estimate, may be off)",
  "ui.offer.support.present": "A friendly support force is present.",
  "ui.offer.support.presentFrom": "A friendly support force from {nations} is present.",
  "ui.offer.support.absent": "No friendly support force is present.",
  "ui.offer.accept": "Accept battle",
  "ui.offer.accept.hint":
    "Fight the battle. Until the tactical screen exists, your staff resolves it as battles are resolved today.",
  "ui.offer.delegate": "Delegate to staff",
  "ui.offer.delegate.hint":
    "Accept the battle and let your staff resolve it. It costs nothing extra.",
  "ui.offer.abandon": "Abandon this turn",
  "ui.offer.result.accept": "Battle at {areaId} accepted and resolved.",
  "ui.offer.result.delegate": "Battle at {areaId} delegated to staff and resolved.",
  "ui.offer.decline": "Decline battle",
  "ui.offer.decline.unavoidable":
    "This battle is operationally unavoidable, so it cannot be declined.",
  "ui.offer.result.decline": "Battle at {areaId} declined.",
  "ui.offer.result.decline.cost":
    "Battle at {areaId} declined; {victoryPointCost} victory points lost.",
  "messages.battle.declined.title": "Battle declined",
  "messages.battle.declined.body":
    "{nationId} declined the battle at {areaId} and lost {victoryPointCost} victory points.",
  "messages.battle.declineThreshold.title": "Repeated battle declines",
  "messages.battle.declineThreshold.body":
    "{nationId} has now declined {count} battles, reaching the threshold of {threshold}.",
  "messages.battle.enemyDeclined.title": "Enemy withdrew from battle",
  "messages.battle.enemyDeclined.body":
    "{enemyNationId} withdrew from the battle at {areaId}; no engagement took place.",
  "ui.offer.decline.costsVictoryPoints": "Declining a battle costs victory points.",
  "ui.offer.decline.mayCostPrestige": "Repeated declines may also cost prestige.",
} as const;

export type MessageKey = keyof typeof EN_US_MESSAGES;

/** Catalogues per language; only fully supported languages appear (ADR-0209). */
const CATALOGUES: Readonly<
  Record<LanguagePreference, Readonly<Partial<Record<MessageKey, string>>>>
> = {
  en: EN_US_MESSAGES,
};

/** Keys requested that were absent from every catalogue (for tests/telemetry). */
const missingKeys = new Set<string>();

/** The keys that were ever missing (a development aid; never shown to the player). */
export function missingMessageKeys(): readonly string[] {
  return [...missingKeys];
}

/** Warns in development only (ADR-0209); production is a no-op. */
function defaultMissingKeyWarner(key: string): void {
  if (import.meta.env?.DEV) {
    console.warn(`[strings] missing message key: ${key}`);
  }
}

let missingKeyWarned: (key: string) => void = defaultMissingKeyWarner;

/** Override the missing-key warning sink (used by tests), or omit to restore the default. */
export function setMissingKeyWarner(warn?: (key: string) => void): void {
  missingKeyWarned = warn ?? defaultMissingKeyWarner;
}

/**
 * Resolve a message keyed in the catalogue. Falls back to the complete en-US
 * catalogue; if a key is missing everywhere, warns in development and returns an
 * empty string rather than a raw key (ADR-0209: no raw keys in production).
 */
export function translate(key: string, language: LanguagePreference = "en"): string {
  const fromLanguage = CATALOGUES[language]?.[key as MessageKey];
  if (fromLanguage !== undefined) return fromLanguage;
  const fallback = EN_US_MESSAGES[key as MessageKey];
  if (fallback !== undefined) return fallback;
  missingKeys.add(key);
  missingKeyWarned(key);
  return "";
}
