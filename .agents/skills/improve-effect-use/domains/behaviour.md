# Behaviour

Docs: <https://effect.website/docs/v4/behaviour/order> and <https://effect.website/docs/v4/behaviour/equivalence>. Sources: `vendor/effect/src/Order.ts`, `Equivalence.ts`.

## Signals

- `.sort(` with an inline comparator, `a - b`, `a < b ? -1 : 1`, `localeCompare`.
- Several sorts that repeat the same key logic.
- `.sort()` with no comparator on numbers or mixed data.
- `min` / `max` / clamp written by hand; uniqueness by custom key (`filter` + `findIndex`, `Map` by projected key).

## Idioms

- `Order<A>` is a total ordering. Built-ins: `Order.String`, `Order.Number`, `Order.Boolean`, `Order.BigInt`, `Order.Date`.
- Derive: `Order.mapInput(base, (a) => a.key)`, `Order.combine` / `combineAll` for tie-breaks, `Order.Struct`, `Order.Tuple`, `Order.flip` for descending.
- Use: `Array.sort(order)` from the `Array` module, `Order.min` / `max` / `clamp` / `isBetween`, `isLessThan` and friends.
- `Equivalence<A>` is a pluggable "same thing" test: `Equivalence.mapInput`, `Struct`, `Tuple`, `Record`, `combine`; use it for dedupe by key (`Array.dedupeWith`).
- Export named orders so every call site sorts the same way.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Inline comparator repeated across files | bypass | One exported `Order` built with `mapInput` / `combine` |
| `localeCompare` for ordering | leak | `Order.String`; locale-dependent output breaks determinism |
| Comparator with no tie-break | leak | `Order.combine` on a stable second key so ties resolve identically everywhere |
| `.sort()` on numbers | leak | `Order.Number`; the default sort is lexicographic |
| Manual min/max/clamp | bypass | `Order.min`, `Order.max`, `Order.clamp` |
| Dedupe by hand-picked key | bypass | `Equivalence.mapInput` + `Array.dedupeWith` |

## Project

Ordering feeds authoritative hashes: collection order must be explicit and total, never insertion or filesystem order, and never locale-dependent. A fix that changes an iteration order can move a golden hash; route it through the Stop conditions.
