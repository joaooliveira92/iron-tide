import {
  ENCLOSURES as SCHEMA_ENCLOSURES,
  PRESENTATION_FORMS as SCHEMA_PRESENTATION_FORMS,
  defaultPresentationForm,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  ENCLOSURES,
  MISSING_ASSET_PART,
  MOUNT_CLASSES,
  NATION_STYLES,
  PART_CATALOG,
  PRESENTATION_FORMS,
  SIZE_BANDS,
  VISUAL_ERAS,
  mountClassOfTraits,
  resolveVisualMount,
} from "../src/index.js";
import { catalog, mount } from "./fixtures.js";

const universalDefault = mount("x-d-large-turret", {
  style: "X",
  era: "DREADNOUGHT",
  sizes: ["LARGE"],
  mountClass: "TURRET",
});

describe("the trait value mirrors stay in step with content-schema", () => {
  it("mirrors the closed presentation forms and enclosures", () => {
    expect(PRESENTATION_FORMS).toEqual(SCHEMA_PRESENTATION_FORMS);
    expect(ENCLOSURES).toEqual(SCHEMA_ENCLOSURES);
  });
});

describe("the ADR-0148 translation map", () => {
  it("maps every drawn form to its mount class", () => {
    expect(mountClassOfTraits("rotating_gunhouse", "enclosed")).toBe("TURRET");
    expect(mountClassOfTraits("barbette", "open")).toBe("BARBETTE");
    expect(mountClassOfTraits("casemate", "enclosed")).toBe("CASEMATE");
    expect(mountClassOfTraits("pedestal", "shielded")).toBe("SHIELDED");
    expect(mountClassOfTraits("pedestal", "open")).toBe("OPEN");
  });

  it("maps battery_port to the casemate family, so broadside and central batteries never fall to the generic glyph", () => {
    expect(mountClassOfTraits("battery_port", "enclosed")).toBe("CASEMATE");
  });

  it("has no class for a form not drawn as a gun mount, or an unknown form", () => {
    expect(mountClassOfTraits("tube_carriage", "open")).toBeUndefined();
    expect(mountClassOfTraits("funnel_stack", undefined)).toBeUndefined();
    expect(mountClassOfTraits("visual-traits-2-form", undefined)).toBeUndefined();
  });
});

describe("drawing resolution order", () => {
  const query = { style: "B", era: "VICTORIAN", size: "LARGE", guns: 2 } as const;

  it("a part-specific override wins over the trait match", () => {
    const c = catalog([
      universalDefault,
      mount("b-v", { style: "B", era: "VICTORIAN", sizes: ["LARGE"], mountClass: "TURRET" }),
      mount("b-special", {
        style: "B",
        era: "VICTORIAN",
        sizes: ["LARGE"],
        mountClass: "BARBETTE",
      }),
    ]);
    const r = resolveVisualMount(
      c,
      { ...query, presentationForm: "rotating_gunhouse", enclosure: "enclosed" },
      "b-special",
    );
    expect(r).toMatchObject({ part: { id: "b-special" }, step: "override", diagnostics: [] });
  });

  it("trait match: translates the trait pair and runs the style/era chain", () => {
    const c = catalog([
      universalDefault,
      mount("b-v", { style: "B", era: "VICTORIAN", sizes: ["LARGE"], mountClass: "TURRET" }),
    ]);
    const r = resolveVisualMount(c, {
      ...query,
      presentationForm: "rotating_gunhouse",
      enclosure: "enclosed",
    });
    expect(r).toMatchObject({ part: { id: "b-v" }, step: 1, diagnostics: [] });
  });

  it("interface-family fallback: an unmatched form draws the universal dreadnought glyph and diagnoses", () => {
    const c = catalog([universalDefault]);
    const r = resolveVisualMount(c, { ...query, presentationForm: "visual-traits-2-form" });
    expect(r).toMatchObject({ part: { id: "x-d-large-turret" }, step: "family" });
    expect(r.diagnostics).toEqual([
      { code: "VISUAL_TRAIT_UNMATCHED", trait: "presentation_form", value: "visual-traits-2-form" },
    ]);
  });

  it("missing-asset glyph: no fallback drawing at all is a visibly marked placeholder", () => {
    const r = resolveVisualMount(catalog([]), {
      ...query,
      presentationForm: "visual-traits-2-form",
    });
    expect(r).toMatchObject({ part: { id: "missing_asset" }, step: "missing" });
    expect(r.part.id).toBe(MISSING_ASSET_PART.id);
    expect(r.diagnostics).toHaveLength(1);
  });
});

describe("central and broadside batteries resolve to casemate-family drawings", () => {
  it("a battery_port query resolves to a CASEMATE entry for every style, era and size", () => {
    const missed: string[] = [];
    for (const style of NATION_STYLES)
      for (const era of VISUAL_ERAS)
        for (const size of SIZE_BANDS) {
          const r = resolveVisualMount(PART_CATALOG, {
            style,
            era,
            size,
            presentationForm: "battery_port",
            enclosure: "enclosed",
            guns: 3,
          });
          if (r.part.key.mountClass !== "CASEMATE")
            missed.push(`${style} ${era} ${size} -> ${r.part.id}`);
        }
    expect(missed).toEqual([]);
  });

  it("keeps the drawn class vocabulary closed", () => {
    expect([...MOUNT_CLASSES].sort()).toEqual([
      "BARBETTE",
      "CASEMATE",
      "OPEN",
      "SHIELDED",
      "TURRET",
    ]);
  });
});

describe("a broadside/central battery resolves to the casemate family (the nine)", () => {
  it("derives battery_port, which the translation map sends to CASEMATE", () => {
    const form = defaultPresentationForm({
      family: "gun_mount",
      provides: "gun_mount",
      mountType: "BROADSIDE_BATTERY",
    });
    expect(form).toBe("battery_port");
    expect(mountClassOfTraits(form!, "enclosed")).toBe("CASEMATE");
  });
});
