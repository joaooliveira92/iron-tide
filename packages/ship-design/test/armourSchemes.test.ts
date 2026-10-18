import { describe, expect, it } from "vite-plus/test";
import {
  ARMOUR_SCHEMES,
  allOrNothingRegions,
  applyArmourScheme,
  applyEdit,
  changeKindOf,
  currentDraft,
  decodeDesignFile,
  newLog,
  PersistenceError,
  pushEdit,
  undo,
  armourSchemeAvailable,
  newArmourRegion,
  type ArmourRegion,
  type ArmourSchemeId,
  type RegionSizing,
} from "../src/index.js";
import { ctx, draft } from "./fixtures/gunboat.js";

const size: RegionSizing = {
  lengthWlMm: 100_000,
  beamMm: 15_000,
  depthMm: 8_000,
  citadelLengthMm: 60_000,
};
const reg = (region: ArmourRegion["region"], o: Partial<ArmourRegion> = {}): ArmourRegion => ({
  ...newArmourRegion(region, size, "compound"),
  ...o,
});
const ids = (r: readonly ArmourRegion[]) => r.map((x) => x.region);
const apply = (id: ArmourSchemeId, from: readonly ArmourRegion[] = []) =>
  applyArmourScheme(id, from, size, "compound");

describe("armour scheme catalogue (ADR-0232 section 3)", () => {
  it("lists the four schemes in order, in-era first, each with a citation", () => {
    expect(ARMOUR_SCHEMES.map((s) => s.id)).toEqual([
      "FLAT_DECK_ON_BELT",
      "PROTECTED_CRUISER",
      "BELT_AND_SLOPING_DECK",
      "ALL_OR_NOTHING",
    ]);
    for (const s of ARMOUR_SCHEMES) {
      expect(s.displayName.length).toBeGreaterThan(0);
      expect(s.citation).toMatch(/RTW3 manual p\.\s?\d+/);
    }
  });
  it("the two in-era schemes are available in 1880; the later two are gated until their year", () => {
    const byId = (id: ArmourSchemeId) => ARMOUR_SCHEMES.find((s) => s.id === id)!;
    expect(armourSchemeAvailable(byId("FLAT_DECK_ON_BELT"), 1880)).toBe(true);
    expect(armourSchemeAvailable(byId("PROTECTED_CRUISER"), 1880)).toBe(true);
    for (const id of ["BELT_AND_SLOPING_DECK", "ALL_OR_NOTHING"] as const) {
      const s = byId(id);
      expect(armourSchemeAvailable(s, 1880)).toBe(false);
      expect(s.unlockYear).not.toBeNull();
      expect(armourSchemeAvailable(s, s.unlockYear!)).toBe(true);
      expect(armourSchemeAvailable(s, s.unlockYear! - 1)).toBe(false);
    }
  });
});

describe("applyArmourScheme", () => {
  it("flat deck on belt: belt, ends and a flat main deck; no slope, no upper belt, no extended deck", () => {
    const out = apply("FLAT_DECK_ON_BELT", [
      reg("BELT_UPPER"),
      reg("DECK_SLOPE"),
      reg("DECK_EXTENDED"),
    ]);
    expect(ids(out).sort()).toEqual(["BELT_ENDS", "BELT_MAIN", "DECK_MAIN"]);
  });
  it("protected cruiser: a sloped protective deck and no belts", () => {
    const out = apply("PROTECTED_CRUISER", [reg("BELT_MAIN"), reg("BELT_ENDS"), reg("BELT_UPPER")]);
    expect(ids(out).sort()).toEqual(["DECK_EXTENDED", "DECK_MAIN", "DECK_SLOPE"]);
  });
  it("belt and sloping deck: belt, upper belt, ends, main deck and slope", () => {
    expect(ids(apply("BELT_AND_SLOPING_DECK")).sort()).toEqual([
      "BELT_ENDS",
      "BELT_MAIN",
      "BELT_UPPER",
      "DECK_MAIN",
      "DECK_SLOPE",
    ]);
  });
  it("all or nothing is the existing citadel-only transformation of the belt-and-deck layout", () => {
    const start = apply("BELT_AND_SLOPING_DECK");
    expect(apply("ALL_OR_NOTHING", start)).toEqual(
      allOrNothingRegions(start, size.citadelLengthMm),
    );
    expect(ids(apply("ALL_OR_NOTHING", start))).not.toContain("BELT_UPPER");
    expect(ids(apply("ALL_OR_NOTHING", start))).not.toContain("BELT_ENDS");
  });
  it("all or nothing with no citadel set cuts to 60% of the waterline, never to zero", () => {
    const out = applyArmourScheme(
      "ALL_OR_NOTHING",
      [],
      { ...size, citadelLengthMm: 0 },
      "compound",
    );
    expect(out.find((r) => r.region === "BELT_MAIN")!.lengthMm).toBe(60_000);
  });
  it("keeps the player's plate on a region the scheme keeps, and starts a new one at the convention", () => {
    const thick = reg("BELT_MAIN", { thicknessUm: 300_000, materialId: "iron" });
    const out = apply("FLAT_DECK_ON_BELT", [thick]);
    expect(out.find((r) => r.region === "BELT_MAIN")).toEqual(thick);
    expect(out.find((r) => r.region === "DECK_MAIN")).toEqual(reg("DECK_MAIN"));
  });
  it("leaves regions outside the belt-and-deck family alone", () => {
    const keep = [
      reg("TURRET"),
      reg("TURRET_TOP"),
      reg("CONNING_TOWER"),
      reg("MAGAZINE_BOX"),
      reg("TORPEDO_BELT"),
    ];
    const out = apply("PROTECTED_CRUISER", [reg("BELT_MAIN"), ...keep]);
    for (const k of keep) expect(out).toContainEqual(k);
  });
  it("is deterministic, idempotent, order-stable and does not mutate its input", () => {
    const input = [reg("BELT_MAIN"), reg("DECK_SLOPE"), reg("TURRET")];
    const frozen = JSON.stringify(input);
    for (const s of ARMOUR_SCHEMES) {
      const once = apply(s.id, input);
      expect(apply(s.id, input)).toEqual(once);
      expect(apply(s.id, once)).toEqual(once);
      expect(new Set(ids(once)).size).toBe(once.length);
    }
    expect(JSON.stringify(input)).toBe(frozen);
  });
});

describe("scheme label on the draft (ADR-0232: any manual region edit flips to Custom)", () => {
  const base = {
    ...draft,
    armour: { ...draft.armour, regions: [reg("BELT_MAIN"), reg("DECK_MAIN")] },
  };
  const applied = applyEdit(base, {
    kind: "set_armour_scheme",
    schemeId: "PROTECTED_CRUISER",
    regions: apply("PROTECTED_CRUISER", base.armour.regions),
  });

  it("applying a scheme is one edit that sets the label and the regions", () => {
    expect(applied.armour.schemeId).toBe("PROTECTED_CRUISER");
    expect(ids(applied.armour.regions).sort()).toEqual([
      "DECK_EXTENDED",
      "DECK_MAIN",
      "DECK_SLOPE",
    ]);
  });
  it("any manual region edit clears the label back to Custom", () => {
    const edits = [
      { kind: "set_armour_region", region: { ...applied.armour.regions[0]!, thicknessUm: 1 } },
      { kind: "remove_armour_region", region: applied.armour.regions[0]!.region },
      { kind: "set_armour_regions", regions: applied.armour.regions },
    ] as const;
    for (const e of edits) expect(applyEdit(applied, e).armour.schemeId).toBeUndefined();
  });
  it("an unrelated edit keeps the label", () => {
    expect(applyEdit(applied, { kind: "set_fire_control", positions: 1 }).armour.schemeId).toBe(
      "PROTECTED_CRUISER",
    );
  });
  it("is one undoable step and an armour change for revisions", () => {
    expect(
      changeKindOf(
        { kind: "set_armour_scheme", schemeId: "ALL_OR_NOTHING", regions: [] },
        () => undefined,
      ),
    ).toBe("ARMOUR");
    const log = pushEdit(newLog(base), {
      kind: "set_armour_scheme",
      schemeId: "PROTECTED_CRUISER",
      regions: applied.armour.regions,
    });
    expect(currentDraft(log).armour.schemeId).toBe("PROTECTED_CRUISER");
    expect(currentDraft(undo(log)).armour.schemeId).toBeUndefined();
  });
  it("rejects an unknown scheme id in a design file", () => {
    const text = (id: unknown) =>
      JSON.stringify({
        format: "bwdesign",
        schemaVersion: 2,
        draft: { ...base, armour: { ...base.armour, schemeId: id } },
        componentHashes: {},
        compiledHash: null,
      });
    expect(decodeDesignFile(text("ALL_OR_NOTHING"), ctx.catalogue).draft.armour.schemeId).toBe(
      "ALL_OR_NOTHING",
    );
    for (const bad of ["CUSTOM", 3, null])
      expect(() => decodeDesignFile(text(bad), ctx.catalogue)).toThrow(PersistenceError);
  });
});
