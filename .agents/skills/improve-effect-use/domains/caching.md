# Caching

Docs: <https://effect.website/docs/v4/caching/cache> and <https://effect.website/docs/v4/caching/caching-effects>.

## Signals

- `new Map`, `WeakMap`, or a plain object used as a memo, keyed by input.
- A cached `Promise` stored in a variable; a `ready` / `loaded` flag guarding an async load.
- `Effect.cached`, `cachedWithTTL`, `cachedInvalidateWithTTL`, `Cache.`, `ScopedCache`.
- Manual expiry arithmetic with timestamps.

## Idioms

- `Cache.make({ capacity, timeToLive, lookup })` then `Cache.get(cache, key)`. Concurrent lookups for one key compute once; the rest wait.
- Failures are cached; an interrupted lookup removes the key so the next call retries.
- `Cache.makeWith(lookup, { capacity, timeToLive(exit, key) })` chooses a TTL per outcome. Inspect with `size`, `keys`, `entries`, `has`; evict with `invalidate`, `invalidateAll`; recompute while serving the old value with `refresh`.
- Memoize a function: a `Cache` whose lookup is that function.
- A single value: `Effect.cached(task)` runs at most once and shares the outcome, including failure and interruption. `cachedWithTTL` expires it; `cachedInvalidateWithTTL` also returns an invalidation effect. Each `Effect.cached` call makes an independent cache, so create it once and reuse it.
- `ScopedCache` caches values whose lookup is scoped (resources released on eviction).

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `Map` memo around an async function | bypass | `Cache.make` with that function as `lookup` |
| Two concurrent callers both computing the same value | leak | `Cache.get` computes once |
| Memo with no capacity or TTL | leak | Set `capacity` and `timeToLive` |
| `Effect.cached(...)` inside the function it should protect | leak | Create the cached effect once, outside |
| Cached resource evicted but never released | leak | `ScopedCache` |
| `Effect.cachedFunction` | drift | `Cache.make` |
| Failure cached that should retry | leak | `timeToLive(exit)` short for failures, or `Cache.invalidate` |

## Project

A cache over authoritative computation can hide nondeterminism and mask a golden-hash change. Cache IO results; leave pure calculations to be recomputed, or memoise them with an ADR.
