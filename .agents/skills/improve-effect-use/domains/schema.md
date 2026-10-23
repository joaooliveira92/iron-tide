# Schema

Single source of truth: [agent-patterns/effect-schema.md](../../../../agent-patterns/effect-schema.md) holds this repo's Schema patterns and links the official pages. Read it before carding anything here. Docs index: <https://effect.website/docs/v4/schema/introduction>; source: `vendor/effect/src/Schema.ts`.

## Signals

- `JSON.parse(`, `as unknown as`, `as T` near external input; hand-written type guards or validators beside a schema (dual maintenance).
- `Schema.decodeUnknownSync` in code that already returns Effects.
- Decoding of boundary input without `{ onExcessProperty: "error" }`.
- Parsers rebuilt per call.
- `interface` / `type` declarations that duplicate a schema's shape.
- v3 residue: `Schema.decodeUnknown`, `Schema.filter`, `Schema.parseJson` (see [V4-DRIFT.md](../V4-DRIFT.md)).

## Idioms

- Decode every boundary (compiled YAML, saves, IPC and event envelopes, files) with a strict schema; keep failures typed via `decodeUnknownEffect` / `decodeUnknownResult`.
- One schema produces the type, validator, encoder, `Arbitrary` (via `Arbitrary.schema`), JSON Schema, and `Equivalence`; derive the TypeScript type from it (`typeof S.Type`).
- Rules via `.check(...)` and `Schema.is*` filters; brands via `Schema.brand`; wire coercions via `decodeTo` + `SchemaTransformation`.
- `Schema.Class` / `TaggedClass` for domain values; `Schema.TaggedError` for wire errors; `Schema.Defect()` to carry a cause across a wire.
- `onExcessProperty: "error"` guards only declared Structs. A field typed `Schema.Unknown` or `Schema.Record(String, Unknown)` accepts any keys, so strictness cannot reach that subtree.
- Wire formats are frozen: a schema change ships with a parity test built from existing fixtures.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Boundary asserted with a cast | bypass | Strict decode at the edge |
| Validator maintained beside a schema | bypass | Delete it; call the schema |
| Throwing decoder inside an Effect pipeline | leak | `decodeUnknownEffect` / `Result` variant, `mapError` to a tagged error |
| Strip-by-default struct at an untrusted boundary | leak | `onExcessProperty: "error"` |
| Parser constructed on each call | bypass | Build once at module or layer scope |
| Type declared twice (interface plus schema) | bypass | `typeof Schema.Type` |
| Test fixtures hand-written for a schema'd type | bypass | `Arbitrary.schema` |
| Plain `number` for a unit the contracts package already brands | leak | Annotate the contracts brand at the seam |
| Strictness change on a schema whose tests assert "strips" or "accepts" | decision | Card a decision request: the open behaviour may be deliberate and the fix breaks its pinned tests |

## Project

`scripts/assert-boundary-decode.mjs` covers part of this. Do not dual-maintain two validators, and do not change a wire format without re-pinning the parity fixtures.
