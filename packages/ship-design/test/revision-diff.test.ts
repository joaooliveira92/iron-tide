import { describe, expect, it } from "vite-plus/test";
import { draftChangeKinds, progressFromWork, type DesignDraft } from "../src/index.js";
import { readReferenceDesignEntries } from "./helpers/earlyContext.js";

const ref = (readReferenceDesignEntries() as { draft: DesignDraft }[])[0]!.draft;
const cat = (id: string) =>
  (id.startsWith("gun_") && id.includes("12in") ? "MAIN_GUN" : "SECONDARY_GUN") as never;
const withHull = (patch: object): DesignDraft => ({ ...ref, hull: { ...ref.hull, ...patch } });

describe("draftChangeKinds", () => {
  it("identical drafts have no change", () => {
    expect(draftChangeKinds(ref, structuredClone(ref), cat)).toEqual([]);
  });
  it("hull geometry is STRUCTURE; a non-structural hull key is FITTINGS", () => {
    expect(draftChangeKinds(ref, withHull({ beam: ref.hull.beam + 1000 }), cat)).toEqual([
      "STRUCTURE",
    ]);
  });
  it("installed power or plant is MACHINERY", () => {
    const m = {
      ...ref,
      machinery: { ...ref.machinery, installedKw: ref.machinery.installedKw + 100 },
    };
    expect(draftChangeKinds(ref, m, cat)).toEqual(["MACHINERY"]);
  });
  it("armour edits are ARMOUR", () => {
    const a = {
      ...ref,
      armour: { ...ref.armour, citadelLengthMm: ref.armour.citadelLengthMm + 1 },
    };
    expect(draftChangeKinds(ref, a, cat)).toEqual(["ARMOUR"]);
  });
  it("adding, removing and moving placements are FITTINGS (MAIN_ARMAMENT for main guns)", () => {
    const first = ref.placements[0]!;
    const removed = { ...ref, placements: ref.placements.slice(1) };
    const moved = {
      ...ref,
      placements: [
        { ...first, stationPermille: first.stationPermille + 10 },
        ...ref.placements.slice(1),
      ],
    };
    const expected = cat(first.componentId) === "MAIN_GUN" ? "MAIN_ARMAMENT" : "FITTINGS";
    expect(draftChangeKinds(ref, removed, cat)).toContain(expected);
    expect(draftChangeKinds(ref, moved, cat)).toContain(expected);
  });
  it("a changed requirement is not a build change", () => {
    const r = {
      ...ref,
      requirement: { ...ref.requirement, requiredRangeNm: ref.requirement.requiredRangeNm + 500 },
    };
    expect(draftChangeKinds(ref, r, cat)).toEqual([]);
  });
  it("reports several kinds in a stable order", () => {
    const d = {
      ...withHull({ beam: ref.hull.beam + 1000 }),
      machinery: { ...ref.machinery, installedKw: 1 },
    };
    expect(draftChangeKinds(ref, d, cat)).toEqual(["MACHINERY", "STRUCTURE"]);
  });
});

describe("progressFromWork", () => {
  it("uses the one work figure and states what is untracked", () => {
    expect(progressFromWork(30, 100)).toEqual({
      hullDoneWork: 30,
      hullTotalWork: 100,
      armourStarted: false,
      machineryStarted: false,
      launched: false,
      affectedDoneWork: 30,
    });
  });
});
