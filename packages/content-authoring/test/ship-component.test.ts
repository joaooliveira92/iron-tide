import { describe, expect, it } from "vite-plus/test";

import {
  ComponentDefinitionError,
  ProvenanceError,
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
  provenance,
  renderExpression,
  terms,
  type Term,
} from "../src/index.js";

const baseSpec = {
  id: "gun_test",
  displayName: "Test gun",
  category: "MAIN_GUN",
  introduction: { fromMonth: "1880-01", obsoleteMonth: null },
  constants: { gun_kg: 100, barrels_fixed: 2 },
  parameters: { barrels: { min: 1, max: 4, step: 1 } },
  formulas: (v: { gun_kg: Term; barrels_fixed: Term; barrels: Term }) => ({
    weightKg: v.gun_kg.plus(v.barrels_fixed).times(v.barrels),
    volumeLitre: number(3).times(v.gun_kg),
    costMicro: v.gun_kg.times(v.barrels),
    crew: number(12).times(v.barrels),
    powerKw: number(1).times(v.barrels),
  }),
} as const;

describe("expression rendering matches the legacy formula grammar", () => {
  it("parenthesises by precedence rather than by shape", () => {
    const v = terms({ a: 1, b: 1, c: 1, d: 1 });
    expect(renderExpression(v.a.plus(v.b).times(v.c).plus(v.d))).toBe("(a + b) * c + d");
    expect(renderExpression(v.a.plus(v.b.times(v.c)))).toBe("a + b * c");
    expect(renderExpression(v.a.plus(v.b).times(v.c))).toBe("(a + b) * c");
    expect(renderExpression(number(3).times(v.a.plus(v.b)))).toBe("3 * (a + b)");
    expect(renderExpression(v.a.minus(v.b).minus(v.c))).toBe("a - b - c");
    expect(renderExpression(v.a.over(v.b))).toBe("a / b");
  });

  it("accepts integer literals as operands and rejects fractions", () => {
    const v = terms({ a: 1 });
    expect(renderExpression(v.a.times(12))).toBe("a * 12");
    expect(() => v.a.times(1.5)).toThrow(RangeError);
    expect(() => number(-3)).not.toThrow();
  });
});

describe("provenance is validated data", () => {
  it("rejects an estimate that does not explain itself", () => {
    expect(() => provenance("costMicro", { status: "estimate" })).toThrow(ProvenanceError);
    try {
      provenance("costMicro", { status: "estimate" });
    } catch (error) {
      expect((error as ProvenanceError)._tag).toBe("ProvenanceError");
      expect((error as ProvenanceError).field).toBe("costMicro");
    }
  });

  it("rejects a sourced value with no source and accepts an explained estimate", () => {
    expect(() => provenance("weightKg", { status: "sourced" })).toThrow(ProvenanceError);
    expect(provenance("weightKg", { status: "estimate", rationale: "no source" }).status).toBe(
      "estimate",
    );
  });
});

describe("defineShipComponent", () => {
  it("renders the document the schema expects", () => {
    const component = defineShipComponent({
      ...baseSpec,
      formulas: (v) => ({
        ...baseSpec.formulas(v),
        heightMm: number(3200),
      }),
      attributes: () => ({ caliberUm: number(274000) }),
    });
    expect(component.weightKg).toBe("(gun_kg + barrels_fixed) * barrels");
    expect(component.crew).toBe("12 * barrels");
    expect(component.heightMm).toBe("3200");
    expect(component.attributes).toEqual({ caliberUm: "274000" });
    expect(Object.keys(component.constants)).toEqual(["barrels_fixed", "gun_kg"]);
  });

  it("fails closed on a formula field the schema does not have", () => {
    expect(() =>
      defineShipComponent({
        ...baseSpec,
        formulas: (v: never) => ({ weigthKg: v }),
      } as never),
    ).toThrow(ComponentDefinitionError);
  });

  it("fails closed on provenance for a field that is not emitted", () => {
    expect(() =>
      defineShipComponent({
        ...baseSpec,
        fieldProvenance: { coolingKw: { status: "estimate", rationale: "none" } },
      }),
    ).toThrow(ComponentDefinitionError);
  });

  it("rejects duplicate component ids in a catalogue", () => {
    const component = defineShipComponent(baseSpec);
    expect(() => defineShipComponentCatalogue([component, component])).toThrow(
      ComponentDefinitionError,
    );
  });

  it("does not type an undeclared input", () => {
    defineShipComponent({
      ...baseSpec,
      formulas: (v) => {
        // @ts-expect-error an undeclared constant is a compile error, not a runtime surprise
        void v.ghost_kg;
        return baseSpec.formulas(v);
      },
    });
  });
});
