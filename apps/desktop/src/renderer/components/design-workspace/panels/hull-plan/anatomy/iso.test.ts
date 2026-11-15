import { describe, expect, it } from "vite-plus/test";
import { loft } from "./iso.js";
import type { Point3, Projection } from "./iso.js";

const projection: Projection = {
  origin: [0, 0],
  scale: 1,
  azimuth: 135,
  elevation: 30,
  zScale: 1,
};

const endpointsOf = (outline: string): string[] =>
  outline
    .split("M")
    .filter((part) => part.length > 0)
    .flatMap((part) => {
      const points = part.split("L").map((point) => point.trim());
      return [points[0]!, points[points.length - 1]!];
    });

describe("loft outline", () => {
  it("every outline run ends where another run or a silhouette edge begins", () => {
    const top: Point3[] = [
      [0, 0, 10],
      [30, -8, 10],
      [60, 0, 10],
      [30, 8, 10],
    ];
    const bottom: Point3[] = top.map(([x, y]) => [x, y * 0.5, 0]);
    const { outline } = loft(top, bottom, projection);
    const counts = new Map<string, number>();
    for (const point of endpointsOf(outline)) counts.set(point, (counts.get(point) ?? 0) + 1);
    expect([...counts.values()].filter((count) => count < 2)).toEqual([]);
  });
});
