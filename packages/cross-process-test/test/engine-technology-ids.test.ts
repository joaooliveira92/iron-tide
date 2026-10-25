import { LIGHT_JET_TECHNOLOGY } from "@bluewave/combat/carrier-operations";
import { SHIPPED_MINE_TYPE_DEFINITIONS } from "@bluewave/combat/mines";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionBundle } from "../src/production-pack.js";

describe("engine technology ids against the production catalogue (#278)", () => {
  const catalogue = new Set(compileProductionBundle().bundle.technologies.map((t) => t.id));

  it("reads the catalogue's carrier-borne jet technology for light jet operations", () => {
    expect(catalogue.has(LIGHT_JET_TECHNOLOGY)).toBe(true);
  });

  it("reads the catalogue's influence-mine technology for magnetic and acoustic mines", () => {
    const ids = SHIPPED_MINE_TYPE_DEFINITIONS.filter((mine) =>
      /magnetic|acoustic/i.test(mine.mineTypeId),
    ).flatMap((mine) => mine.technologyPrerequisiteIds);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(catalogue.has(id), id).toBe(true);
  });
});
