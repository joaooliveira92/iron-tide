// Pins the raw `effect@4.0.2` mechanism behind ADR-0155 (per-schema excess-key
// strictness): a plain `Schema.Struct` strips unmodeled keys on decode — string
// *and* symbol — and rejection requires `{ onExcessProperty: "error" }`. The
// boundary-level behaviour is covered elsewhere
// (`schema-serialization.test.ts` locks the strip default;
// `@bluewave/content-schema` and `@bluewave/combat` parity tests lock rejection);
// this asserts the mechanism itself, independently of the docs and of any
// boundary helper. Authority: the vendored byte-identical `effect@4.0.2`.

import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

const schema = Schema.Struct({ a: Schema.String });
const sym = Symbol("sym");
const input = { a: "a", extra: "x", [sym]: "s" };

const ownKeysShape = (value: object) => ({
  strings: Object.keys(value).sort(),
  symbols: Object.getOwnPropertySymbols(value).map(String),
});

describe("Schema.Struct excess-key mechanism (ADR-0155)", () => {
  it("strips unmodeled string and symbol keys by default", () => {
    const decoded = Schema.decodeUnknownSync(schema)(input);
    expect(ownKeysShape(decoded)).toEqual({ strings: ["a"], symbols: [] });
  });

  it("treats explicit { onExcessProperty: 'ignore' } the same as the default", () => {
    const decoded = Schema.decodeUnknownSync(schema, { onExcessProperty: "ignore" })(input);
    expect(ownKeysShape(decoded)).toEqual({ strings: ["a"], symbols: [] });
  });

  it("rejects an excess string key under { onExcessProperty: 'error' }", () => {
    expect(() => Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(input)).toThrow(
      /excess property/,
    );
    expect(
      Result.isFailure(Schema.decodeUnknownResult(schema, { onExcessProperty: "error" })(input)),
    ).toBe(true);
  });

  it("covers a declared symbol key but rejects an undeclared symbol key under 'error'", () => {
    const declared = Schema.Struct({ a: Schema.String, [sym]: Schema.String });
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(declared, { onExcessProperty: "error" })({
          a: "a",
          [sym]: "s",
        }),
      ),
    ).toBe(true);
    const otherSym = Symbol("other");
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(declared, { onExcessProperty: "error" })({
          a: "a",
          [sym]: "s",
          [otherSym]: "x",
        }),
      ),
    ).toBe(true);
  });

  it("emits an open JSON Schema by default (no additionalProperties: false)", () => {
    const json = JSON.stringify(Schema.toJsonSchemaDocument(schema));
    expect(json).not.toContain('"additionalProperties":false');
  });
});
