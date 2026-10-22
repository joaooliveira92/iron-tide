import { describe, expect, it } from "vite-plus/test";

import {
  BARREL_ARRANGEMENTS,
  COMPILER_DERIVED_TRAITS,
  DECK_RELATIONSHIPS,
  ELEVATION_STYLES,
  ENCLOSURES,
  ORIENTATIONS,
  OVERRIDABLE_TRAITS,
  PRESENTATION_FORMS,
  PartSchema,
  SIZE_CLASSES,
  VISUAL_TRAITS,
  VISUAL_TRAIT_OWNERSHIP,
  VISUAL_TRAIT_RULESET,
  VISUAL_TRAIT_VALUES,
  deriveVisualTraits,
  effectiveVisualTraits,
  sizeClassOf,
  visualTraitViolations,
  type VisualTraitSource,
} from "../src/index.js";
import { decodeOk } from "./decode-helpers.js";

const gunMount = (over: Partial<VisualTraitSource> = {}): VisualTraitSource => ({
  family: "gun_mount",
  provides: "gun_mount",
  mountType: "TURRET",
  gunsPerMount: 2,
  ...over,
});

const launcher = (over: Partial<VisualTraitSource> = {}): VisualTraitSource => ({
  family: "torpedo_launcher",
  provides: "torpedo_launcher",
  launchType: "ABOVE_WATER_TRAINABLE",
  gunsPerMount: 1,
  ...over,
});

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test source" }],
};

const validGunMountPart = {
  id: "bl_12in_barbette_twin",
  family: "gun_mount",
  provides: "gun_mount",
  name: "12-inch twin barbette",
  lifecycle: { availableFrom: "1885-01" },
  spec: { mountType: "BARBETTE", gunsPerMount: 2 },
  provenance,
} as const;

describe("visual-traits/1 vocabulary and ownership (D16)", () => {
  it("names the ruleset and the seven traits in table order", () => {
    expect(VISUAL_TRAIT_RULESET).toBe("visual-traits/1");
    expect(VISUAL_TRAITS).toEqual([
      "presentation_form",
      "enclosure",
      "barrel_arrangement",
      "deck_relationship",
      "orientation",
      "size_class",
      "elevation_style",
    ]);
  });

  it("gives every trait exactly one ownership class", () => {
    expect(VISUAL_TRAIT_OWNERSHIP).toEqual({
      presentation_form: "derived_with_override",
      enclosure: "derived_with_override",
      barrel_arrangement: "derived_with_override",
      deck_relationship: "derived_with_override",
      orientation: "compiler_derived",
      size_class: "compiler_derived",
      elevation_style: "compiler_derived",
    });
    expect(OVERRIDABLE_TRAITS).toEqual([
      "presentation_form",
      "enclosure",
      "barrel_arrangement",
      "deck_relationship",
    ]);
    expect(COMPILER_DERIVED_TRAITS).toEqual(["orientation", "size_class", "elevation_style"]);
  });

  it("keeps every closed value set exactly as the proposal defines it", () => {
    expect(PRESENTATION_FORMS).toEqual([
      "rotating_gunhouse",
      "barbette",
      "casemate",
      "battery_port",
      "pedestal",
      "tube_carriage",
      "funnel_stack",
    ]);
    expect(ENCLOSURES).toEqual(["enclosed", "hooded", "shielded", "open"]);
    expect(BARREL_ARRANGEMENTS).toEqual(["single", "side_by_side", "grouped"]);
    expect(DECK_RELATIONSHIPS).toEqual(["on_deck", "in_hull_side", "below_waterline"]);
    expect(ORIENTATIONS).toEqual(["forward", "aft", "port_beam", "starboard_beam"]);
    expect(SIZE_CLASSES).toEqual(["small", "medium", "large"]);
    expect(ELEVATION_STYLES).toEqual(["main_deck", "superstructure_deck"]);
    expect(VISUAL_TRAIT_VALUES).toEqual({
      presentation_form: PRESENTATION_FORMS,
      enclosure: ENCLOSURES,
      barrel_arrangement: BARREL_ARRANGEMENTS,
      deck_relationship: DECK_RELATIONSHIPS,
      orientation: ORIENTATIONS,
      size_class: SIZE_CLASSES,
      elevation_style: ELEVATION_STYLES,
    });
  });
});

describe("derived defaults (proposal §8.2 source fields)", () => {
  it("maps a gun mount's mountType to a presentation form", () => {
    expect(deriveVisualTraits(gunMount({ mountType: "TURRET" })).presentation_form).toBe(
      "rotating_gunhouse",
    );
    expect(deriveVisualTraits(gunMount({ mountType: "BARBETTE" })).presentation_form).toBe(
      "barbette",
    );
    expect(deriveVisualTraits(gunMount({ mountType: "CASEMATE" })).presentation_form).toBe(
      "casemate",
    );
    expect(deriveVisualTraits(gunMount({ mountType: "BROADSIDE_BATTERY" })).presentation_form).toBe(
      "battery_port",
    );
    expect(deriveVisualTraits(gunMount({ mountType: "DECK_SHIELDED" })).presentation_form).toBe(
      "pedestal",
    );
    expect(deriveVisualTraits(gunMount({ mountType: "DECK_OPEN" })).presentation_form).toBe(
      "pedestal",
    );
    expect(deriveVisualTraits(launcher()).presentation_form).toBe("tube_carriage");
    expect(deriveVisualTraits({ family: "fitting", provides: "funnel" }).presentation_form).toBe(
      "funnel_stack",
    );
    expect(
      deriveVisualTraits({ family: "gun", provides: "gun" }).presentation_form,
    ).toBeUndefined();
  });

  it("derives the enclosure from the form and mountType", () => {
    expect(deriveVisualTraits(gunMount({ mountType: "TURRET" })).enclosure).toBe("enclosed");
    expect(deriveVisualTraits(gunMount({ mountType: "BARBETTE" })).enclosure).toBe("open");
    expect(deriveVisualTraits(gunMount({ mountType: "CASEMATE" })).enclosure).toBe("enclosed");
    expect(deriveVisualTraits(gunMount({ mountType: "DECK_SHIELDED" })).enclosure).toBe("shielded");
    expect(deriveVisualTraits(gunMount({ mountType: "DECK_OPEN" })).enclosure).toBe("open");
    expect(deriveVisualTraits(launcher()).enclosure).toBe("open");
    expect(deriveVisualTraits({ family: "fitting", provides: "funnel" }).enclosure).toBeUndefined();
  });

  it("derives the barrel arrangement from gunsPerMount and the form", () => {
    expect(
      deriveVisualTraits(gunMount({ mountType: "TURRET", gunsPerMount: 1 })).barrel_arrangement,
    ).toBe("single");
    expect(
      deriveVisualTraits(gunMount({ mountType: "TURRET", gunsPerMount: 2 })).barrel_arrangement,
    ).toBe("side_by_side");
    expect(
      deriveVisualTraits(gunMount({ mountType: "CASEMATE", gunsPerMount: 3 })).barrel_arrangement,
    ).toBe("grouped");
    expect(deriveVisualTraits(launcher()).barrel_arrangement).toBeUndefined();
  });

  it("derives the deck relationship from the form and launchType", () => {
    expect(deriveVisualTraits(gunMount({ mountType: "TURRET" })).deck_relationship).toBe("on_deck");
    expect(deriveVisualTraits(gunMount({ mountType: "CASEMATE" })).deck_relationship).toBe(
      "in_hull_side",
    );
    expect(deriveVisualTraits(gunMount({ mountType: "BROADSIDE_BATTERY" })).deck_relationship).toBe(
      "in_hull_side",
    );
    expect(deriveVisualTraits(launcher({ launchType: "UNDERWATER_FIXED" })).deck_relationship).toBe(
      "below_waterline",
    );
    expect(
      deriveVisualTraits(launcher({ launchType: "ABOVE_WATER_FIXED" })).deck_relationship,
    ).toBe("on_deck");
  });

  it("derives the orientation from side and station, never conflated with side", () => {
    expect(deriveVisualTraits(gunMount({ stationPermille: 200 })).orientation).toBe("forward");
    expect(deriveVisualTraits(gunMount({ stationPermille: 800 })).orientation).toBe("aft");
    expect(deriveVisualTraits(gunMount({ mountType: "CASEMATE", side: "PORT" })).orientation).toBe(
      "port_beam",
    );
    expect(deriveVisualTraits(launcher({ side: "STBD" })).orientation).toBe("starboard_beam");
  });

  it("derives size_class from the contained gun's calibre, in whole inches", () => {
    expect(deriveVisualTraits(gunMount({ calibreUm: 127_000 })).size_class).toBe("small");
    expect(deriveVisualTraits(gunMount({ calibreUm: 152_400 })).size_class).toBe("medium");
    expect(deriveVisualTraits(gunMount({ calibreUm: 304_800 })).size_class).toBe("large");
    expect(deriveVisualTraits(gunMount()).size_class).toBeUndefined();
    expect(sizeClassOf(101_600)).toBe("small");
    expect(sizeClassOf(203_200)).toBe("medium");
    expect(sizeClassOf(304_800)).toBe("large");
  });

  it("derives the elevation style from the zone and deck relationship", () => {
    expect(
      deriveVisualTraits(gunMount({ stationPermille: 400, zoneId: "SUPERSTRUCTURE" }))
        .elevation_style,
    ).toBe("superstructure_deck");
    expect(
      deriveVisualTraits(gunMount({ stationPermille: 400, zoneId: "FORECASTLE" })).elevation_style,
    ).toBe("main_deck");
    expect(deriveVisualTraits(gunMount({ mountType: "CASEMATE" })).elevation_style).toBeUndefined();
  });
});

describe("authored overrides (V10–V12, decode)", () => {
  it("accepts a valid override with a reason", () => {
    expect(
      decodeOk(PartSchema, {
        ...validGunMountPart,
        visual: { traits: { presentation_form: { value: "casemate", reason: "hooded variant" } } },
      }),
    ).toBe(true);
  });

  it("accepts a part-specific drawing override id", () => {
    expect(decodeOk(PartSchema, { ...validGunMountPart, visual: { override: "b_asset" } })).toBe(
      true,
    );
  });

  it("rejects an unknown trait value (V12)", () => {
    expect(
      decodeOk(PartSchema, {
        ...validGunMountPart,
        visual: { traits: { presentation_form: { value: "x", reason: "r" } } },
      }),
    ).toBe(false);
  });

  it("rejects a trait outside visual-traits/1 (V12)", () => {
    expect(
      decodeOk(PartSchema, {
        ...validGunMountPart,
        visual: { traits: { superstructure: { value: "roof", reason: "r" } } },
      }),
    ).toBe(false);
  });

  it("rejects authoring a compiler-derived trait (V10)", () => {
    expect(
      decodeOk(PartSchema, {
        ...validGunMountPart,
        visual: { traits: { orientation: { value: "forward", reason: "r" } } },
      }),
    ).toBe(false);
    expect(
      decodeOk(PartSchema, {
        ...validGunMountPart,
        visual: { traits: { size_class: { value: "large", reason: "r" } } },
      }),
    ).toBe(false);
    expect(
      decodeOk(PartSchema, {
        ...validGunMountPart,
        visual: { traits: { elevation_style: { value: "main_deck", reason: "r" } } },
      }),
    ).toBe(false);
  });

  it("rejects an override with no reason (V11)", () => {
    expect(
      decodeOk(PartSchema, {
        ...validGunMountPart,
        visual: { traits: { enclosure: { value: "open", reason: "" } } },
      }),
    ).toBe(false);
    expect(
      decodeOk(PartSchema, { ...validGunMountPart, visual: { traits: { enclosure: "open" } } }),
    ).toBe(false);
  });

  it("replaces only the overridden trait, keeping the other defaults", () => {
    const source = gunMount({ mountType: "TURRET", gunsPerMount: 2 });
    const effective = effectiveVisualTraits(source, {
      presentation_form: { value: "casemate", reason: "as built" },
    });
    expect(effective.presentation_form).toBe("casemate");
    expect(effective.enclosure).toBe("enclosed");
  });
});

describe("contradiction rules V1–V9 (evaluated on effective traits)", () => {
  const rules = (
    source: VisualTraitSource,
    overrides: Parameters<typeof effectiveVisualTraits>[1],
  ) => visualTraitViolations(effectiveVisualTraits(source, overrides), source).map((v) => v.rule);

  it("defaults of real mount types never contradict", () => {
    for (const mountType of [
      "TURRET",
      "BARBETTE",
      "CASEMATE",
      "BROADSIDE_BATTERY",
      "DECK_SHIELDED",
      "DECK_OPEN",
    ]) {
      expect(rules(gunMount({ mountType }), undefined)).toEqual([]);
    }
    expect(rules(launcher(), undefined)).toEqual([]);
    expect(rules({ family: "fitting", provides: "funnel" }, undefined)).toEqual([]);
  });

  it("V1: rotating_gunhouse requires enclosed or hooded", () => {
    expect(rules(gunMount(), { enclosure: { value: "open", reason: "r" } })).toContain("V1");
    expect(rules(gunMount(), { enclosure: { value: "hooded", reason: "r" } })).not.toContain("V1");
  });

  it("V2: pedestal requires shielded or open", () => {
    const base = gunMount({ mountType: "DECK_OPEN" });
    expect(rules(base, { enclosure: { value: "enclosed", reason: "r" } })).toContain("V2");
  });

  it("V3: casemate and battery_port require in_hull_side and enclosed", () => {
    const base = gunMount({ mountType: "CASEMATE" });
    expect(rules(base, { enclosure: { value: "open", reason: "r" } })).toContain("V3");
    expect(rules(base, { deck_relationship: { value: "on_deck", reason: "r" } })).toContain("V3");
  });

  it("V4: in_hull_side requires casemate or battery_port", () => {
    expect(
      rules(gunMount(), { deck_relationship: { value: "in_hull_side", reason: "r" } }),
    ).toContain("V4");
  });

  it("V5: below_waterline requires tube_carriage", () => {
    expect(
      rules(gunMount(), { deck_relationship: { value: "below_waterline", reason: "r" } }),
    ).toContain("V5");
  });

  it("V6: rotating_gunhouse, barbette, pedestal and funnel_stack require on_deck", () => {
    expect(
      rules(gunMount({ mountType: "BARBETTE" }), {
        deck_relationship: { value: "below_waterline", reason: "r" },
      }),
    ).toContain("V6");
  });

  it("V7: arrangement must agree with gunsPerMount and casemate family", () => {
    expect(
      rules(gunMount({ gunsPerMount: 2 }), {
        barrel_arrangement: { value: "single", reason: "r" },
      }),
    ).toContain("V7");
    expect(
      rules(gunMount({ gunsPerMount: 1 }), {
        barrel_arrangement: { value: "side_by_side", reason: "r" },
      }),
    ).toContain("V7");
    expect(
      rules(gunMount({ gunsPerMount: 2 }), {
        barrel_arrangement: { value: "grouped", reason: "r" },
      }),
    ).toContain("V7");
  });

  it("V8: barrel arrangement is forbidden on tube_carriage and funnel_stack", () => {
    expect(rules(launcher(), { barrel_arrangement: { value: "single", reason: "r" } })).toContain(
      "V8",
    );
    expect(
      rules(
        { family: "fitting", provides: "funnel" },
        {
          barrel_arrangement: { value: "single", reason: "r" },
        },
      ),
    ).toContain("V8");
  });

  it("V9: enclosure is forbidden on funnel_stack", () => {
    expect(
      rules(
        { family: "fitting", provides: "funnel" },
        { enclosure: { value: "open", reason: "r" } },
      ),
    ).toContain("V9");
  });
});
