# D3: Money representation

**Type:** grilling · **Status:** resolved

## Question

What is the single fixed-precision money representation, and how do the two
current representations (branded `SafeInt` treasury units and
`BudgetMicro`/`WorkMicro` design-cost micro-units) reconcile?

## Answer

One canonical money type, a **branded safe integer at a declared scale**, and one
bridge between the two tiers that already exist:

- **Canonical money** is an integer in **treasury units** — the existing
  authoritative convention (`NationState` treasury/income/expenses,
  `LedgerTransaction`, `NationBudgetChanged`), honoured at display as one unit =
  GBP 10,000 (`content/production/1880/ship-building/balance.yaml:778-780`).
- **Sub-unit money** for the ship-design cost model stays the existing
  `BudgetMicro`/`WorkMicro` brands (`BP_ONE = 10_000`); it is bounded,
  integer-only, and never crosses into campaign state except through the single
  bridge.
- **The bridge** `treasuryCostUnits` (`packages/phase-engine/src/designVersion.ts`,
  using `pricing.treasuryUnitMicro = 10^10`) is the **one rounding point** for
  micro→unit conversion; it declares its `RoundingMode`.
- **Every authoritative money field is branded.** The audit's unbranded
  `number` fields — foreign-contract `totalPriceUnits`/`amountUnits`/
  `totalWorkPerUnit`, `DesignStudy` costs/`discountBp`, `BaseResources.amountUnits`
  (`packages/campaign/src/state.ts`) — are promoted to the money/ratio brands.

Because treasury units are stored as integers today, **branding alone is
value-preserving** and does not move the reference run. No scale change is
proposed: canonical money stays treasury units; micro is an internal cost-model
detail. (A scale change would be a separate, 0005-gated decision.)

## Why

Two money representations with no single type is the risk the recon found: an
authoritative field can silently be a float or be double-rounded. Fixing one
type, one scale and one bridge satisfies ADR-0202's "fixed-precision monetary
representation" and the ENGINEERING-CONTRACT arithmetic rule (branded safe
integers, explicit rounding, reject non-integers at construction).

## Gating

Promoting unbranded fields to brands (D2/D3) is value-preserving and can start
now. Any ticket that changes a stored value, scale or rounding is gated by 0005
(D7).
