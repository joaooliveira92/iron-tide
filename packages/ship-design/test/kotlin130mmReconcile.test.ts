import { join } from "node:path";
import { FlattenedPartSchema, decodeStrict, type FlattenedPart } from "@bluewave/content-schema";
import { readAuthoredFile } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { components } from "./helpers/earlyContext.js";
import { gunPartModel } from "./helpers/gunReadPath.js";

const shipBuilding = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
);

const readParts = (file: string): FlattenedPart[] =>
  (
    (readAuthoredFile(join(shipBuilding, "parts", file)) as Record<string, unknown>)[
      "parts"
    ] as unknown[]
  ).map((record) => decodeStrict(FlattenedPartSchema, record));

const gunPart = readParts("gun.ts").find((p) => p.id === "standard_gun_130mm_50_twin");
const mountPart = readParts("gun_mount.ts").find((p) => p.id === "gun_130mm_50_twin_turret_x2");
const gunComponent = components.find((c) => c.id === "gun_130mm_50_twin");
const gunModelPart = gunPartModel.parts.find((p) => p.id === "standard_gun_130mm_50_twin");

const quantity = (part: FlattenedPart | undefined, id: string): number =>
  Number(part?.quantities.find((q) => q.id === id)?.value);

describe("Kotlin 130 mm/58 SM-2-1 gun and mount masses (issue #885)", () => {
  it("carries the navweaps 4.99 t gun on the component, the part quantity and the gun model", () => {
    expect(Number(gunComponent?.constants.gun_kg)).toBe(4990);
    expect(quantity(gunPart, "gun_mass")).toBe(4990);
    expect(gunModelPart?.spec.gunMassKg).toBe(4990);
  });

  it("carries the navweaps 57.325 t twin mount, guns included", () => {
    const perGun = quantity(mountPart, "installation_per_gun");
    expect(perGun).toBe(23673);
    const mountSpec = mountPart?.spec;
    const gunsPerMount =
      mountSpec !== undefined && "gunsPerMount" in mountSpec ? mountSpec.gunsPerMount : undefined;
    expect(gunsPerMount).toBe(2);
    const perMount = (Number(gunComponent?.constants.gun_kg) + perGun) * 2;
    expect(Math.abs(perMount - 57325)).toBeLessThanOrEqual(1);
  });

  it("re-derives the gun and mount cost from the heavier masses", () => {
    expect(quantity(gunPart, "gun_cost")).toBe(983030000);
    expect(quantity(mountPart, "mount_cost_per_gun")).toBe(4672000000);
    expect(Number(gunComponent?.constants.mount_cost_micro)).toBe(4672000000);
  });

  it("uses the 15 rounds per minute electrical loading rate", () => {
    expect(Number(gunComponent?.attributes?.rofBaseX100)).toBe(1500);
    expect(gunModelPart?.spec.mechanicalRateOfFireRoundsPerMinuteX100).toBe(1500);
  });
});
