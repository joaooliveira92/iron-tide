# Data types

Docs: <https://effect.website/docs/v4/data-types/option> and siblings (result, exit, cause, chunk, data, datetime, duration, bigdecimal, hash-set, redacted).

## Signals

- `null` / `undefined` chains, `x?.y ?? z`, `=== null` checks on lookups that may be absent.
- Hand-built `{ ok: true, value } | { ok: false, error }` unions.
- Raw millisecond numbers (`5000`, `60 * 1000`) passed to timers, timeouts, or schedules.
- `new Date()`, `Date.now()`, `Date.parse` in Effect code.
- Floats used for money or exact decimals.
- `Set` / `Map` keyed by objects; `JSON.stringify` used as a key.
- Secrets typed as `string`.

## Idioms

- `Option` for absence: `fromNullishOr`, `match`, `getOrElse`, `map`, `flatMap`, `Option.gen`. `Result` for success-or-failure as a value: `Result.match`, `map`, `mapError`, `Result.gen`. Both are yieldable in `Effect.gen`.
- `Exit` is the full outcome of an Effect (`Exit.isSuccess`, `Exit.match`); `Cause` is the failure record with flat `reasons`.
- `Duration`: `Duration.seconds(5)` or string inputs like `"5 seconds"` wherever a duration is accepted; compare and add with the module.
- `DateTime` for instants and zones, `DateTime.now` reads the testable `Clock`. `DateTime.makeZoned` attaches an IANA zone.
- `Data.Class`, `Data.TaggedClass`, `Data.taggedEnum` give value equality and constructors; `Data.TaggedError` for errors.
- `HashSet` / `HashMap` (immutable) and `MutableHashSet` (hot loops) use `Equal` + `Hash`, so structurally equal keys collapse.
- `Chunk` for immutable sequences with cheap append/concat in stream code. `BigDecimal` for exact decimals. `Redacted` hides a secret from logs and `toString`.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Nullable return consumed with `if (x == null)` ladders | bypass | `Option` |
| Home-grown `{ ok }` union | bypass | `Result` |
| Raw ms number in a timeout or schedule | bypass | `Duration.seconds(...)` or a duration string |
| `Date.now()` / `new Date()` inside an Effect | bypass | `DateTime.now` / `Clock` |
| Object-keyed `Set` meaning structural identity | bypass | `Data.Class` values in a `HashSet` |
| `JSON.stringify` as a map key | bypass | `Data` value or `Hash` / `Equal` keys |
| Secret as `string` | leak | `Redacted` |
| Float money maths | leak | `BigDecimal`, or the project's branded integers |

## Project

Authoritative outcomes use branded safe integers and fixed-point maths, never `BigDecimal` or wall-clock `DateTime`. Restrict `DateTime`, `Clock`, and `BigDecimal` suggestions to edges. `Hash` is a 32-bit in-memory hash, not the canonical SHA-256; do not use it for authoritative hashing (see trait).
