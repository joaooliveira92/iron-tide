//packages/combat/test/weather/contracts.test.ts
// AC-15: Contracts + validate guards — every new weather/visibility constant
// ships *_v1 + SHIPPED_WEATHER_CONTRACT + validate guard + validateAllWeatherContracts;
// pinning fails closed.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  SHIPPED_WEATHER_CONTRACT,
  validateWeatherContract,
  weatherPolicyId,
  SHIPPED_WEATHER_COMPONENTS_CONTRACT,
  validateWeatherComponentsContract,
  weatherComponentsPolicyId,
  SHIPPED_WEATHER_VISIBILITY_CONTRACT,
  validateWeatherVisibilityContract,
  weatherVisibilityPolicyId,
  SHIPPED_WEATHER_ENVIRONMENT_CONTRACT,
  validateWeatherEnvironmentContract,
  weatherEnvironmentPolicyId,
} from "../../src/weather/constants.js";
import {
  WEATHER_V1_CONTRACTS,
  validateAllWeatherContracts,
} from "../../src/weather/contractRollup.js";

describe("AC-15: weather contracts (*_v1 + SHIPPED + validate guard)", () => {
  it("weather_v1 contract ships *_v1 policy and validates", () => {
    expect(weatherPolicyId).toBe("weather_v1");
    expect(SHIPPED_WEATHER_CONTRACT.policyId).toBe("weather_v1");
    expect(() => validateWeatherContract(SHIPPED_WEATHER_CONTRACT)).not.toThrow();
    expect(() => validateWeatherContract({ ...SHIPPED_WEATHER_CONTRACT, policyId: "x" })).toThrow(
      BluewaveError,
    );
  });

  it("weather_components_v1 contract ships *_v1 policy and validates", () => {
    expect(weatherComponentsPolicyId).toBe("weather_components_v1");
    expect(SHIPPED_WEATHER_COMPONENTS_CONTRACT.policyId).toBe("weather_components_v1");
    expect(() =>
      validateWeatherComponentsContract(SHIPPED_WEATHER_COMPONENTS_CONTRACT),
    ).not.toThrow();
    expect(() =>
      validateWeatherComponentsContract({
        ...SHIPPED_WEATHER_COMPONENTS_CONTRACT,
        seaStateMin: 1,
      }),
    ).toThrow(BluewaveError);
  });

  it("weather_visibility_v1 contract ships *_v1 policy and validates", () => {
    expect(weatherVisibilityPolicyId).toBe("weather_visibility_v1");
    expect(SHIPPED_WEATHER_VISIBILITY_CONTRACT.policyId).toBe("weather_visibility_v1");
    expect(() =>
      validateWeatherVisibilityContract(SHIPPED_WEATHER_VISIBILITY_CONTRACT),
    ).not.toThrow();
    expect(() =>
      validateWeatherVisibilityContract({
        ...SHIPPED_WEATHER_VISIBILITY_CONTRACT,
        scaleExponent: 3,
      }),
    ).toThrow(BluewaveError);
  });

  it("weather_environment_v1 contract ships *_v1 policy and validates", () => {
    expect(weatherEnvironmentPolicyId).toBe("weather_environment_v1");
    expect(SHIPPED_WEATHER_ENVIRONMENT_CONTRACT.policyId).toBe("weather_environment_v1");
    expect(() =>
      validateWeatherEnvironmentContract(SHIPPED_WEATHER_ENVIRONMENT_CONTRACT),
    ).not.toThrow();
    expect(() =>
      validateWeatherEnvironmentContract({
        ...SHIPPED_WEATHER_ENVIRONMENT_CONTRACT,
        fogVisBandNoneBp: 9_999,
      }),
    ).toThrow(BluewaveError);
  });

  it("null contract fails closed", () => {
    expect(() => validateWeatherContract(null)).toThrow(BluewaveError);
    expect(() => validateWeatherComponentsContract(null)).toThrow(BluewaveError);
    expect(() => validateWeatherVisibilityContract(null)).toThrow(BluewaveError);
    expect(() => validateWeatherEnvironmentContract(null)).toThrow(BluewaveError);
  });

  it("validateAllWeatherContracts passes all four shipped contracts (rollup)", () => {
    expect(() => validateAllWeatherContracts()).not.toThrow();
  });

  it("WEATHER_V1_CONTRACTS frozen object contains all four contracts", () => {
    expect(WEATHER_V1_CONTRACTS.weather.policyId).toBe("weather_v1");
    expect(WEATHER_V1_CONTRACTS.components.policyId).toBe("weather_components_v1");
    expect(WEATHER_V1_CONTRACTS.visibility.policyId).toBe("weather_visibility_v1");
    expect(WEATHER_V1_CONTRACTS.environment.policyId).toBe("weather_environment_v1");
  });
});
