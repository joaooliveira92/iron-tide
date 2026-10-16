# Effect Schema patterns

Practical patterns for writing `Schema` code in Bluewave. The canonical guide is
the official v4 Schema documentation — some twenty pages from
[introduction](https://effect.website/docs/v4/schema/introduction) through
filters, transformations, classes, and canonical codecs. The vendored source
remains the final authority: `vendor/effect/src/Schema.ts`,
`vendor/effect/ai-docs/src/01_effect/02_schema/10_schema-basics.ts`, and
`vendor/effect/AGENTS.md` ("Defining schemas and domain models").

## Decode at boundaries, never assert

Every untrusted input (compiled YAML, saves, IPC/event envelopes, files) is
decoded with a strict schema before use (ADR-0102/0105). A bare `Schema.Struct`
strips unknown keys by default; at a boundary reject them with
`{ onExcessProperty: "error" }` (see
[managing excess properties](https://effect.website/docs/v4/schema/getting-started#managing-excess-properties)).

```ts
import { Schema } from "effect";
const options = { onExcessProperty: "error" } as const;
const decoded = Schema.decodeUnknownSync(MySchema, options)(input);
```

Options may be supplied when constructing the parser or when applying it. Never
`JSON.parse(...) as T` (`scripts/assert-boundary-decode.mjs` guards the scopes it
covers). Reuse the package helpers instead of re-deriving options: `decodeStrict`
/ `decodeStrictResult` (`packages/content-schema/src/decode.ts:18`) and
`parseDomainEvent*` (`packages/events/src/validation.ts:150`). Build parsers once
at the edge; do not rebuild them per call.

## Stay in the error channel

Prefer the Effect- and `Result`-returning decoders so failures stay typed rather
than thrown: `Schema.decodeUnknownEffect` and `Schema.decodeUnknownResult` (which
returns Effect's `Result`, `"Success"` | `"Failure"`, handled with `Result.*`, as
in `packages/persistence/src/store.ts:406`). Map issues to a tagged error with
`Effect.mapError`.

## Build schemas from combinators

`Struct`, `Record`, `Array`, `Tuple`, `Literals`, and `Union` (array form) compose
most boundaries ([basic usage](https://effect.website/docs/v4/schema/basic-usage)).
Add semantic rules with `.check(...)` plus built-in filters (`Schema.isInt`,
`Schema.isMinLength`, `Schema.isPattern`, `Schema.isGreaterThanOrEqualTo`,
`Schema.isBetween`) or `Schema.makeFilter` for cross-field rules; a filter passes
on `true`/`undefined` and fails on `false` or a message string
([filters](https://effect.website/docs/v4/schema/filters)). Filters do not change
the decoded type — branding does. Worked examples:
`packages/events/src/validation.ts:17`,
`packages/content-schema/src/ship-parts.ts:204`.

## Transform with codecs

Model coercion as a transformation, not a hand-written predicate:
`Schema.decodeTo(Target, SchemaTransformation.transform({ decode, encode }))` for
infallible conversions, and `SchemaGetter.transformEffect` when a direction may
fail or require services
([transformations](https://effect.website/docs/v4/schema/transformations)). A
schema is a `Codec<Type, Encoded, RD, RE>`: `Type` is the decoded value, `Encoded`
the wire form. Name transformed schemas `TFromE` — `Schema.FiniteFromString`
decodes a `string` into a finite `number` and encodes it back.

## Branded safe integers at the seam

Canonical numeric units are branded safe integers (contracts `SafeInt`, `Um`,
`Money`, ...). Accept a plain `number` on the wire and annotate the contracts
brand at the schema seam; `Schema.brand` mints Effect's own
`Brand.Brand<"SafeInt">`, not the contracts brand, so do not let it mint a
competing one
([branded types](https://effect.website/docs/v4/schema/advanced-usage)).
Worked example: `packages/combat/src/air-defense/attack.ts:71`.

## Error types

In-process domain errors use `Data.TaggedError` — runtime-free packages import
only `Data` and recover with `Effect.catchTag` on the stable `_tag` (see
`packages/commands/src/errors.ts:20`, `packages/events/src/errors.ts:17`).
`Schema.TaggedError<X>()("X", { ... })` is reserved for failures that must survive
serialization across a wire boundary
([classes](https://effect.website/docs/v4/schema/classes)). Discriminate with
`_tag`, never `instanceof`.

## Customize messages with annotations

Replace a node's default failure text with `.annotate({ message })`, field-level
messages with `Schema.annotateKey({ messageMissingKey })`, and the excess-key
message with `messageUnexpectedKey` (see
[error messages](https://effect.website/docs/v4/schema/error-messages)). Sync
decoders throw a `SchemaError` carrying an `issue`;
`SchemaIssue.makeFormatterDefault()` formats it.

## Avoid

- asserting a boundary instead of decoding it;
- hand-written predicates where a schema already exists;
- silently stripping excess keys at an untrusted boundary;
- changing a wire format without re-pinning the parity fixtures.
