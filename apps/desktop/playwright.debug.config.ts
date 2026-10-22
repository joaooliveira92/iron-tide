import baseConfig from "./playwright.config.js";

export default {
  ...baseConfig,
  testIgnore: [],
  testMatch: "**/*.debug.spec.ts",
};
