import { describe, expect, it } from "vite-plus/test";
import { buildPlayerProjection } from "../src/projection.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

const MONTH = { month: 3, year: 1880 } as const;

function projectionWith(specialTraining?: { subject: string; fundedMonths: number; bp: number }[]) {
  const nation = fixtureNation({
    id: "uk",
    ...(specialTraining === undefined
      ? {}
      : {
          specialTraining: specialTraining.map((entry) => ({
            subject: entry.subject as "GUNNERY",
            fundedMonths: entry.fundedMonths,
            maintenanceAdderBp: entry.bp,
          })),
        }),
  });
  return buildPlayerProjection(fixtureState(fixtureSnapshot([nation])), "uk", MONTH)!;
}

describe("player projection: special training", () => {
  it("reports an empty programme when nothing is funded", () => {
    expect(projectionWith().training).toEqual({ subjects: [], maintenanceAdderBp: 0 });
  });

  it("lists each funded subject with its funded months and sums the upkeep adders", () => {
    const training = projectionWith([
      { subject: "GUNNERY", fundedMonths: 2, bp: 150 },
      { subject: "DAMAGE_CONTROL", fundedMonths: 0, bp: 100 },
    ]).training;
    expect(training).toEqual({
      subjects: [
        { subject: "GUNNERY", fundedMonths: 2 },
        { subject: "DAMAGE_CONTROL", fundedMonths: 0 },
      ],
      maintenanceAdderBp: 250,
    });
  });
});
