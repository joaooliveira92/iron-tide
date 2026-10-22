import type { ContentPack } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import { buildWorldState } from "../src/worldCompilation.js";

function pack(technologies: unknown[]): ContentPack {
  return { technologies } as ContentPack;
}

describe("research catalogue", () => {
  it("carries cost, field, weight, prerequisites and availability, ordered by id", () => {
    const world = buildWorldState(
      pack([
        {
          id: "b_tech",
          name: "B",
          category: "EARLY",
          researchFieldId: "GUNNERY",
          prerequisites: [{ techId: "z_tech" }, { techId: "a_tech" }],
          cost: 120,
          discoveryWeight: 4000,
          year: 1886,
        },
        {
          id: "a_tech",
          name: "A",
          category: "EARLY",
          researchFieldId: "GUNNERY",
          cost: 50,
          discoveryWeight: 1000,
          year: 1880,
        },
      ]),
      { startYear: 1880, startMonth: 1 },
    );
    expect(world.technologies?.map((t) => t.techId)).toEqual(["a_tech", "b_tech"]);
    expect(world.technologies?.[1]).toEqual({
      techId: "b_tech",
      researchFieldId: "GUNNERY",
      cost: 120,
      discoveryWeight: 4000,
      prerequisites: ["a_tech", "z_tech"],
      availabilityMonth: 72,
    });
    expect(world.technologies?.[0]?.availabilityMonth).toBe(0);
  });

  it("measures availability from the campaign start month and never goes negative", () => {
    const world = buildWorldState(
      pack([
        { id: "t", name: "T", category: "EARLY", researchFieldId: "GUNNERY", cost: 10, year: 1881 },
        { id: "u", name: "U", category: "EARLY", researchFieldId: "GUNNERY", cost: 10, year: 1880 },
      ]),
      { startYear: 1880, startMonth: 7 },
    );
    expect(world.technologies?.map((t) => Number(t.availabilityMonth))).toEqual([6, 0]);
  });

  it("skips technologies without a field or cost", () => {
    const world = buildWorldState(pack([{ id: "x", name: "X", category: "EARLY" }]), {
      startYear: 1880,
      startMonth: 1,
    });
    expect(world.technologies).toEqual([]);
  });
});
