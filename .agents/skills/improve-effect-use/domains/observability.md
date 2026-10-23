# Observability

Docs: <https://effect.website/docs/v4/observability/logging>, `metrics`, `tracing`, `tracking-fibers`. Exporters: `vendor/effect/src/observability` (`Otlp*`, `PrometheusMetrics`) and `vendor/effect/ai-docs/src/08_observability`.

## Signals

- `console.log`, `console.error`, `console.warn` in library code.
- `Effect.log*`, `Effect.annotateLogs`, `Effect.withLogSpan`, `Effect.withSpan`, `Effect.fn("`, `Logger.`, `Metric.`.
- Counters kept in `let` or `Ref` for reporting.
- A `catch` that records nothing, or a `tapError` that formats a string by hand.
- Absence: services with no spans, no logs on failure paths.

## Idioms

- Log through `Effect.log`, `logDebug`, `logInfo`, `logWarning`, `logError`, `logFatal`. Attach structure with `Effect.annotateLogs` (scoped to the wrapped effect) and `withLogSpan`.
- Set the level with `References.MinimumLogLevel`; load it from `Config` and provide it as a layer. Swap or combine sinks with `Logger.layer`, `Logger.make`, `Logger.consolePretty`, `consoleJson`, `consoleLogFmt`, `tracerLogger`.
- A span per service operation: `Effect.fn("Service.method")` creates one, `Effect.withSpan` wraps an existing effect, `Effect.annotateCurrentSpan` adds attributes.
- Metrics: `Metric.counter`, `gauge`, `histogram`, `timer`, `summary`, `frequency`; attach attributes with `Metric.withAttributes`; read with `Metric.value`.
- Export with the `Otlp*` modules in new code. Track long-lived fibers with `FiberSet` / `FiberMap`.
- Secrets reach logs only as `Redacted` values.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `console.*` in a library | bypass | `Effect.log*`; the `assert-no-library-console` gate already blocks new ones |
| Message built by string interpolation | bypass | Fixed message plus `annotateLogs` fields |
| Failure path with no log or span event | leak | `tapError` / `tapCause` that logs once at the owner |
| Hand-counted totals in a `Ref` | bypass | `Metric.counter` / `gauge` |
| Service operations without spans | bypass | `Effect.fn("name")` |
| Log level read from `process.env` in code | bypass | `Config` feeding `References.MinimumLogLevel` at the edge |
| Same error logged at every layer it crosses | bypass | Log once where it is handled |

## Project

Logs, spans, and metrics read the clock. Keep them out of authoritative packages; they belong at edges, and the determinism gates (`assert-authoritative-determinism`) apply.
