import { evaluateShipTypeAvailability, SHIP_TYPE_LIST } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "./content.js";
import { shipTypeChoices } from "./shipTypes.js";

describe("ship type choices read the content registry", () => {
  const content = loadDrawingBoardContent();
  const ctx = content.environmentFor("1880-01").ctx;

  it("offers exactly the types the compiler treats as available", () => {
    const offered = shipTypeChoices(ctx, "DD").map((c) => c.value);
    const available = SHIP_TYPE_LIST.filter(
      (t) =>
        evaluateShipTypeAvailability(t.id, {
          month: ctx.month,
          unlockedTechs: ctx.unlockedTechs,
          capabilities: ctx.capabilities,
          restrictedTypes: ctx.restrictedShipTypes,
        }).available,
    ).map((t) => t.id);
    expect(offered).toEqual(available);
  });

  it("follows a content record that opens a type the code constant gates", () => {
    expect(ctx.shipTypes).toBeDefined();
    expect(shipTypeChoices(ctx, "DD").map((c) => c.value)).not.toContain("BB");
    const opened = {
      ...ctx,
      shipTypes: (ctx.shipTypes ?? []).map((record) =>
        record.id === "BB"
          ? {
              ...record,
              availability: {
                fromEra: "EARLY" as const,
                requiresTech: null,
                requiresCapability: null,
                mechanicsImplemented: true,
              },
            }
          : record,
      ),
    };
    expect(shipTypeChoices(opened, "DD").map((c) => c.value)).toContain("BB");
  });
});
