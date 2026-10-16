# 03: One money type and every authoritative money field branded

**What to build:** One branded fixed-precision money type in treasury units, and
every authoritative money/ratio field branded with it or the basis-point type.
The currently-unbranded `number` fields — foreign-contract price, amount and
per-unit work; design-study costs and discount basis points; base-resource
amounts — are promoted. The single micro→unit bridge declares its rounding mode
and stays the only micro→unit rounding point. Value-preserving: same integers
stored.

**Blocked by:** 01 (the canonical units module).

**Status:** ready-for-agent

- [ ] A single canonical money type exists (integer treasury units, map D3); the
      ship-design cost model's micro brands reach it only through the one bridge.
- [ ] Every authoritative money/ratio field is branded; a plain `number` where
      money is expected fails typecheck.
- [ ] The micro→unit bridge (`treasuryCostUnits` against `treasuryUnitMicro`)
      declares its `RoundingMode`; no double-round occurs across the
      design→campaign boundary.
- [ ] A test proves the bridge rounds once at its declared mode and rejects a
      non-integer at construction.
- [ ] Value-preserving: stored integers unchanged; the cross-process child run is
      byte-identical before and after.
