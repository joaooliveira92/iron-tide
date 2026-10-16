# Effect error patterns

Grounding: `vendor/effect` — the `Data` and `Schema` module sources. This repo
has three deliberate error shapes; pick by _where the failure is observed_,
never by habit.

| Shape                                | When                                                  | Runtime cost        |
| ------------------------------------ | ----------------------------------------------------- | ------------------- |
| `Data.TaggedError`                   | in-process domain failure in a pure package           | imports `Data` only |
| plain tagged class (`readonly _tag`) | renderer-reachable code that must not bundle `effect` | none                |
| `Schema.TaggedError`                 | failure that crosses a wire/serialization boundary    | full `Schema`       |

## In-process: Data.TaggedError

Pure packages (`events`, `commands`, `combat`, …) import only `Data`:

```ts
import { Data } from "effect";

export class DuplicateEventIdError extends Data.TaggedError("DuplicateEventIdError")<{
  readonly eventId: string;
  readonly message: string;
}> {}
```

`Data.TaggedError` sets a stable `_tag`, so callers recover with
`Effect.catchTag` _without the package importing the runtime_.

## Renderer-reachable: plain tagged class

`campaign` and the renderer must not bundle `effect` (ADR-0128 §1, MIG-EXCL-1),
so a compile-boundary failure is a plain class with `readonly _tag` — still
discriminated by `_tag`, never `instanceof`.

## Wire: Schema.TaggedError

Only failures that are serialized use `Schema.TaggedError`. The wire format is
frozen and every schema change carries a parity test.

## Handling

- Discriminate with `_tag`, never `instanceof`.
- Handle each failure at its call site with `Effect.catchTag`/`catchTags`/
  `catchReason`; no shared error transformers or guards that probe the failure
  channel.
- No `Effect.orDie` except where recovery is intentional.
