# State management

Docs: <https://effect.website/docs/v4/state-management/ref>, `synchronizedref`, `subscriptionref`.

## Signals

- `Ref.`, `SynchronizedRef.`, `SubscriptionRef.`, `MutableRef`.
- Module-level or closure-level `let`, `Map`, or `Set` mutated by several async paths.
- `Ref.get` followed by `Ref.set` in the same function.
- Hand-rolled observers: listener arrays, `EventEmitter`, callback registries.

## Idioms

- `Ref` is a concurrency-safe mutable cell. Every operation is an Effect; creation (`Ref.make`) is too.
- Update atomically with `Ref.update`, `Ref.modify` (compute a result and a new state together), `getAndUpdate`, `updateAndGet`.
- `SynchronizedRef` adds `updateEffect` / `modifyEffect`: the update itself runs effects and updates apply one at a time.
- `SubscriptionRef` is a `SynchronizedRef` whose `changes` stream emits the current value then every change; it replaces a hand-rolled observer list.
- Share a `Ref` as part of a service created in its layer, or provide it with `Effect.provideServiceEffect`.
- Domain state that must be replayable stays an immutable value passed through pure transitions; `Ref` holds the handle at the edge.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `get` then `set` on one `Ref` | leak | `Ref.update` or `Ref.modify`; the pair races under concurrency |
| Module-level mutable map shared across async paths | bypass | A `Ref` inside a service |
| `Ref` update that must run an Effect (query, call) | bypass | `SynchronizedRef.updateEffect` |
| Listener array with manual unsubscribe | bypass | `SubscriptionRef.changes` consumed as a `Stream` |
| `Ref` wrapping state that should be a pure fold | bypass | Pure reducer; keep `Ref` only at the edge |

## Project

Authoritative engine state is immutable values and commands. A `Ref` in an authoritative package is a design question for the grilling step, not a quick win.
