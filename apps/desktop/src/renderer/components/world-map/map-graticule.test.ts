import { describe, expect, it } from "vite-plus/test";
import { buildGraticule } from "./map-graticule.js";
import { projectionById } from "./projection.js";

describe("buildGraticule", () => {
  it("draws five parallels and twelve meridians as one path", () => {
    const d = buildGraticule(projectionById("equirectangular"));
    expect((d.match(/M/g) ?? []).length).toBe(17);
    expect(d.startsWith("M")).toBe(true);
    expect(d.includes("L")).toBe(true);
  });

  it("is deterministic for a given projection", () => {
    expect(buildGraticule(projectionById("miller"))).toBe(buildGraticule(projectionById("miller")));
  });
});
