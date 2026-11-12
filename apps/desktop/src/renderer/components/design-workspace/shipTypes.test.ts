import { evaluateShipTypeAvailability, SHIP_TYPE_LIST } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "./content.js";
import { shipTypeChoices } from "./shipTypes.js";

describe("ship type choices read the content registry", () => {
  const content = loadDrawingBoardContent();
  const ctx = content.environmentFor("1880-01").ctx;

  const gatedBy = (requiresTech: string | null) => ({
    ...ctx,
    shipTypes: (ctx.shipTypes ?? []).map((record) =>
      record.id === "BB"
        ? {
            ...record,
            availability: {
              fromEra: "EARLY" as const,
              requiresTech,
              requiresCapability: null,
              mechanicsImplemented: true,
            },
          }
        : record,
    ),
  });

  it("offers every registered type and locks exactly the ones the compiler treats as unavailable", () => {
    const choices = shipTypeChoices(ctx, "DD");
    expect(choices.map((c) => c.value)).toEqual(SHIP_TYPE_LIST.map((t) => t.id));
    const available = SHIP_TYPE_LIST.filter(
      (t) =>
        evaluateShipTypeAvailability(t.id, {
          month: ctx.month,
          unlockedTechs: ctx.unlockedTechs,
          capabilities: ctx.capabilities,
          restrictedTypes: ctx.restrictedShipTypes,
        }).available,
    ).map((t) => t.id);
    expect(choices.filter((c) => !c.locked).map((c) => c.value)).toEqual(available);
    expect(choices.filter((c) => c.locked).length).toBeGreaterThan(0);
    expect(choices.find((c) => c.value === "DD")?.locked).toBe(false);
  });

  it("keeps a locked type visible and disabled, carrying the domain reasons that lock it", () => {
    const bb = shipTypeChoices(ctx, "DD").find((c) => c.value === "BB");
    expect(bb?.locked).toBe(true);
    expect(bb?.disabled).toBe(true);
    expect(bb?.reasons?.length).toBeGreaterThan(0);
    for (const reason of bb?.reasons ?? []) {
      expect(reason.ruleId).toMatch(/^AVAILABILITY\./);
      expect(reason.messageKey).toMatch(/^design\.availability\./);
    }
    expect(bb?.lockedSummary).toBeTruthy();
    expect(bb?.label).toContain("BB");
  });

  it("names the missing technology of a tech-gated type from the domain params", () => {
    const bb = shipTypeChoices(gatedBy("tech_barbette_ironclad"), "DD").find(
      (c) => c.value === "BB",
    );
    expect(bb?.locked).toBe(true);
    const reason = bb?.reasons?.find((r) => r.code === "SHIP_TYPE_TECHNOLOGY_REQUIRED");
    expect(reason?.params["techId"]).toBe("tech_barbette_ironclad");
    expect(bb?.lockedSummary).toContain("tech barbette ironclad");
  });

  it("lists the type being designed once, even when it is locked", () => {
    const choices = shipTypeChoices(ctx, "BB");
    expect(choices.filter((c) => c.value === "BB")).toHaveLength(1);
  });

  it("still lists an unknown current type so the player can see it", () => {
    const choices = shipTypeChoices(ctx, "ZZ");
    expect(choices[0]).toMatchObject({ value: "ZZ" });
    expect(choices[0]?.label).toContain("unknown type");
  });

  it("follows a content record that opens a type the code constant gates", () => {
    expect(ctx.shipTypes).toBeDefined();
    expect(shipTypeChoices(ctx, "DD").find((c) => c.value === "BB")?.locked).toBe(true);
    const bb = shipTypeChoices(gatedBy(null), "DD").find((c) => c.value === "BB");
    expect(bb?.locked).toBe(false);
    expect(bb?.disabled).toBeFalsy();
  });
});
