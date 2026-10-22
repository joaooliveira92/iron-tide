import { findPreset, type ArchetypeSelection } from "@bluewave/campaign-engine";
import type { PlayableSlotCountryId } from "../../content/nationAssetManifest.js";
import { isPlayableSlotCountryId } from "../../content/nationPresentationCatalog.js";
import {
  nationDossier,
  nationIdToCountryId,
  nationPresentation,
} from "../../content/presentationContent.js";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import type { FleetMethodDraft } from "./new-game-fleet-method-screen-state.js";
import { FLEET_METHOD_CARDS } from "./fleet-method-content.js";
import {
  type CampaignIdentityDraft,
  type IdentityFieldOption,
  MEASUREMENT_SYSTEM_OPTIONS,
  NAMING_CONVENTION_OPTIONS,
  SHIP_NAME_REUSE_OPTIONS,
} from "./new-game-identity-screen-state.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";
import {
  fleetSizeLabel,
  fleetSizeReadout,
  uncertaintyValueContent,
  UNCERTAINTY_FIELDS,
  UNCERTAINTY_FIELD_LABELS,
} from "./rules-of-the-naval-age-content.js";
import { detectActivePreset, PRESET_DEFINITIONS } from "./rules-of-the-naval-age-presets.js";

export interface CommissioningReviewInput {
  readonly nationId: string;
  readonly options: NewGameOptions | null;
  readonly preferences: DraftPreferences;
  readonly archetype: ArchetypeSelection;
  readonly identity: CampaignIdentityDraft;
  readonly fleetMethod: FleetMethodDraft;
}

export type SummaryGroup = "command" | "uncertainty" | "identity";

export type SummaryRowIcon =
  | "nation"
  | "era"
  | "fleetSize"
  | "researchSpeed"
  | "technologyVariation"
  | "historicalBudget"
  | "tacticalRealism"
  | "difficulty"
  | "fleetMethod"
  | "archetype"
  | "namingConvention"
  | "shipNameReuse"
  | "measurementSystem"
  | "admiral"
  | "campaignName";

export interface SummaryRow {
  readonly label: string;
  readonly value: string;
  readonly group: SummaryGroup;
  readonly icon: SummaryRowIcon;
}

function identityLabel<V extends string>(
  options: ReadonlyArray<IdentityFieldOption<V>>,
  value: V,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function resolveCountryId(nationId: string): PlayableSlotCountryId | null {
  if (isPlayableSlotCountryId(nationId)) return nationId;
  const countryId = nationIdToCountryId(nationId);
  return countryId !== null && isPlayableSlotCountryId(countryId) ? countryId : null;
}

function nationLabel(nationId: string): string {
  const countryId = resolveCountryId(nationId);
  return countryId === null ? nationId : nationPresentation(countryId).flavor.name;
}

function eraLabel(options: NewGameOptions | null, scenarioId: string): string {
  return options?.scenarios.find((scenario) => scenario.id === scenarioId)?.name ?? scenarioId;
}

function fleetMethodLabel(legacyFleetModeId: string): string {
  return (
    FLEET_METHOD_CARDS.find((card) => card.id === legacyFleetModeId)?.title ?? legacyFleetModeId
  );
}

function archetypeLabel(archetype: ArchetypeSelection): string {
  if (archetype.kind === "custom") return "Custom";
  return findPreset(archetype.id)?.name ?? archetype.id;
}

export function buildSummaryRows(input: CommissioningReviewInput): readonly SummaryRow[] {
  const { nationId, options, preferences, archetype, identity, fleetMethod } = input;
  const uncertaintyRows: SummaryRow[] = UNCERTAINTY_FIELDS.map((field) => ({
    label: UNCERTAINTY_FIELD_LABELS[field],
    value: uncertaintyValueContent(field, preferences[field]).label,
    group: "uncertainty",
    icon: field,
  }));
  return [
    { label: "Nation", value: nationLabel(nationId), group: "command", icon: "nation" },
    {
      label: "Era",
      value: eraLabel(options, preferences.scenarioId),
      group: "command",
      icon: "era",
    },
    {
      label: "Fleet size",
      value: fleetSizeLabel(preferences.fleetSize),
      group: "command",
      icon: "fleetSize",
    },
    ...uncertaintyRows,
    {
      label: "Starting fleet method",
      value: fleetMethodLabel(fleetMethod.legacyFleetModeId),
      group: "identity",
      icon: "fleetMethod",
    },
    { label: "Archetype", value: archetypeLabel(archetype), group: "identity", icon: "archetype" },
    {
      label: "Naming convention",
      value: identityLabel(NAMING_CONVENTION_OPTIONS, identity.namingConvention),
      group: "identity",
      icon: "namingConvention",
    },
    {
      label: "Ship name reuse",
      value: identityLabel(SHIP_NAME_REUSE_OPTIONS, identity.shipNameReuse),
      group: "identity",
      icon: "shipNameReuse",
    },
    {
      label: "Measurement system",
      value: identityLabel(MEASUREMENT_SYSTEM_OPTIONS, identity.measurementSystem),
      group: "identity",
      icon: "measurementSystem",
    },
    { label: "Admiral", value: identity.admiralName, group: "identity", icon: "admiral" },
    {
      label: "Campaign name",
      value: identity.campaignName,
      group: "identity",
      icon: "campaignName",
    },
  ];
}

export function activePresetAnnotation(preferences: DraftPreferences): string {
  const activeId = detectActivePreset(preferences);
  if (activeId === "custom") return "Custom";
  return PRESET_DEFINITIONS.find((preset) => preset.id === activeId)?.name ?? "Custom";
}

export interface StrategicForecast {
  readonly appointmentTitle: string;
  readonly doctrine: string;
  readonly strategicRegions: string;
  readonly nationalCharacteristics: string;
  readonly expectedPressures: readonly string[];
}

const SIX_SETTING_FIELDS = [
  "fleetSize",
  "researchSpeed",
  "technologyVariation",
  "historicalBudget",
  "tacticalRealism",
  "difficulty",
] as const;

export function buildStrategicForecast(
  nationId: string,
  preferences: DraftPreferences,
): StrategicForecast | null {
  const countryId = resolveCountryId(nationId);
  if (countryId === null) return null;
  const dossier = nationDossier(countryId);
  const expectedPressures = SIX_SETTING_FIELDS.map((field) =>
    field === "fleetSize"
      ? fleetSizeReadout(preferences.fleetSize)
      : uncertaintyBlurb(field, preferences),
  ).filter((blurb) => blurb.length > 0);

  return {
    appointmentTitle: dossier.appointmentTitle,
    doctrine: dossier.doctrine,
    strategicRegions: dossier.strategicRegions,
    nationalCharacteristics: dossier.nationalCharacteristics,
    expectedPressures,
  };
}

function uncertaintyBlurb(
  field: Exclude<(typeof SIX_SETTING_FIELDS)[number], "fleetSize">,
  preferences: DraftPreferences,
): string {
  return uncertaintyValueContent(field, preferences[field]).blurb;
}
