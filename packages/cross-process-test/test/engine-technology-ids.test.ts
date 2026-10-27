import { HEAVY_JET_TECHNOLOGY, LIGHT_JET_TECHNOLOGY } from "@bluewave/combat/carrier-operations";
import { CONTROLLED_MINE_TECHNOLOGY, SHIPPED_MINE_TYPE_DEFINITIONS } from "@bluewave/combat/mines";
import {
  MINELAYING_SUBMARINE_TECHNOLOGY,
  MISSILE_SUBMARINE_TECHNOLOGY,
  SHIPPED_SUBMARINE_TYPE_DEFINITIONS,
} from "@bluewave/combat/submarines";
import { AVIATION_TECHNOLOGY } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionBundle } from "../src/production-pack.js";

describe("engine technology ids against the production catalogue (#278)", () => {
  const catalogue = new Set(compileProductionBundle().bundle.technologies.map((t) => t.id));

  it("reads the catalogue's carrier-borne jet technology for light jet operations", () => {
    expect(catalogue.has(LIGHT_JET_TECHNOLOGY)).toBe(true);
  });

  it("reads the catalogue's heavy-jet carrier operations technology", () => {
    expect(catalogue.has(HEAVY_JET_TECHNOLOGY)).toBe(true);
  });

  it("reads the catalogue's influence-mine technology for magnetic and acoustic mines", () => {
    const ids = SHIPPED_MINE_TYPE_DEFINITIONS.filter((mine) =>
      /magnetic|acoustic/i.test(mine.mineTypeId),
    ).flatMap((mine) => mine.technologyPrerequisiteIds);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(catalogue.has(id), id).toBe(true);
  });

  it("reads the catalogue's controlled-mine technology", () => {
    expect(catalogue.has(CONTROLLED_MINE_TECHNOLOGY)).toBe(true);
  });

  it("reads the catalogue's ocean-going submarine technology for long-range submarines", () => {
    const ids = SHIPPED_SUBMARINE_TYPE_DEFINITIONS.filter(
      (submarine) => submarine.submarineTypeId === "LONG_RANGE",
    ).flatMap((submarine) => submarine.technologyPrerequisiteIds);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(catalogue.has(id), id).toBe(true);
  });

  it("reads the catalogue's minelaying and missile submarine technologies", () => {
    const ids = SHIPPED_SUBMARINE_TYPE_DEFINITIONS.filter(
      (submarine) =>
        submarine.submarineTypeId === "MINELAYING" || submarine.submarineTypeId === "MISSILE",
    ).flatMap((submarine) => submarine.technologyPrerequisiteIds);
    expect(ids).toEqual(
      expect.arrayContaining([MINELAYING_SUBMARINE_TECHNOLOGY, MISSILE_SUBMARINE_TECHNOLOGY]),
    );
    for (const id of ids) expect(catalogue.has(id), id).toBe(true);
  });

  it("reads the catalogue's aviation technology for the aircraft-development gate", () => {
    expect(catalogue.has(AVIATION_TECHNOLOGY)).toBe(true);
  });
});
