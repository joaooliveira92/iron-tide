// weather_generation phase (registry order 0.5; DESIGN-42 §1 / ADR-0025):
// authoritative per-area current-month StrategicWeatherState from the canonical
// climate profile over the keyed stream `campaign/weather/<areaId>/<month>`.
import type { CampaignWeatherState } from "@bluewave/campaign";
import {
  type ClimateProfile,
  defaultClimateProfile_v1,
  generateStrategicWeather,
  WEATHER_PROFILE_INCOMPLETE,
} from "@bluewave/combat";
import type { MonthContext } from "./monthContext.js";

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
      continue; // fail-closed: recorded, area simply not committed this month
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
