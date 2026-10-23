# Trait

Docs: <https://effect.website/docs/v4/trait/equal> and <https://effect.website/docs/v4/trait/hash>. Sources: `vendor/effect/src/Equal.ts`, `Hash.ts`.

## Signals

- Hand-written `equals(a, b)`, `deepEqual`, `isEqual`, or `hashCode` helpers.
- `JSON.stringify(a) === JSON.stringify(b)`.
- `Set<object>` or `Map<object, _>` where the intent is structural identity.
- `[Equal.symbol]`, `[Hash.symbol]` implementations.
- Objects mutated after they became keys of a `HashSet` / `HashMap`.

## Idioms

- `Equal.equals(a, b)` compares structurally for `Data` values, `HashSet`, `HashMap`, `Option`, `Result`, and any class implementing the trait; plain objects compare by reference unless wrapped or opted in.
- Implementing the trait takes both halves: `[Equal.symbol](that)` and `[Hash.symbol]()`. Equal values must produce equal hashes; hash the same fields equality reads.
- `Data.Class` / `Data.TaggedClass` / `Schema.Class` derive both.
- Opt a class into reference equality explicitly when identity is the intent.
- Keys of hash-based collections stay immutable.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Hand-rolled deep equality or hash | bypass | `Data.Class` or the `Equal` / `Hash` traits |
| `JSON.stringify` comparison | bypass | `Equal.equals` on `Data` values |
| `Set<object>` meant structurally | bypass | `HashSet` of `Data` values |
| `Equal` implemented without `Hash` (or fields differ) | leak | Hash the same fields as equality |
| Mutable object used as a hash key | leak | Immutable value |

## Project

`Hash` and `Equal` give in-memory structural identity only. Authoritative hashes use the versioned canonical serializer and SHA-256 with domain-separated envelopes. A candidate that routes authoritative hashing or ordering through `Hash` is a determinism bug, not a gap.
