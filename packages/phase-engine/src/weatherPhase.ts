import type { CampaignWeatherState } from "@bluewave/campaign";
import {
  type ClimateProfile,
  defaultClimateProfile_v1,
  generateStrategicWeather,
  WEATHER_PROFILE_INCOMPLETE,
} from "@bluewave/combat/weather";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";

export function runWeatherGenerationPhase(ctx: PhaseContext): PhaseRunOutcome {
  const { collector, campaignMonth, options, randomLedger } = ctx;

  const areas = [...ctx.snapshot.read("world")["areas"]].sort((a, b) =>
    a["id"] < b["id"] ? -1 : a["id"] > b["id"] ? 1 : 0,
  );
  const priorWeather = ctx.snapshot.read("strategicWeather") ?? [];
  const priorByArea = new Map(priorWeather.map((s) => [s["areaId"], s] as const));
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
          campaignSeed: ctx.rng.seed(),
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
  if (nextWeather.length > 0 || priorWeather.length > 0) {
    ctx.snapshot.write("strategicWeather", nextWeather);
  }
  return { status: "continue" };
}

export const weatherGenerationPhase: MonthPhase = {
  id: "weather_generation",
  name: "Strategic Weather Generation",
  permissions: { reads: ["world", "strategicWeather"], writes: ["strategicWeather"], rng: true },
  run: runWeatherGenerationPhase,
};
