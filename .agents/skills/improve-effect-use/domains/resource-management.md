# Resource management

Docs: <https://effect.website/docs/v4/resource-management/introduction> and <https://effect.website/docs/v4/resource-management/scope>.

## Signals

- `try { ... } finally`, `.close()`, `.destroy()`, `.dispose()`, `.unref()`, `setInterval`, `addEventListener`, `new Worker`, `new WebSocket`, opened file or database handles.
- `Effect.acquireRelease`, `acquireUseRelease`, `Effect.scoped`, `Scope`, `addFinalizer`, `ensuring`, `onExit`.
- `Effect.runFork` or `forkDetach` of a loop with no handle.
- A public effect whose `R` still contains `Scope`.

## Idioms

- `Effect.acquireRelease(acquire, release)` pairs acquisition with release; acquisition is uninterruptible and release always runs once acquisition succeeds. `Effect.acquireUseRelease` fuses use into one expression.
- `Effect.scoped` creates a scope, runs the effect, closes the scope. Finalizers run in reverse order of registration, on success, failure, and interruption.
- `Effect.ensuring`, `onExit` (receives the `Exit`), `onError` (receives the `Cause`) cover cleanup that owns no resource value.
- A resource a service owns is acquired inside its layer (`Layer.effect` with `acquireRelease`); the layer's lifetime is the resource's lifetime.
- Keyed or pooled resources: `LayerMap`, `RcMap`, `RcRef`, `Pool`. Background work tied to a scope: `Effect.forkScoped` or `forkIn`.
- `Scope.provide` extends a scoped value into a larger scope. Closing a scope does not interrupt a task that is still running inside it.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `try`/`finally` pairing open and close | bypass | `acquireRelease` / `acquireUseRelease` |
| Handle, timer, or listener created with no matching release | leak | Register the release as a finalizer |
| `setInterval` loop started in a service | leak | `Effect.forkScoped` of a `Schedule`d effect |
| Fire-and-forget `runFork` whose fiber is dropped | leak | Fork into the owning scope so shutdown interrupts it |
| Public effect still requiring `Scope` | leak | `Effect.scoped` at the owner, or build it inside a layer |
| Layer opens a resource but never releases it | leak | Move acquisition into `acquireRelease` inside the layer |
| Cleanup that must read the outcome, written as try/catch/finally | bypass | `Effect.onExit` |

## Project

Authoritative packages hold no handles; resource gaps live at edges (`persistence`, `content-compiler`, `apps/desktop/src/main`, `apps/compiler-cli`).
