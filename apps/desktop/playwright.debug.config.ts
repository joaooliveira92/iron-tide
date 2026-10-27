import baseConfig from "./playwright.config.js";

process.env.BLUEWAVE_E2E_DEBUG_BUILD = "true";

export default {
  ...baseConfig,
  testIgnore: [],
  testMatch: "**/*.debug.spec.ts",
};
