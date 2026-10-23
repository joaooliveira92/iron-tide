import { describe, expect, it } from "vite-plus/test";
import {
  capitalizeFirst,
  durationLabel,
  monthsBetween,
  sortActions,
  warStanding,
} from "./diplomacy-presentation.js";

describe("warStanding", () => {
  it("reads the war score from the player's side", () => {
    expect(warStanding({ yours: 4, enemy: 1 })).toBe("ahead");
    expect(warStanding({ yours: 1, enemy: 4 })).toBe("behind");
    expect(warStanding({ yours: 2, enemy: 2 })).toBe("level");
  });
});

describe("monthsBetween and durationLabel", () => {
  it("counts whole months from the war's start month to the campaign month", () => {
    expect(monthsBetween("1880-01", { month: 1, year: 1880 })).toBe(0);
    expect(monthsBetween("1880-01", { month: 4, year: 1880 })).toBe(3);
    expect(monthsBetween("1879-11", { month: 2, year: 1880 })).toBe(3);
    expect(monthsBetween("not-a-date", { month: 2, year: 1880 })).toBe(0);
  });

  it("never goes negative for a start date in the future", () => {
    expect(monthsBetween("1881-01", { month: 1, year: 1880 })).toBe(0);
  });

  it("phrases durations for the player", () => {
    expect(durationLabel(0)).toBe("this month");
    expect(durationLabel(1)).toBe("1 month");
    expect(durationLabel(7)).toBe("7 months");
    expect(durationLabel(12)).toBe("1 year");
    expect(durationLabel(27)).toBe("2 years 3 mo");
  });
});

describe("sortActions", () => {
  it("puts diplomacy before hostile actions and war last", () => {
    expect(
      sortActions(["DeclareWar", "BreakNonAggressionPact", "FormAlliance", "DeclareBlockade"]),
    ).toEqual(["FormAlliance", "BreakNonAggressionPact", "DeclareBlockade", "DeclareWar"]);
  });
});

describe("capitalizeFirst", () => {
  it("capitalises the first letter only", () => {
    expect(capitalizeFirst("your nation")).toBe("Your nation");
    expect(capitalizeFirst("")).toBe("");
  });
});
