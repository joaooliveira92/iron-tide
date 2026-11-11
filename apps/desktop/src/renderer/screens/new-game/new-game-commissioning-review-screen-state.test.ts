import { ARCHETYPE_PRESETS, type ArchetypeSelection } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { PLAYABLE_SLOT_COUNTRY_IDS } from "../../content/nationAssetManifest.js";
import type { NewGameNation, NewGameOptions } from "../../../shared/new-game-contract.js";
import { defaultFleetMethod } from "./new-game-fleet-method-screen-state.js";
import { defaultCampaignIdentity } from "./new-game-identity-screen-state.js";
import {
  activePresetAnnotation,
  buildStrategicForecast,
  buildSummaryRows,
} from "./new-game-commissioning-review-screen-state.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

const CANONICAL_SCENARIO_IDS = [
  "scen_1880",
  "scen_1900",
  "scen_1920",
  "scen_1935",
  "scen_1960",
] as const;

const preferences: DraftPreferences = {
  version: "campaign_configuration_v1",
  scenarioId: "scen_1900",
  continuityMode: "historical",
  fleetSize: "standard",
  researchSpeed: "standard",
  technologyVariation: "some",
  historicalBudget: "standard",
  legacyFleetMode: "generated",
  tacticalRealism: "standard",
  difficulty: "normal",
  campaignSeed: "TEST",
};

const options: NewGameOptions = {
  scenarios: [
    {
      id: "scen_1900",
      name: "1900 — The Dawn of Steel",
      startYear: 1900,
      startMonth: 1,
      participantNationIds: [],
      playableNationIds: [],
    },
  ],
  nations: [],
  supportedValues: {} as NewGameOptions["supportedValues"],
};

const archetype: ArchetypeSelection = {
  kind: "preset",
  id: ARCHETYPE_PRESETS[0]!.id,
  allocation: { ...ARCHETYPE_PRESETS[0]!.allocation },
};

const identity = {
  ...defaultCampaignIdentity(),
  admiralName: "John Fisher",
  campaignName: "Britannia Ascendant",
};

describe("buildSummaryRows", () => {
  it("renders exactly the spec §6 rows, in order, with no cut fields", () => {
    const rows = buildSummaryRows({
      nationId: "gb",
      options,
      preferences,
      archetype,
      identity,
      fleetMethod: defaultFleetMethod(),
    });

    expect(rows.map((row) => row.label)).toEqual([
      "Nation",
      "Era",
      "Fleet size",
      "Budget tier",
      "Yard capacity",
      "Research profile",
      "Gun quality",
      "Campaign seed",
      "Research Pace",
      "Technology Variation",
      "Historical Budget",
      "Tactical Realism",
      "Difficulty",
      "Starting fleet method",
      "Archetype",
      "Naming convention",
      "Ship name reuse",
      "Measurement system",
      "Admiral",
      "Campaign name",
    ]);
    expect(rows.find((row) => row.label === "Nation")?.value).toBe("United Kingdom");
    expect(rows.find((row) => row.label === "Era")?.value).toBe("1900 — The Dawn of Steel");
    expect(rows.find((row) => row.label === "Starting fleet method")?.value).toBe(
      "Inherit an Existing Navy",
    );
    expect(rows.find((row) => row.label === "Archetype")?.value).toBe(ARCHETYPE_PRESETS[0]!.name);
    expect(rows.find((row) => row.label === "Admiral")?.value).toBe("John Fisher");
    expect(rows.find((row) => row.label === "Campaign name")?.value).toBe("Britannia Ascendant");
  });

  it("labels a custom archetype allocation as Custom", () => {
    const rows = buildSummaryRows({
      nationId: "gb",
      options,
      preferences,
      archetype: { kind: "custom", allocation: { economy: 8, industry: 8, combat: 4 } },
      identity,
      fleetMethod: defaultFleetMethod(),
    });
    expect(rows.find((row) => row.label === "Archetype")?.value).toBe("Custom");
  });

  it("resolves the draft's compiled nation id (uk) to its presentation name", () => {
    const rows = buildSummaryRows({
      nationId: "uk",
      options,
      preferences,
      archetype,
      identity,
      fleetMethod: defaultFleetMethod(),
    });
    expect(rows.find((row) => row.label === "Nation")?.value).toBe("United Kingdom");
  });

  it("groups and icon-tags every row", () => {
    const rows = buildSummaryRows({
      nationId: "uk",
      options,
      preferences,
      archetype,
      identity,
      fleetMethod: defaultFleetMethod(),
    });
    expect(rows.find((row) => row.label === "Nation")?.group).toBe("command");
    expect(rows.find((row) => row.label === "Difficulty")?.group).toBe("uncertainty");
    expect(rows.find((row) => row.label === "Campaign name")?.group).toBe("identity");
    expect(rows.every((row) => row.icon.length > 0)).toBe(true);
  });
});

describe("buildSummaryRows commissioning facts", () => {
  const withFacts = (commissioning: NewGameNation["commissioning"]): NewGameOptions => ({
    ...options,
    nations: [
      {
        id: "uk",
        name: "United Kingdom",
        regimeName: "Constitutional Monarchy",
        regimeType: "monarchy",
        commissioning,
      },
    ],
  });
  const rowsFor = (opts: NewGameOptions) =>
    buildSummaryRows({
      nationId: "uk",
      options: opts,
      preferences,
      archetype,
      identity,
      fleetMethod: defaultFleetMethod(),
    });
  const value = (rows: ReturnType<typeof rowsFor>, label: string) =>
    rows.find((row) => row.label === label)?.value;

  it("renders the domain facts for the chosen nation and the seed", () => {
    const rows = rowsFor(
      withFacts({
        budgetLevel: "high",
        yardCapacityKg: 12_500_000,
        researchPriorities: [
          { field: "naval_gunnery", priority: 4 },
          { field: "armour_plate", priority: 3 },
          { field: "propulsion", priority: 2 },
          { field: "fire_control", priority: 1 },
        ],
        gunQualityBands: [
          { id: "light", minCaliberUm: 0, maxCaliberUm: 100_000, quality: 80 },
          { id: "heavy", minCaliberUm: 100_000, maxCaliberUm: 400_000, quality: 95 },
        ],
      }),
    );
    expect(value(rows, "Budget tier")).toBe("High");
    expect(value(rows, "Yard capacity")).toBe("12,500 t");
    expect(value(rows, "Research profile")).toBe("Naval gunnery, Armour plate, Propulsion");
    expect(value(rows, "Gun quality")).toBe("2 authored bands, quality 80–95");
    expect(value(rows, "Campaign seed")).toBe("TEST");
    for (const label of [
      "Budget tier",
      "Yard capacity",
      "Research profile",
      "Gun quality",
      "Campaign seed",
    ]) {
      expect(rows.find((row) => row.label === label)?.group).toBe("command");
    }
  });

  it("says Not authored when the nation has no gun-quality bands or research priorities", () => {
    const rows = rowsFor(
      withFacts({
        budgetLevel: "low",
        yardCapacityKg: 500_000,
        researchPriorities: [],
        gunQualityBands: [],
      }),
    );
    expect(value(rows, "Gun quality")).toBe("Not authored");
    expect(value(rows, "Research profile")).toBe("Not authored");
  });

  it("says Not available when the facts are missing", () => {
    const rows = rowsFor(withFacts(null));
    expect(value(rows, "Budget tier")).toBe("Not available");
    expect(value(rows, "Yard capacity")).toBe("Not available");
    expect(value(rows, "Research profile")).toBe("Not available");
    expect(value(rows, "Gun quality")).toBe("Not available");
    expect(value(rowsFor(options), "Budget tier")).toBe("Not available");
  });
});

describe("activePresetAnnotation", () => {
  it("names the matching preset when the six settings match one exactly", () => {
    expect(activePresetAnnotation(preferences)).toBe("Admiral");
  });

  it("falls back to Custom when the six settings don't match a preset", () => {
    expect(activePresetAnnotation({ ...preferences, difficulty: "very_hard" })).toBe("Custom");
  });
});

describe("buildStrategicForecast", () => {
  it("templates a non-empty forecast for every playable nation, independent of settings", () => {
    for (const nationId of PLAYABLE_SLOT_COUNTRY_IDS) {
      const forecast = buildStrategicForecast(nationId, preferences);
      expect(forecast).not.toBeNull();
      expect(forecast?.appointmentTitle.length).toBeGreaterThan(0);
      expect(forecast?.doctrine.length).toBeGreaterThan(0);
      expect(forecast?.expectedPressures.length).toBeGreaterThan(0);
      for (const pressure of forecast?.expectedPressures ?? []) {
        expect(pressure.length).toBeGreaterThan(0);
      }
    }
  });

  it("templates a non-empty forecast for every playable nation × canonical era (spec §6 DoD spot-check)", () => {
    for (const scenarioId of CANONICAL_SCENARIO_IDS) {
      const eraPreferences: DraftPreferences = { ...preferences, scenarioId };
      for (const nationId of PLAYABLE_SLOT_COUNTRY_IDS) {
        const forecast = buildStrategicForecast(nationId, eraPreferences);
        expect(forecast).not.toBeNull();
        expect(forecast?.appointmentTitle.length).toBeGreaterThan(0);
        expect(forecast?.doctrine.length).toBeGreaterThan(0);
        expect(forecast?.expectedPressures.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns null for a non-playable nation id", () => {
    expect(buildStrategicForecast("unknown", preferences)).toBeNull();
  });

  it("templates a forecast from the draft's compiled nation id (uk)", () => {
    const forecast = buildStrategicForecast("uk", preferences);
    expect(forecast).not.toBeNull();
    expect(forecast?.appointmentTitle.length).toBeGreaterThan(0);
  });
});
