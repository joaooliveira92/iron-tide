import { createCompiledDesignVersion } from "@bluewave/campaign-engine";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { DesignFit } from "../yard-workspace.js";
import { DesignSpecRows } from "./DesignTile.js";

const design = createCompiledDesignVersion("design_majestic", {
  className: "Majestic",
  shipType: "battleship",
  nationId: "nation_uk",
  year: 1894,
  available: true,
  mass: 16000,
  speed: 16,
  machineryType: "coal_vte",
  requiredTechnologyIds: [],
  projectedCost: 160,
  projectedCapacityUnits: 16,
  costBasis: "displacement_formula",
});

const fit: DesignFit = {
  massKg: 16000 * 1016,
  dockPct: null,
  overDock: false,
  freeTreasury: 500,
  freeCapacity: 50,
  affordable: true,
  fitsCapacity: true,
  costPct: 32,
};

describe("DesignSpecRows", () => {
  it("names the design's projected work with the yard work capacity term", () => {
    const html = renderToStaticMarkup(createElement(DesignSpecRows, { design, fit }));
    expect(html).toContain("Yard work capacity");
    expect(html).not.toContain("Capacity units");
  });
});
