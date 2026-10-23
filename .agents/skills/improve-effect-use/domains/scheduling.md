# Scheduling

Docs: <https://effect.website/docs/v4/scheduling/using-schedules>, `choosing-and-combining-schedules`, `cron`, `cookbook`.

## Signals

- `setInterval`, `setTimeout` loops, `while (true)` with `sleep`, manual attempt counters, hand-written backoff arithmetic.
- `Effect.retry`, `Effect.repeat`, `Effect.schedule`, `Schedule.`.
- Cron-like logic built from `Date`.

## Idioms

- Choose the runner by trigger: `Effect.repeat` after success, `Effect.schedule` when the first run must also wait, `Effect.retry` after failure. The action runs once before a repeat/retry schedule is consulted.
- Starting rule: `Schedule.recurs(n)` (limit), `spaced(d)` (wait after each run), `fixed(d)` (aligned cadence), `exponential(base)`, `fibonacci`, `cron(expr, tz)`, `forever`.
- Adjust one schedule: `upTo({ times, duration })`, `modifyDelay`, `jittered`, `addDelay`, `tap`, `passthrough`, `map`.
- Combine: `max` (every rule, longest delay), `min` (any rule, shortest delay), `concat` (phases).
- Shortcuts on the runner: `repeat`/`retry` accept `times`, `while`, `until`.
- Server-directed delay (`Retry-After`, poll interval): carry the duration in the error or value and read it in `Schedule.modifyDelay`.
- A deadline for the whole operation wraps the retrying effect in `Effect.timeout`; `Schedule.upTo({ duration })` only gates the next retry.
- Schedules live only while the process runs; they do not recover missed runs.
- Cron: `Cron.parse` returns a `Result`; pass a named IANA zone or `UTC`, never the server's local zone.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Timer loop with counter and delay math | bypass | `Effect.retry` / `repeat` with a `Schedule` |
| Retry with fixed delay and no jitter against a shared service | bypass | `Schedule.exponential` plus `jittered` |
| Retry of every error, permanent ones included | leak | `while` on a retryable tag, or `catchTag` first |
| `setInterval` polling | bypass | `Effect.repeat(Schedule.spaced(...))` in a scoped fiber |
| Retry and timeout stacked in the wrong order | leak | Place `timeout` after `retry` for a whole-operation budget |
| Cron math from `Date` | bypass | `Schedule.cron` with an explicit time zone |
| Tests that sleep real time to see a schedule fire | bypass | `TestClock` (see testing) |

## Project

Repetition in authoritative code is driven by game ticks, not wall-clock schedules. Schedule gaps belong at edges.
