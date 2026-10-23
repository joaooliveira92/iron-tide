# Coding style

Docs: <https://effect.website/docs/v4/code-style/guidelines>, `dual`, `branded-types`, `pattern-matching`, `do`, `control-flow`. House idiom: `vendor/effect/AGENTS.md` ("Writing Effect code").

## Signals

- Absence: zero `Effect.fn` / `Effect.fnUntraced` in an effectful package (grep for both).
- Pyramids of `flatMap` / `andThen`, `Effect.Do` with `bind`, `pipe` chains deeper than a screen.
- Functions that only wrap and return `Effect.gen(...)`.
- Switches and `if` ladders on `_tag`.
- `number` or `string` aliases for ids and units.
- `.pipe(` attached to an `Effect.fn` body.

## Idioms

- `Effect.gen` for sequential logic; attach cross-cutting behaviour (`catchTag`, `withSpan`, `annotateLogs`) with `.pipe`.
- A reusable effectful function is `Effect.fn("name")(function*(...) {...}, ...extra)`; use `Effect.fnUntraced` for hot paths and library internals. Type the result with `Effect.fn.Return<A, E, R>`. Extra combinators go in the following arguments, never in `.pipe`.
- `return yield* new MyError(...)` so TypeScript sees the function stop.
- Dual APIs: every combinator works data-first (`Effect.map(self, f)`) and data-last (`self.pipe(Effect.map(f))`). Pick one style per file.
- `Match` (`Match.type`, `Match.tag`, `Match.tags`, `Match.exhaustive`) or `Data.taggedEnum` with `$match` replace manual `_tag` switches and make a missing case a compile error.
- Control flow: `Effect.when`, `Effect.forEach` (`discard: true` when results are unused), `Effect.all` with `concurrency`, `Effect.whileLoop`; `Effect.as` / `asVoid` / `Effect.void` instead of `map(() => ...)`.
- Brand domain primitives with `Brand` or `Schema.brand`; validate at construction.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| No `Effect.fn` in an effectful package | bypass | `Effect.fn("Service.method")` gives spans and stack frames |
| Function whose body is only `Effect.gen` | bypass | `Effect.fn` / `fnUntraced` |
| Nested `flatMap` or `Effect.Do` + `bind` | bypass | `Effect.gen` |
| `.pipe` after an `Effect.fn` body | bypass | Pass the combinators as extra `Effect.fn` arguments |
| `switch (x._tag)` without exhaustiveness | bypass | `Match.tag` + `Match.exhaustive` or `$match` |
| `map(() => undefined)`, `map(() => value)` | bypass | `Effect.asVoid`, `Effect.as(value)` |
| `forEach` with unused results collected | leak | `{ discard: true }` |
| Raw `number` for ids and units in effectful signatures | bypass | Brand (contracts already holds the project brands) |

## Project

Write no code comments (ADR-0268); the examples in the upstream docs carry comments, the code here does not. Stored layers are `layer` / `layerX`. Use `.pipe` for linear composition and `Effect.gen` for sequential workflows.
