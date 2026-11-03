import { describe, expect, it } from "vite-plus/test";
import type { DivisionOrder } from "../../../../shared/player-battle-orders.js";
import {
  courseOrderState,
  parseCourse,
  parseSpeedKnots,
  sameDivisionOrder,
} from "./tactical-orders.js";

const stance: DivisionOrder = { stance: "ENGAGE", speedPercent: 100 };
const steered: DivisionOrder = { ...stance, courseDeg: 90, speedKnots: 12 };

describe("course order state", () => {
  it("follows the stance until a course is ordered", () => {
    expect(courseOrderState(stance, stance)).toBe("stance");
  });

  it("is pending until the next step carries the order, then in effect", () => {
    expect(courseOrderState(steered, stance)).toBe("pending");
    expect(courseOrderState(steered, steered)).toBe("accepted");
    expect(courseOrderState({ ...steered, courseDeg: 91 }, steered)).toBe("pending");
  });

  it("treats releasing a standing course as pending", () => {
    expect(courseOrderState(stance, steered)).toBe("pending");
  });
});

describe("typed order input", () => {
  it.each([
    ["0", true],
    ["359", true],
    [" 90 ", true],
    ["360", false],
    ["-1", false],
    ["1.5", false],
    ["", false],
    ["ninety", false],
    ["1e2", false],
  ])("course %j is valid: %s", (text, ok) => {
    expect(parseCourse(text).ok).toBe(ok);
  });

  it.each([
    ["1", true],
    ["60", true],
    ["0", false],
    ["61", false],
    ["12.5", false],
  ])("speed %j is valid: %s", (text, ok) => {
    expect(parseSpeedKnots(text).ok).toBe(ok);
  });

  it("compares orders field by field", () => {
    expect(sameDivisionOrder(steered, { ...steered })).toBe(true);
    expect(sameDivisionOrder(steered, stance)).toBe(false);
    expect(sameDivisionOrder(undefined, undefined)).toBe(true);
  });
});
