# Requirements management

Docs: <https://effect.website/docs/v4/requirements-management/services> and siblings (default-services, layers, layer-memoization).

## Signals

- `Context.Service`, `Context.Reference`, `Layer.`, `Effect.provide`, `Effect.provideService`.
- Module-level singletons: `let`/`const` holding a client, store, or cache that other modules import.
- `Effect.Effect<_, _, ` with a non-`never` third parameter on a service method.
- v3 residue: `Context.Tag`, `Effect.Service`, `Layer.scoped` (see [V4-DRIFT.md](../V4-DRIFT.md)).
- Absence: IO code taking its collaborators as ad-hoc function arguments through several calls.

## Idioms

- A service is a `Context.Service` class. Methods are `Effect<A, E, never>`: dependencies resolve once while the layer builds and the methods close over them.
- Attach the live layer as a static `layer` (or `layerX`). Build with `Layer.effect(Service, Effect.gen(...))`, return `Service.of({...})`.
- `Context.Reference` carries a default value (config, feature flag). The five default services (`Clock`, `ConfigProvider`, `Console`, `Random`, `Tracer`) are references: override with `Effect.provideService`, or `Random.withSeed`.
- Compose with `Layer.provide` (feed an inner layer), `Layer.provideMerge` (feed and keep the output), `Layer.merge` / `mergeAll` (side by side). `Layer.unwrap` builds a layer from an Effect or Config; `Layer.effectDiscard` runs background work with no service.
- Layers memoize by reference identity when provided globally. Build a layer once and share the value; calling a layer-making function twice builds twice. `Layer.fresh` opts out. `Effect.provide(layer)` applied locally rebuilds on every use.
- `Effect.serviceOption` reads a service that may be absent. `Layer.mock` stubs a partial service for a test.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Service method with `R` other than `never` | leak | Resolve the dependency in the layer, close over it |
| Module-level mutable singleton or imported client | bypass | A service plus a layer; tests provide a fake |
| `Effect.provide(heavyLayer)` inside a function called repeatedly | leak | Provide once at the edge; share the built layer |
| `makeLayer()` called in several places | leak | One exported layer value; memoization needs the same reference |
| Large service mixing unrelated methods | bypass | Split by reason to change; callers require only what they use |
| `Layer.fresh` with no reason to isolate | leak | Drop it so the layer is built once |
| Test that rebuilds the whole real graph for one service | bypass | `Layer.mock` or a small test layer |
| `Context.Tag`, `Effect.Service`, `Layer.scoped` | drift | `Context.Service`, `Layer.effect` |
| Ambient reads (`process.env`, `Date.now`) inside a service | bypass | A `Config` or `Clock` requirement resolved in the layer |

## Project

Name stored layers `layer` / `layerX` (the docs' `Live` / `Test` suffix does not apply). A per-call dependency in a method signature needs a stated reason (AGENTS.md). Layers belong at edges; a runtime-free package exposes plain functions and types.
