# Stream

Docs: <https://effect.website/docs/v4/stream/introduction>, `creating`, `consuming-streams`, `error-handling`, `operations`, `resourceful-streams`. Examples: `vendor/effect/ai-docs/src/03_stream`.

## Signals

- A whole dataset loaded into an array, then mapped or filtered, where the source is incremental (files, pages, events, rows).
- `for await`, async generators, manual pagination loops, `EventEmitter` fan-in.
- `Stream.` anywhere (check usage is idiomatic).
- `Effect.forEach` over a large input collecting results that are never used.

## Idioms

- Create: `Stream.fromIterable`, `make`, `range`, `paginate` (paged APIs), `unfold`, `fromEffectSchedule` (polling), `fromAsyncIterable`, `fromEventListener`, `callback` (any callback API), `fromQueue`, `fromPubSub`, `scoped`.
- Transform: `map`, `mapEffect({ concurrency })`, `flatMap`, `filter`, `scan`, `take`, `tap`, `grouped`, `groupedWithin`, `groupByKey`, `merge`, `zip`, `buffer`, `debounce`, `throttle`.
- Consume: `runCollect`, `runForEach`, `runFold`, `runDrain`, `runCount`, or `Stream.run(stream, sink)`. Pick the consumer that avoids holding more than needed.
- Failures: stream-level `retry`, `catch`, `timeout`; resource-backed streams compose `Effect.acquireRelease` with `Stream.scoped` so the resource closes when the stream ends or is interrupted; `Stream.ensuring` adds a bare finalizer.
- Structured wire data: `Stream.pipeThroughChannel` with `Ndjson` and `SchemaBinary` decodes and encodes typed records.
- Streams are pull-based, so back-pressure comes free; `buffer` widens it deliberately.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Read-everything-then-process for incremental sources | bypass | `Stream` pipeline with a bounded consumer |
| Manual page loop | bypass | `Stream.paginate` |
| `for await` inside `Effect.gen` | bypass | `Stream.fromAsyncIterable` |
| `runCollect` followed by a reduce | bypass | `runFold` or a `Sink` |
| Sequential `mapEffect` over independent items | bypass | `mapEffect(f, { concurrency: n })` |
| Resource opened inside a stage, never closed on failure | leak | `Effect.acquireRelease` inside `Stream.scoped`; `Stream.ensuring` for a bare finalizer |
| Event emitter converted by hand | bypass | `Stream.callback` / `fromEventListener` |
| Polling loop feeding a consumer | bypass | `Stream.fromEffectSchedule` |

## Project

Streams carry IO volume (compile, save, replay corpus). They do not belong in authoritative simulation steps.
