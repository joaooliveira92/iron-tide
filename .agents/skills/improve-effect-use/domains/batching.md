# Batching

Docs: <https://effect.website/docs/v4/batching>. Example: `vendor/effect/ai-docs/src/05_batching/10_request-resolver.ts`.

## Signals

- An `Effect.forEach`, `Promise.all(map(`, or loop that performs one IO call per item (an N+1 shape).
- The same lookup repeated for items sharing a key (owner, parent, id).
- Hand-built DataLoader, batch queue, or debounce-then-flush code.
- `Request.`, `RequestResolver.`, `Effect.request`.

## Idioms

- Model each call as a `Request` (`Request.Class` / `Request.TaggedClass`) carrying its input and declaring success and error types. Request equality decides which calls dedupe.
- A `RequestResolver` executes requests: `make` for one-at-a-time, `makeGrouped` or batched forms when the backend takes many at once. The resolver passed to `Effect.request` has no requirements; resolve services while constructing it.
- Query with `Effect.request(request, resolver)`. Requests started in the same synchronous run share a batch, which flushes after `Effect.yieldNow`.
- Requests batch only when they start together: set `concurrency` on `Effect.forEach` / `Effect.all` (for example `"unbounded"`); the default is sequential, so every batch holds one request.
- Tune batching on the resolver: `batchN`, `setDelay`, `grouped`, `around`, `withCache`.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Per-item IO inside `forEach` | bypass | Request plus resolver; one backend call per batch |
| Duplicate lookups for the same key | bypass | Request equality dedupes within a batch |
| Resolver built but caller loops sequentially | leak | Add `concurrency` so requests start together |
| Hand-rolled loader with timers | bypass | `RequestResolver.setDelay` / `batchN` |
| Resolver that requires services | leak | Resolve them when building the resolver |

## Project

Batching is IO optimisation. A candidate in an authoritative package is almost always a false positive; check that the loop is not computing game state before carding it.
