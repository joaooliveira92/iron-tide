# Testing

Docs: <https://effect.website/docs/v4/testing/testclock>. Examples: `vendor/effect/ai-docs/src/09_testing`. Sources: `vendor/effect/src/testing` (`TestClock`, `TestConsole`, `TestSchema`).

## Signals

- `setTimeout`, real `sleep`, `Date.now()`, `vi.useFakeTimers` in tests.
- `vi.mock` of modules that a service wraps.
- `Effect.runPromise` / `runSync` in a test body; tests that `await` an Effect by hand.
- Test setup building the full app graph for one service.
- `expect(...).rejects.toThrow(` on an Effect-based API.
- Which harness the package uses (`vite-plus/test`, `@effect/vitest`'s `it.effect`).

## Idioms

- `TestClock` only moves when told: `TestClock.adjust(duration)`, `TestClock.setTime`. Fork the effect that sleeps, adjust the clock, then join or assert. Provide it with `TestClock.layer`.
- `it.effect` (from `@effect/vitest`) runs a test body as an Effect with `TestClock` and test services installed; `it.live` uses the real clock. Use whichever harness the package already imports.
- Test a service by providing a small layer with `Layer.succeed(Service, Service.of({...}))` or `Layer.mock`; shared layer tests use `it.layer`.
- Config: `ConfigProvider.fromUnknown`. Time: `Clock` and `TestClock`, never `Date`. Console output: `TestConsole`.
- Assert outcomes with `Effect.exit` or `Effect.result` and discriminate failures by `_tag`.
- Generate inputs from schemas with `Arbitrary.schema(schema)` for property tests.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Real sleep or wall-clock wait in a test | bypass | `TestClock.adjust` after forking the sleeper |
| `vi.mock` of a module a service wraps | bypass | Provide a test layer for the service |
| Test reaches the real filesystem or network for one service | bypass | `FileSystem` / service layer double |
| `try`/`catch` or `toThrow` over an Effect failure | bypass | `Effect.exit` / `Effect.result`, assert on `_tag` |
| Hand-written arbitrary data duplicating a schema | bypass | `Arbitrary.schema(schema)` |
| Test mutates `process.env` | bypass | `ConfigProvider.fromUnknown` layer |
| Whole real graph per test | bypass | Minimal layer; one `it.layer` for shared setup |

## Project

AGENTS.md: tests run on `vite-plus/test`, exercise production composition, and replace only true external boundaries; no sleeps as synchronization, no tests whose runtime depends on wall-clock time. A bug needs a regression test that fails first (red) before the fix.
