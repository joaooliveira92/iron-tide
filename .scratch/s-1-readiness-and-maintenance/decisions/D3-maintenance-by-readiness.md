# D3: Maintenance by readiness

**Type:** grilling · **Status:** resolved

## Question

How is maintenance charged by readiness state?

## Answer

The existing `maintenance` phase (`packages/phase-engine/src/registry.ts` order 4,
`runMaintenancePhase` in `packages/phase-engine/src/economyPhases.ts`) is extended:
each ship's base cost (`computeMaintenanceCost`, today `floor(hitPoints * 10 / 100)`)
is multiplied by its readiness state's ruleset multiplier.

- Repair uses the manual's **~2× active** maintenance (p.51).
- Mothballed reuses the existing half rule already in content
  (`mothballedMaintenancePerMonthMicro` / `preservationCostBp: 5000`, p.30), rather
  than a second constant.
- Reserve and active multipliers, and the wartime multiplier (D6), are values the
  manual omits → decision request 0007; fixture-class ruleset constants until then.

The formula is produced by one shared function so its three current copies
(`economyPhases.ts`, `packages/campaign-engine/src/opening-briefing.ts`,
`.../projection.ts`) stay in parity.

## Why

The phase already charges and ledgers maintenance, so multiplying the existing base
by status is the manual's stated trade — readiness "will affect their maintenance
costs, but also their readiness for war" (p.51) — and adds no second charging path.
Keeping status out of the money phase would duplicate the ledger.
