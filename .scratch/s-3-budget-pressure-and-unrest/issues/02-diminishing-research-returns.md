# 02: Diminishing research returns above 10%

**What to build:** Research points produced per unit spent fall once the share exceeds
10% of the naval budget (manual p.16), through a curve held as a ruleset constant. A
campaign month at 11% yields more than at 10% but less than proportionally.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] At or below 10% production is linear; above it, the marginal yield is strictly
      lower, monotonic, and never negative.
- [ ] The curve parameters are ruleset constants supplied by the fixture ruleset, with
      provenance noted; production values arrive in ticket 14.
- [ ] Integer or fixed-point arithmetic with documented rounding; no float.
- [ ] Observed in a compiled campaign month through research progress.
- [ ] Reference-run change follows the golden re-pin path (no silent hash movement).
