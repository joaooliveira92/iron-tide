# V4 drift

Names that exist in Effect v3 and are absent from the vendored `effect@4.0.2`. A hit is **drift**. Each row was checked against `vendor/effect/src`; re-check the right-hand name before citing it, and when a drifted name is missing from this table, find its replacement in the source.

| v3 name | v4 replacement |
| --- | --- |
| `Context.Tag`, `Context.GenericTag`, `Effect.Tag`, `Effect.Service` | `Context.Service<Self, Shape>()("id")` class; `Context.Reference` for a service with a default value |
| `Layer.scoped` | `Layer.effect` (its requirements already exclude `Scope`) |
| `Effect.catchAll` | `Effect.catch` |
| `Effect.catchAllCause`, `Effect.catchAllDefect` | `Effect.catchCause`, `Effect.catchDefect` |
| `Effect.either`, `Either` | `Effect.result`, `Result` (`Result.match`, `Result.isSuccess`) |
| `Option.fromNullable` | `Option.fromNullishOr` |
| `Effect.fork` | `Effect.forkChild` |
| `Effect.forkDaemon` | `Effect.forkDetach` |
| `Effect.async` | `Effect.callback` |
| `Effect.timeoutFail`, `Effect.timeoutTo` | `Effect.timeoutOrElse({ duration, orElse })` |
| `Effect.makeSemaphore`, `Effect.makeLatch` | `Semaphore.make`, `Latch.make` |
| `Effect.cachedFunction` | `Cache.make({ lookup, capacity })` with `Cache.get` |
| `Effect.runtime`, `Runtime.runPromise` | `Effect.run*With(context)` or `ManagedRuntime.make(layer)` |
| `Effect.dieMessage(msg)` | `Effect.die(new Error(msg))` |
| `Config.string("X")`, `Config.redacted`, `Config.integer` | `Config.String("X")`, `Config.Redacted`, `Config.Int`; `Config.Port`, `Config.Duration`, `Config.Boolean`; `Config.schema(schema, "X")` for custom types |
| `Schema.decodeUnknown` | `Schema.decodeUnknownEffect` (also `decodeUnknownResult`, `decodeUnknownExit`, `decodeUnknownOption`, `decodeUnknownSync`) |
| `Schema.filter`, `Schema.pattern`, `Schema.minLength` | `schema.check(Schema.isPattern(re))`, `Schema.isMinLength(n)`, `Schema.makeFilter` |
| `Schema.parseJson` | `Schema.fromJsonString` |
| `Schema.optionalWith` | `Schema.optionalKey` (key may be absent) or `Schema.optional` (key may be `undefined`) |
| `Schema.Either` | `Schema.Result(success, failure)` |

## Shape drift

Same name, new behaviour. Check by reading the call site.

- **Cause is flat.** Inspect `cause.reasons` (`Fail`, `Die`, `Interrupt`) with `Cause.hasFails`, `hasDies`, `hasInterrupts`, `findError`, `findDefect`. Code that walks a `Sequential` or `Parallel` tree is v3.
- **`Effect.catch` recovers typed failures only.** Defects and interruptions pass through; `catchDefect` and `catchCause` handle those.
- **Fibers start after the current fiber yields.** A forked fiber that must see current state needs a yield point or an explicit handoff (`Deferred`, `Latch`).
- **`Effect.all` and `Effect.forEach` run sequentially** unless `concurrency` is set; batching only happens under concurrency.
- **`Effect.retry({ times: n })` counts retries**, so the source runs `n + 1` times. `Schedule.recurs(n)` is the same.
- **`Union` takes an array** and literals come from `Schema.Literals([...])`.
