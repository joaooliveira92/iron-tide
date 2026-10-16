# D6: Single parse-once input path and the ad-hoc-formatting gate

**Type:** grilling · **Status:** resolved

## Question

How do user-entered values become canonical, and how is the formatting boundary
kept from eroding?

## Answer

- **Single parse-once input path.** Every user-entered measurement, money or
  number is parsed exactly once by the module's parsers into a canonical branded
  value (using the canonical table's constructors); downstream code never
  re-parses a formatted string. Authors may enter values in the display
  preset/units; parsing converts once at the boundary, mirroring the compiler's
  one authoring→canonical conversion (ADR-0218).
- **Component-scoped gate.** A standing lint/source gate fails when a component
  (or any module outside the single conversion module) calls
  `Intl`/`toLocaleString`/`toLocaleDateString`/`toFixed`, hard-codes a currency
  symbol or unit suffix, or performs an ad-hoc `/1000`-style unit conversion —
  the gate ADR-0218 deferred to U-3. The gate is proven by a self-test fixture
  (a violating fixture fails, a clean tree passes), like the existing determinism
  and boundary gates.
- **Domain-formatting-leak removal.** The remaining display-formatting sweep
  ADR-0218 deferred — human-readable string building in `packages/ship-design/src/`
  and `packages/phase-engine/src/reviseProject.ts` — is removed or relocated so
  that **no authoritative package owns presentation text** (the `priorities.ts`
  guard is the precedent).

## Why

ADR-0218 fixes that conversion happens only at the presentation boundary and
explicitly defers the component gate, the sweep, and the module home to U-3. A
parse-once path prevents double-rounding and drift; a source gate stops the
boundary decaying back into scattered `Intl`/`toFixed` calls; removing the
domain leak satisfies BW-RUL-001 (localized text never controls mechanics) and the
canonical-design pillar that no authoritative package formats for display.
