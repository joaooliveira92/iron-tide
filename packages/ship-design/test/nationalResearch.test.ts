import { describe, it, expect } from "vite-plus/test";
import {
  MAX_HIGH_FIELDS,
  PRIORITY,
  RESEARCH_FIELDS,
  researchPriorityAllocation,
} from "../src/index.js";
import { navalProfiles } from "./helpers/earlyContext.js";

const uk = navalProfiles.find((p) => p.nationId === "uk")!;
const france = navalProfiles.find((p) => p.nationId === "france")!;

describe("national research priorities", () => {
  it("reflects the authored preferences (UK machinery, France gunnery/torpedoes)", () => {
    const ukAlloc = researchPriorityAllocation(uk);
    const frAlloc = researchPriorityAllocation(france);
    expect(ukAlloc.fieldPriorities.MACHINERY).toBe(PRIORITY.HIGH);
    expect(frAlloc.fieldPriorities.GUNNERY).toBe(PRIORITY.HIGH);
    expect(frAlloc.fieldPriorities.TORPEDOES).toBe(PRIORITY.HIGH);
    expect(frAlloc.fieldPriorities.TORPEDOES).toBeGreaterThan(ukAlloc.fieldPriorities.TORPEDOES);
  });
  it("covers every canonical field and never sets more than the HIGH cap", () => {
    const alloc = researchPriorityAllocation(uk);
    expect(Object.keys(alloc.fieldPriorities).sort()).toEqual([...RESEARCH_FIELDS].sort());
    const high = Object.values(alloc.fieldPriorities).filter((p) => p === PRIORITY.HIGH);
    expect(high.length).toBeLessThanOrEqual(MAX_HIGH_FIELDS);
  });
  it("caps a saturated field so a preference cannot dominate forever", () => {
    const alloc = researchPriorityAllocation(uk, { saturatedFields: new Set(["MACHINERY"]) });
    expect(alloc.fieldPriorities.MACHINERY).toBeLessThanOrEqual(PRIORITY.MEDIUM);
    expect(alloc.reasons.join(" ")).toMatch(/saturated/);
  });
  it("boosts a field recommended by fleet deficiency without exceeding HIGH", () => {
    const alloc = researchPriorityAllocation(uk, { boostedFields: new Set(["TORPEDOES"]) });
    expect(alloc.fieldPriorities.TORPEDOES).toBeGreaterThanOrEqual(PRIORITY.MEDIUM);
    expect(alloc.fieldPriorities.TORPEDOES).toBeLessThanOrEqual(PRIORITY.HIGH);
  });
  it("is deterministic per seed and varies across seeds", () => {
    const a = researchPriorityAllocation(uk, {}, "seed-1");
    const b = researchPriorityAllocation(uk, {}, "seed-1");
    const c = researchPriorityAllocation(uk, {}, "seed-2");
    expect(a).toEqual(b);
    expect(JSON.stringify(a.fieldPriorities)).not.toBe(JSON.stringify(c.fieldPriorities));
  });
  it("flattens under heavy budget pressure", () => {
    const normal = researchPriorityAllocation(uk);
    const squeezed = researchPriorityAllocation(uk, { budgetPressureBp: 3_000 });
    const highNormal = Object.values(normal.fieldPriorities).filter((p) => p === 4).length;
    const highSqueezed = Object.values(squeezed.fieldPriorities).filter((p) => p === 4).length;
    expect(highSqueezed).toBeLessThanOrEqual(highNormal);
  });
});
