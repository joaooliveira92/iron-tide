# Runtime

Docs: <https://effect.website/docs/v4/runtime>. Entrypoints: `vendor/effect/ai-docs/src/01_effect/06_running` and `vendor/effect/ai-docs/src/04_integration`.

## Signals

- `Effect.runPromise`, `runSync`, `runFork`, `runPromiseExit`, `runSyncExit`, `*With` variants.
- `ManagedRuntime.make`, `.runPromise`, `.dispose`.
- `NodeRuntime.runMain`, `Layer.launch`.
- Any `from "effect"` import of `Effect`, `Layer`, `Context`, or `ManagedRuntime` inside a pure package.
- `new Promise(` wrapping an Effect, `await` inside `Effect.gen`.

## Idioms

- Run effects at the edge only. The process entrypoint is `NodeRuntime.runMain(program)` (from `@effect/platform-node`) or `Layer.launch(appLayer)` for a long-running app.
- Embedding in non-Effect code (a framework hook, an IPC handler): build one `ManagedRuntime.make(appLayer)`, reuse it, `dispose` it on shutdown. It builds the layer once on first use and keeps a build failure forever; put `Effect.retry` inside the layer when the failure may be transient.
- `Effect.run*With(context)` runs with an explicit `Context` and skips a layer.
- Override a service for one region with `Effect.provide(layer)`; the setting reverts after the region.
- `Effect.runSync` suits only code with no async step. `runFork` returns a fiber; observe or supervise it.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `run*` inside a service or domain function | misplaced run | Return the Effect; the edge runs it |
| `ManagedRuntime` created per call or per request | misplaced run | One runtime per process, disposed on shutdown |
| `runFork` with an ignored fiber | leak | Fork into a scope or keep the handle and join/interrupt it |
| `await` or `new Promise` inside `Effect.gen` | bypass | `Effect.promise`, `tryPromise`, or `Effect.callback` |
| Several runtimes built from the same layer | leak | Share one; memoization does not cross runtimes |
| Runtime-free package importing `Effect` | misplaced run | Plain function; wrap it in an Effect at the edge |
| Process exit handled by hand around a run | bypass | `runMain` already handles teardown and exit codes |
| `Effect.runtime`, `Runtime.runPromise` | drift | `Effect.run*With`, `ManagedRuntime` |

## Project

AGENTS.md "Effect source of truth" and `docs/agents/runtime-free-gate.md` fix where the runtime may live. The renderer and preload import no `effect`.
