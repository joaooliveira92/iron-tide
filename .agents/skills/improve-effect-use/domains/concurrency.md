# Concurrency

Docs: <https://effect.website/docs/v4/concurrency/fibers>, `deferred`, `queue`, `pubsub`, `semaphore`, `latch`.

## Signals

- `Promise.all`, `Promise.race`, `async` callbacks run in parallel, `Promise.withResolvers`.
- `Effect.forkChild`, `forkScoped`, `forkIn`, `forkDetach`, `Fiber.`.
- `Effect.all` / `Effect.forEach` with or without a `concurrency` option.
- `Queue.`, `PubSub.`, `Deferred.`, `Semaphore.`, `Latch.`, `FiberSet`, `FiberMap`.
- Hand-rolled mutex flags, task queues, worker pools, polling for a ready flag.

## Idioms

- Fibers are structured: `forkChild` ends with its parent, `forkScoped` with its scope, `forkIn(scope)` with a chosen scope, `forkDetach` never unless the process ends. Pick the shortest lifetime that is correct.
- `Fiber.join` gets the result, `Fiber.await` gets an `Exit`, `Fiber.interrupt` waits for finalizers. A forked fiber starts after the current fiber yields.
- `Effect.all`, `forEach`, `zip` are sequential by default. `{ concurrency: n | "unbounded" }` parallelises; bound it when input size is unbounded. `Effect.race` / `raceAll` take the first finisher and interrupt the rest.
- `Deferred`: one-shot signal between fibers. `Latch`: a gate that opens once (setup done). `Semaphore.withPermits(n)` / `withPermit`: mutual exclusion or a concurrency cap.
- `Queue.bounded` (back-pressure), `sliding`, `dropping`, `unbounded` (risks growth). Close with `Queue.end` or `shutdown`. `PubSub` broadcasts to every subscriber; subscribe before publishing, and prefer bounded, sliding, or dropping.
- Supervise a changing set of fibers with `FiberSet` / `FiberMap`.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `Promise.all` over Effect-able work | bypass | `Effect.all` with `concurrency`; interruption propagates |
| Independent effects in a `forEach`, run sequentially by default | bypass | Set `concurrency` after checking ordering and load |
| `{ concurrency: "unbounded" }` over input of unknown size | leak | A numeric bound |
| `forkDetach` with no owner | leak | `forkScoped` or `forkIn(scope)` |
| Boolean flag as a lock | bypass | `Semaphore.make(1)` and `withPermits(1)` |
| Polling a flag until ready | bypass | `Deferred` or `Latch` |
| `Queue.unbounded` fed by an unbounded producer | leak | `bounded` or `sliding` |
| Event emitter with several consumers | bypass | `PubSub` with subscribers in a scope |
| Fork result ignored; failure silently lost | leak | Join it, or supervise through `FiberSet` |
| `Effect.fork`, `forkDaemon`, `makeSemaphore` | drift | `forkChild`, `forkDetach`, `Semaphore.make` |

## Project

Authoritative outcomes may not depend on scheduler order. Concurrency gaps are IO and edge concerns; a concurrency candidate in authoritative code needs a determinism argument before it is carded.
