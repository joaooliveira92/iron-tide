import type { CampaignWeatherState } from "@bluewave/campaign";
import {
  type ClimateProfile,
  defaultClimateProfile_v1,
  generateStrategicWeather,
  WEATHER_PROFILE_INCOMPLETE,
} from "@bluewave/combat/weather";
import type { MonthContext } from "./monthContext.js";
import type { PhaseDescriptor } from "./registry.js";
import { PhaseResource } from "./phase-resource.js";

export function runWeatherGenerationPhase(ctx: MonthContext): void {
  const { currentSnapshot, collector, campaignMonth, randomSeed, options, randomLedger } = ctx;

  const areas = [...currentSnapshot["world"]["areas"]].sort((a, b) =>
    a["id"] < b["id"] ? -1 : a["id"] > b["id"] ? 1 : 0,
  );
  const priorByArea = new Map(
    (currentSnapshot["strategicWeather"] ?? []).map((s) => [s["areaId"], s] as const),
  );
  const climateSource = options?.["climateProfiles"];
  const profileFor = (areaId: string): ClimateProfile | undefined =>
    climateSource === undefined ? defaultClimateProfile_v1 : climateSource.get(areaId);

  const nextWeather: CampaignWeatherState[] = [];
  for (const area of areas) {
    const profile = profileFor(area["id"]);
    if (!profile) {
      collector.addError(
        WEATHER_PROFILE_INCOMPLETE,
        `No climate profile for strategic area ${area["id"]}`,
        { stage: "weather_generation", entityId: area["id"] },
      );
      continue;
    }
    try {
      nextWeather.push(
        generateStrategicWeather({
          areaId: area["id"],
          month: campaignMonth,
          climateProfile: profile,
          campaignSeed: randomSeed,
          priorState: priorByArea.get(area["id"]),
          randomLedger,
        }),
      );
    } catch (e) {
      collector.addError(
        WEATHER_PROFILE_INCOMPLETE,
        `Strategic weather generation failed for area ${area["id"]}: ${(e as Error).message}`,
        { stage: "weather_generation", entityId: area["id"] },
      );
    }
  }
  if (nextWeather.length > 0 || (currentSnapshot["strategicWeather"] ?? []).length > 0) {
    ctx.currentSnapshot = { ...currentSnapshot, strategicWeather: nextWeather };
  }
}

export const weatherGenerationPhase: PhaseDescriptor = {
  id: "weather_generation",
  name: "Strategic Weather Generation",
  order: 5,
  readPermissions: ["all"],
  writePermissions: ["strategicWeather"],
  rngAllowed: true,
  footprint: {
    reads: [PhaseResource.ALL],
    writes: [PhaseResource.STRATEGIC_WEATHER],
    usesRng: true,
  },
  run: (ctx) => {
    runWeatherGenerationPhase(ctx);
    return { status: "continue" };
  },
};
