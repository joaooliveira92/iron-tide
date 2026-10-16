# 06: Single parse-once input path, ad-hoc-formatting gate, and domain-leak removal

**What to build:** One parse-once input path that turns user-entered display
values into canonical values, a standing source gate that keeps ad-hoc formatting
and unit conversion out of components, and removal of the domain packages that
still build display strings — so the presentation boundary cannot erode.

**Blocked by:** 01, 02, 03.

**Status:** done

- [x] Every user-entered measurement, money or number value is parsed once by the
      module's parsers into a canonical branded value; downstream code never
      re-parses a formatted string; a round-trip test proves no double conversion.
- [x] A component-scoped source gate fails on ad-hoc
      `Intl`/`toLocaleString`/`toLocaleDateString`/`toFixed`, a hard-coded currency
      symbol or unit suffix, or an ad-hoc unit conversion outside the single
      module; it is proven by a self-test fixture (violating fixture fails, clean
      tree passes).
- [x] The remaining domain-formatting leak ADR-0218 deferred — human-readable
      string building in `packages/ship-design/src/` and
      `packages/phase-engine/src/reviseProject.ts` — is removed or relocated, and
      a source guard keeps it out (following the `priorities.test.ts` precedent).
- [x] No authoritative package builds presentation text or performs display-unit
      conversion after this ticket.
- [x] The gate is wired into `pnpm preflight` and adds no material runtime cost.
