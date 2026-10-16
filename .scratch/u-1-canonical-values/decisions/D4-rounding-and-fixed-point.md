# D4: Rounding and fixed-point

**Type:** grilling · **Status:** resolved

## Question

What rounding vocabulary and helpers do authoritative formulas use, and how is
"no implicit float" enforced?

## Answer

- **One rounding vocabulary** is already in `packages/contracts`
  (`RoundingMode`: `trunc | floor | ceil | halfUp | halfDown | halfEven`, used by
  `SafeInt.div`/`roundToInt`). U-1 keeps it as the single source and **rejects any
  second rounding enum**.
- **Every authoritative formula declares its mode.** Multi-step ratio maths
  follows the existing pattern: compose exactly (bigint) and **round once** at the
  end — `packages/armament/src/arithmetic.ts` (`scaleByBp`, bigint exact, single
  round) and `packages/ship-design/src/units.ts` (`mulBp`) are the models.
- **Checked helpers** are exposed from the canonical units module (D2): checked
  add/sub/mul/div, `ceilDiv`, `toSafe`, and a checked "reject non-integer / unsafe
  integer at construction" boundary. Helpers throw typed unit errors
  (`UnitError` `_tag`), never return `NaN`/`Infinity`.
- **No implicit float in authoritative packages.** The existing
  `assertNoFloats` persistence guard (`packages/ship-design/src/persistence.ts`,
  `FLOAT_IN_STATE`) stays; U-1 adds an **authoritative-package float gate** —
  either tightened `scripts/assert-authoritative-determinism.mjs` or a dedicated
  lint rule — that fails on float arithmetic (`.0` literals, `Math.*`, non-exact
  `/`) in `packages/*` authoritative scopes, mirroring how the boundary-decode
  gate works. The exact mechanism is settled at implementation.
- **Largest-remainder apportionment** (`splitLargestRemainder`,
  `scalePlanToUnits`/`capacityInUnits`) is the sanctioned way to split an integer
  total without drift; it is registered as such, not reinvented per site.

## Why

The recon found at least a dozen ad-hoc `Math.floor`/`Math.round` sites and two
float paths into hashed outcomes. A single vocabulary plus a single rounding
point per formula is what makes replay and cross-process hashes reproducible
(BW-DET-001/003); a second enum or a per-site ad-hoc round is the failure mode
this decision closes.

## Gating

Adding helpers and the gate is value-preserving where it does not change a
formula's result. Changing a formula's rounding changes its output and is gated
by 0005 (D7).
