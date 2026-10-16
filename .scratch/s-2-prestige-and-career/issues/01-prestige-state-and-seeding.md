# 01: Prestige state, authored seeding and compile-boundary validation

**What to build:** Every nation in a compiled campaign carries a prestige value
that was authored in content. A fixture pack with authored starting prestige
compiles, the snapshot holds the value for each nation, a save round-trips it,
and content with a missing or out-of-range value is rejected at the boundary
with a stable diagnostic. Introduces the compatibility-version bump (map D2).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A compiled fixture campaign exposes a bounded integer prestige for every
      nation, equal to the authored value.
- [ ] Missing, non-integer, unsafe-integer, out-of-range and excess-key prestige
      content fails compilation with a `_tag`-discriminated diagnostic.
- [ ] Save and load restore prestige exactly; a save from the previous
      compatibility version is refused before decode.
- [ ] Two cross-process compiles of the same fixture are byte-identical.
- [ ] Production 1880 content is untouched (values arrive in ticket 08); the fixture
      is classified as fixture, never production.
