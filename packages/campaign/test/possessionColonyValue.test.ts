import type { ContentPack } from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import { buildWorldState } from "../src/worldCompilation.js";

const pack = (possessions: unknown[]): ContentPack => ({ possessions }) as ContentPack;

describe("possession colony value in the compiled world", () => {
  it("carries an authored colonyValueBp and leaves an unvalued possession byte-identical", () => {
    const world = buildWorldState(
      pack([
        { id: "b", nationId: "uk", areaId: "a2", colonyValueBp: 40 },
        { id: "a", nationId: "uk", areaId: "a1" },
      ]),
      { startYear: 1880, startMonth: 1 },
    );
    expect(world.possessions).toEqual([
      { id: "a", nationId: "uk", areaId: "a1" },
      { id: "b", nationId: "uk", areaId: "a2", colonyValueBp: 40 },
    ]);
    expect(Object.keys(world.possessions?.[0] ?? {})).toEqual(["id", "nationId", "areaId"]);
  });
});
