import { ZONE_IDS } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { addZoneFor, allowedZonesFor, isMountSide, zoneLabel } from "./placement-helpers.js";

const [first, second] = ZONE_IDS;

describe("zoneLabel", () => {
  it("lower-cases zone ids and replaces underscores with spaces", () => {
    expect(zoneLabel("SUPERSTRUCTURE")).toBe("superstructure");
    expect(zoneLabel("ENGINE_ROOM")).toBe("engine room");
  });
});

describe("isMountSide", () => {
  it("accepts only the three mount sides", () => {
    expect(["CENTRE", "PORT", "STBD"].every(isMountSide)).toBe(true);
    expect(isMountSide("centre")).toBe(false);
    expect(isMountSide("")).toBe(false);
  });
});

describe("allowedZonesFor", () => {
  it("returns the entry's allowed zones when declared", () => {
    expect(allowedZonesFor({ allowedZones: [second] })).toEqual([second]);
  });

  it("falls back to every zone when the entry is missing or unrestricted", () => {
    expect(allowedZonesFor(undefined)).toEqual([...ZONE_IDS]);
    expect(allowedZonesFor({})).toEqual([...ZONE_IDS]);
  });
});

describe("addZoneFor", () => {
  it("keeps the selected zone when the entry allows it", () => {
    expect(addZoneFor({ allowedZones: [first, second] }, second)).toBe(second);
  });

  it("falls back to the first allowed zone when the selection is not allowed", () => {
    expect(addZoneFor({ allowedZones: [second] }, first)).toBe(second);
  });
});
