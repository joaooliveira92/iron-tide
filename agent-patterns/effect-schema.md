# Effect Schema patterns

Grounding: `vendor/effect` — the `Schema` module source plus
`ai-docs/src/01_effect/02_schema/`. Read those before inventing a validator.

Effect Schema is the single validator at every boundary. `Schema.Struct` strips
excess keys by default; this repo **rejects** them, preserving the old Zod
`.strict()` behaviour (ADR-0105). Never `JSON.parse(...) as T` and never a second
validator.

## Strict decode at a boundary

The excess-key policy is a _decode option_, not part of the schema AST in Effect
v4, so pass it at the call site:

```ts
import { Schema } from "effect";

const parseOptions = { onExcessProperty: "error", errors: "all" } as const;

const decoded = Schema.decodeUnknownSync(ShipSchema, parseOptions)(input); // throws
const result = Schema.decodeUnknownResult(ShipSchema, parseOptions)(input); // Result
```

`@bluewave/content-schema` wraps this once as `decodeStrict` /
`decodeStrictResult` (`CONTENT_DECODE_OPTIONS`). Reuse it rather than repeating
the options object.

## Domain models

`Schema.Class` gives a runtime validator and a TypeScript class in one:

```ts
export class Ship extends Schema.Class<Ship>("bluewave/content/Ship")({
  id: Schema.NonEmptyString,
  tonnage: Schema.Int,
}) {}
```

## Failures from validation

In-process failures are `Data.TaggedError`, not `Schema.TaggedError` — see
[effect-errors](effect-errors.md). When decoding returns a `Result`, map the
`SchemaIssue` at the call site; do not share a transformer.

## What to avoid

- Asserting a boundary with `as T`.
- A hand-written `isRecord`/`isString` — use `Predicate`.
- Dual-maintaining a second validator (Zod is gone).
