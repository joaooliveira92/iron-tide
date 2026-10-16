# 06: Readiness gates battle eligibility

**What to build:** Battle generation reads each ship's real readiness and crew
quality instead of the hard-coded constants. Working-up ships are excluded, reserve
and mothballed ships sit out ordinary battles, and low-readiness ships fall below the
existing floor — each with its reason code.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] The campaign battle phase supplies authoritative readiness and crew quality to
      `generateBattles`, replacing `resolveReadiness: () => 80` and the neutral crew
      input.
- [ ] `gatherEligibleAssets` keys `SHIP_WORKING_UP_BATTLE_INELIGIBLE` off the real
      `WORKING_UP` state, not `isUnderConstruction`.
- [ ] Reserve and mothballed ships are excluded from ordinary battles; the surprise
      attack exception (p.69) is a named, tested seam, not silently modelled.
- [ ] Readiness below the ruleset floor keeps the existing `FUEL_BATTLE_INELIGIBLE`
      path.
- [ ] Gathering consumes no randomness; a fixture battle manifest is byte-identical
      across two processes.
