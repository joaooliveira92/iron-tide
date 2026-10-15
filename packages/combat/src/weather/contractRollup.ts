//packages/combat/src/weather/contractRollup.ts
// INC-6: Full contract rollup for weather_v1 + weather_components_v1 +
// weather_visibility_v1 + weather_environment_v1.
// Exports a single frozen object and a combined validation function
// that proves all shipped contracts pass their own validate guards.
import {
  SHIPPED_WEATHER_CONTRACT,
  validateWeatherContract,
  SHIPPED_WEATHER_COMPONENTS_CONTRACT,
  validateWeatherComponentsContract,
  SHIPPED_WEATHER_VISIBILITY_CONTRACT,
  validateWeatherVisibilityContract,
  SHIPPED_WEATHER_ENVIRONMENT_CONTRACT,
  validateWeatherEnvironmentContract,
} from "./constants.js";

export const WEATHER_V1_CONTRACTS = {
  weather: SHIPPED_WEATHER_CONTRACT,
  components: SHIPPED_WEATHER_COMPONENTS_CONTRACT,
  visibility: SHIPPED_WEATHER_VISIBILITY_CONTRACT,
  environment: SHIPPED_WEATHER_ENVIRONMENT_CONTRACT,
} as const;

export function validateAllWeatherContracts(): void {
  validateWeatherContract(WEATHER_V1_CONTRACTS.weather);
  validateWeatherComponentsContract(WEATHER_V1_CONTRACTS.components);
  validateWeatherVisibilityContract(WEATHER_V1_CONTRACTS.visibility);
  validateWeatherEnvironmentContract(WEATHER_V1_CONTRACTS.environment);
}
