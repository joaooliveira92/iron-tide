import { describe, expect, it } from "vite-plus/test";

import type { HorizonClass } from "../globe-spike/horizon.js";
import {
  HORIZON_HYSTERESIS_DEGREES,
  backSideCannotBeSelected,
  projectOnlyFalsePositive,
  renderedPointerTargets,
  selectPointerTarget,
  stableHorizonClass,
  type PointerCandidate,
} from "./pointer-visibility.js";

function candidate(
  id: string,
  horizon: HorizonClass,
  rendered: boolean,
  options: Partial<PointerCandidate> = {},
): PointerCandidate {
  return { id, horizon, rendered, ...options };
}

describe("pointer visibility", () => {
  it("selects only a rendered front-side entity", () => {
    expect(
      selectPointerTarget([
        candidate("back", "back", false),
        candidate("horizon", "horizon", true),
        candidate("front", "front", true),
      ]),
    ).toBe("horizon");
    expect(selectPointerTarget([candidate("back", "back", true)])).toBeNull();
    expect(selectPointerTarget([candidate("front", "front", false)])).toBeNull();
  });

  it("never treats a project() near-side estimate as a hit", () => {
    expect(
      selectPointerTarget([
        candidate("project-only", "front", false, { projectVisible: true }),
        candidate("rendered", "front", true),
      ]),
    ).toBe("rendered");
    expect(
      selectPointerTarget([candidate("project-only", "front", false, { projectVisible: true })]),
    ).toBeNull();
  });

  it("reproduces the 14 project() misses among 1,440 near-side markers", () => {
    const candidates: PointerCandidate[] = [];
    for (let index = 0; index < 1440; index++) {
      const missed = index % 103 === 0 && index < 14 * 103;
      candidates.push(candidate(`marker-${index}`, "front", !missed, { projectVisible: true }));
    }
    const falsePositives = projectOnlyFalsePositive(candidates);
    expect(falsePositives).toHaveLength(14);
    expect(selectPointerTarget(candidates)).toBe("marker-1");
    expect(renderedPointerTargets(candidates)).toHaveLength(1426);
    expect(selectPointerTarget(candidates.slice(0, 103))).toBe("marker-1");
  });

  it("excludes hidden and back-side entities from the rendered target list", () => {
    const rendered = renderedPointerTargets([
      candidate("front", "front", true),
      candidate("hidden", "front", true, { hidden: true }),
      candidate("back", "back", true),
    ]);
    expect(rendered).toEqual(["front"]);
    expect(backSideCannotBeSelected(candidate("back", "back", true))).toBe(true);
  });

  it("applies hysteresis instead of flickering at the horizon", () => {
    expect(stableHorizonClass("front", "back", 0.2)).toBe("back");
    expect(stableHorizonClass("front", "back", HORIZON_HYSTERESIS_DEGREES)).toBe("front");
    expect(stableHorizonClass(null, "horizon", 0)).toBe("horizon");
    expect(stableHorizonClass("this-is-not-a-class" as HorizonClass, "front", 0)).toBe("front");
  });
});
