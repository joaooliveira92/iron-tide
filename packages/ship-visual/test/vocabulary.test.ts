import { describe, expect, it } from "vite-plus/test";
import {
  VISUAL_ERA_RULESET,
  mountClassOf,
  nationStyleOf,
  sizeBandOf,
  visualEraOf,
} from "../src/index.js";

describe("visualEraOf (ship-visual-era/1)", () => {
  it.each([
    ["1880-01", "VICTORIAN"],
    ["1895-12", "VICTORIAN"],
    ["1896-01", "PRE_DREADNOUGHT"],
    ["1905-12", "PRE_DREADNOUGHT"],
    ["1906-01", "DREADNOUGHT"],
    ["1935-12", "DREADNOUGHT"],
    ["1936-01", "LATE_DREADNOUGHT"],
    ["1970-06", "LATE_DREADNOUGHT"],
    ["1850-03", "VICTORIAN"],
  ])("%s is %s", (month, era) => {
    expect(visualEraOf(month)).toBe(era);
  });

  it.each(["1890", "1890-13", "1890-00", "", "abcd-01"])(
    "a malformed month (%j) is null, never a silent default",
    (month) => {
      expect(visualEraOf(month)).toBeNull();
    },
  );

  it("is versioned", () => {
    expect(VISUAL_ERA_RULESET).toBe("ship-visual-era/1");
  });
});

describe("nationStyleOf", () => {
  it.each([
    ["austria_hungary", "A"],
    ["uk", "B"],
    ["france", "F"],
    ["germany", "G"],
    ["italy", "I"],
    ["japan", "J"],
    ["qing", "Q"],
    ["russia", "R"],
    ["spain", "S"],
    ["usa", "U"],
  ])("%s has the manual's %s style", (nation, style) => {
    expect(nationStyleOf(nation)).toBe(style);
  });

  it.each(["ottoman_empire", "brazil", "siam", "unknown"])(
    "%s falls back to universal X",
    (nation) => {
      expect(nationStyleOf(nation)).toBe("X");
    },
  );
});

describe("sizeBandOf (whole inches, manual p141)", () => {
  it.each([
    [76_200, "SMALL"], // 3 in
    [127_000, "SMALL"], // 5 in
    [139_700, "MEDIUM"], // 5.5 in rounds to 6
    [152_400, "MEDIUM"], // 6 in
    [279_400, "MEDIUM"], // 11 in
    [292_100, "LARGE"], // 11.5 in rounds to 12
    [305_000, "LARGE"], // 12 in
    [406_000, "LARGE"], // 16 in
  ])("%i µm is %s", (um, band) => {
    expect(sizeBandOf(um)).toBe(band);
  });
});

describe("mountClassOf", () => {
  it.each([
    ["TURRET", "TURRET"],
    ["BARBETTE", "BARBETTE"],
    ["DECK_SHIELDED", "SHIELDED"],
    ["DECK_OPEN", "OPEN"],
    ["CASEMATE", "CASEMATE"],
    ["BROADSIDE_BATTERY", "CASEMATE"],
  ])("armament %s draws as %s", (mountType, cls) => {
    expect(mountClassOf("SECONDARY_GUN", mountType)).toBe(cls);
  });

  it("torpedo tubes are not gun mounts", () => {
    expect(mountClassOf("TORPEDO_TUBE", "ABOVE_WATER_TUBE")).toBeNull();
    expect(mountClassOf("MAIN_GUN", "SUBMERGED_TUBE")).toBeNull();
  });

  it("without a compiled mount type, a main gun is a turret and any other gun is shielded", () => {
    expect(mountClassOf("MAIN_GUN", undefined)).toBe("TURRET");
    expect(mountClassOf("SECONDARY_GUN", undefined)).toBe("SHIELDED");
    expect(mountClassOf("AA_WEAPON", undefined)).toBe("SHIELDED");
  });

  it("non-gun categories are not gun mounts", () => {
    expect(mountClassOf("BOILER", undefined)).toBeNull();
  });
});
