# Sink

Docs: <https://effect.website/docs/v4/sink/introduction>, `creating`, `operations`, `leftovers`. Source: `vendor/effect/src/Sink.ts`.

Sink is niche. Default every candidate here to `Speculative` unless a `Stream` consumer is reimplemented by hand in several places.

## Signals

- Stream consumers that share accumulation logic: counts, sums, first/last, windows, folds with a stop condition.
- `Stream.runCollect` followed by `.reduce`, `.slice`, or `.find`.
- `Stream.run(` or `Sink.` already present.

## Idioms

- A `Sink` consumes a stream and produces one result. Built-ins: `head`, `last`, `find`, `take`, `drain`, `fold`, `foldUntil`, `reduce`, `reduceWhile`, `every`, `some`, `fromEffect`, `fromQueue`, `fromPubSub`.
- Adapt without rewriting: `mapInput` / `mapInputEffect` (change input), `map` / `mapEffect` (change output), `mapError`, `flatMap`.
- Leftovers: input a sink did not consume remains available; `ignoreLeftover` drops it, `mapLeftover` transforms it.
- Run with `Stream.run(stream, sink)`; one sink serves many streams and many tests.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Same accumulation reimplemented over several streams | bypass | One named `Sink`, run with `Stream.run` |
| Collect-all then take the first match | bypass | `Sink.find` or `head`, which stops early |
| Fold with a manual early-exit flag | bypass | `Sink.foldUntil` / `reduceWhile` |
| Consumer logic untestable without the producer | bypass | A `Sink` testable against `Stream.make(...)` |

## Project

Do not card a Sink for a single one-off fold; `Stream.runFold` is the right size.
