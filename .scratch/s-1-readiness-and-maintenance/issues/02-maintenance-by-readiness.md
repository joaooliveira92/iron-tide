# 02: Maintenance is charged by readiness state

**What to build:** The monthly maintenance charge depends on each ship's readiness:
active at the base rate, reserve and mothballed cheaper, repair at about twice active.
A fixture month run with the same hull in each state debits the treasury by the
state's rate, and the ledger and events explain each charge. One shared formula backs
the phase, the opening briefing and the projection.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Each readiness state charges its ruleset multiplier applied to the existing
      base cost; the multipliers come from the ruleset, not literals in the phase.
- [ ] Mothballed reuses the existing half rule
      (`mothballedMaintenancePerMonthMicro` / `preservationCostBp`), not a new
      constant.
- [ ] Repair charges about 2× active; the ratio is asserted from a real month, not
      from the constant.
- [ ] The formula has a single source; the phase, `opening-briefing.ts` and
      `projection.ts` stay in parity (parity test).
- [ ] The maintenance phase keeps its declared footprint and passes the registry
      guard; the ledger stays balanced.
- [ ] Verifying against a fixture month, values are fixture-class until decision
      request 0007 resolves.
