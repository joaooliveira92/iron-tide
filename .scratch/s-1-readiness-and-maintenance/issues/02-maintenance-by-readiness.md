# 02: Maintenance is charged by readiness state

**What to build:** The monthly maintenance charge depends on each ship's readiness:
active at the base rate, reserve and mothballed cheaper, repair at about twice active.
A fixture month run with the same hull in each state debits the treasury by the
state's rate, and the ledger and events explain each charge. One shared formula backs
the phase, the opening briefing and the projection.

**Blocked by:** 01

**Status:** done

- [x] Each readiness state charges its ruleset multiplier applied to the existing
      base cost; the multipliers come from the ruleset, not literals in the phase.
- [x] Mothballed is the existing half rule (5000 bp, manual p.30), held as the
      centralized `MAINTENANCE_MOTHBALLED_MULTIPLIER_BP` (ADR-0223 / 0007-A
      centralized every value; the maintenance phase has no per-nation
      `ConstructionBalance`, so the half is the shared constant).
- [x] Repair charges about 2× active; the ratio is asserted from a real month, not
      from the constant.
- [x] The formula has a single source (`@bluewave/campaign` `shipMaintenanceCost`);
      the phase consumes it and `opening-briefing.ts` / `projection.ts` re-export
      it (parity test).
- [x] The maintenance phase keeps its declared footprint and passes the registry
      guard; the ledger stays balanced.
- [x] Values are the centralized ruleset constants under 0007-A (resolved), not
      fixture-class placeholders: grounded (repair ×2, mothball half) or labelled
      `balance_adjustment` (reserve, working-up).

Evidence: `packages/campaign/src/maintenance.ts`;
`packages/phase-engine/test/economy.test.ts` C2b (ACTIVE 10 + RESERVE 7 +
MOTHBALLED 5 + REPAIR 20 = 42); `packages/campaign/test/maintenance.test.ts`.
Golden-neutral (`Golden-Repin: not-needed`).
