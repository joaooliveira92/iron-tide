import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_APP_PREFERENCES } from "../../../shared/preferences-contract.js";
import { OPTIONS_DEPARTMENT_ORDER } from "./options-departments.js";
import { departmentResetPatch } from "./options-reset.js";

describe("departmentResetPatch", () => {
  it("resets every preference from General", () => {
    expect(departmentResetPatch("general")).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it.each([
    ["appearance", ["theme", "background", "font", "interfaceDensity", "textScale"]],
    ["measurements", ["measurementPreset", "measurementSelections"]],
    ["currency", ["currencyDisplayMode", "numberScale"]],
    ["language", ["language", "formattingLocale"]],
    ["accessibility", ["reducedMotion", "tooltipDetail"]],
  ] as const)("limits %s to its own keys at their defaults", (id, keys) => {
    const patch = departmentResetPatch(id);
    expect(Object.keys(patch).toSorted()).toEqual([...keys].toSorted());
    for (const key of keys) expect(patch[key]).toEqual(DEFAULT_APP_PREFERENCES[key]);
  });

  it("covers each department exactly once without overlap outside General", () => {
    const seen = new Set<string>();
    for (const id of OPTIONS_DEPARTMENT_ORDER) {
      if (id === "general") continue;
      for (const key of Object.keys(departmentResetPatch(id))) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(Object.keys(DEFAULT_APP_PREFERENCES).length);
  });
});
