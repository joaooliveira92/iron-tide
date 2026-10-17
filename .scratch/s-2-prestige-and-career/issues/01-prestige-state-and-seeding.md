# 01: Prestige state, authored seeding and compile-boundary validation

**What to build:** Every nation in a compiled campaign carries a prestige value
that was authored in content. A fixture pack with authored starting prestige
compiles, the snapshot holds the value for each nation, a save round-trips it,
and content with a missing or out-of-range value is rejected at the boundary
with a stable diagnostic. Introduces the compatibility-version bump (map D2).

**Blocked by:** None (can start immediately).

**Status:** blocked

Decision request **0006** resolved (2026-10-17, Option B): keep
`NationState.prestige` required (D2 in force, no engine default), and gate S-2 on
decision request **0003**. This ticket stays blocked until the 0003 research
produces adequately sourced production values (ADR-0225). Do not make prestige
optional/defaulted and do not author a placeholder or fixture-class prestige value
into production.

- [ ] A compiled fixture campaign exposes a bounded integer prestige for every
      nation, equal to the authored value.
- [ ] Missing, non-integer, unsafe-integer, out-of-range and excess-key prestige
      content fails compilation with a `_tag`-discriminated diagnostic.
- [ ] Save and load restore prestige exactly; a save from the previous
      compatibility version is refused before decode.
- [ ] Two cross-process compiles of the same fixture are byte-identical.
- [ ] Production 1880 content is untouched (values arrive in ticket 08); the fixture
      is classified as fixture, never production.
