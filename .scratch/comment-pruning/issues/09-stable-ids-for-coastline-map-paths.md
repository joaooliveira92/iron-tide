# 09: Give coastline map paths stable ids so the array-index key resolves

**Type:** implementation

**What to build:** The map-prototype chart keys coastline paths by array index,
with the React key-rule suppressed because the paths carry no stable identity.
Give the paths a stable identifier derived from their data, key on it, and remove
the suppression.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Coastline paths are rendered with a key derived from stable data, not array index.
- [x] The array-index key suppression is removed.
- [x] The desktop renderer build and tests pass; rendered output is unchanged.

## Comments

`VariantCGraph.tsx` now maps each coastline path to `{ id, d }`, where `id` is
derived from the raw ring geometry (length + first vertex, independent of
projection/centre), keys the `<path>` on `id`, and the
`react/no-array-index-key` suppression is removed. `d` is unchanged, so rendered
output is identical.

Validated: `vp run -r build` exit 0; `vp lint .` 0 errors; desktop test suite
green (2053 passed | 1 skipped overall).
