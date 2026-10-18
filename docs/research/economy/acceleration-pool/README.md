# Acceleration-pressure pool: spike (#138 slice 4, G3 [U])

Question: DESIGN-13 section 11.3.3 divides the weighted construction demand by an `availableCapacity` in treasury units a
month. The old value was `floor(floor(baseResources / 12) / 100)`, the accidental `/1200` divisor (zero for every production
nation before #138, so the check was always saturated). G3 recommended replacing it with the per-line capacity of the yard
that fits the dock-size reference hull, priced by the cost model, times `shipyardCapacityMultipleBp / 10000`.

Method: `spike.mjs` (this directory) compiles the shipped 1880 pack. For each nation it takes the largest starter design that
fits the nation's dock, prices it with the cost model, plans it, picks the yard with `chooseYard`, converts that yard's per-line
capacity to treasury units with `capacityInUnits`, and multiplies by the balance's `shipyardCapacityMultipleBp` (30000 = 3x).
Output: `pool.json`.

| nation | dock t | reference hull | t | cost TU | yard | TU/month (all lines) | candidate pool TU/month |
|---|---:|---|---:|---:|---|---:|---:|
| austria_hungary | 8000 | starter_ca_austria_hungary_1880 | 4864 | 35 | yard_medium | 6 | 18 |
| brazil | 5000 | starter_ca_brazil_1880 | 4864 | 35 | yard_medium | 6 | 18 |
| france | 12000 | redoutable_1878 | 8382 | 63 | yard_large | 6 | 18 |
| germany | 9000 | sachsen_1878 | 7589 | 51 | yard_large | 6 | 18 |
| italy | 14000 | principe_amedeo_1874 | 5207 | 35 | yard_medium | 6 | 18 |
| japan | 5000 | starter_ca_japan_1880 | 4864 | 35 | yard_medium | 6 | 18 |
| netherlands | 5000 | starter_ca_netherlands_1880 | 4864 | 35 | yard_medium | 6 | 18 |
| ottoman_empire | 9000 | mesudiye_1875 | 7052 | 50 | yard_large | 6 | 18 |
| portugal | 5000 | starter_ca_portugal_1880 | 4864 | 35 | yard_medium | 6 | 18 |
| qing | 10000 | starter_b_qing_1880 | 9377 | 64 | yard_large | 6 | 18 |
| russia | 11000 | petr_velikiy_1876 | 9248 | 57 | yard_large | 6 | 18 |
| spain | 8000 | numancia_1864 | 5439 | 33 | yard_medium | 6 | 18 |
| uk | 13000 | alexandra_1877 | 9377 | 64 | yard_large | 6 | 18 |
| usa | 5000 | starter_ca_usa_1880 | 4864 | 35 | yard_medium | 6 | 18 |

## Finding

The candidate definition carries **no national information**: every nation lands on 6 TU a month and a pool of 18. The
conversion `capacityInUnits` scales a yard's micro-work capacity by `totalUnits / plan.totalWork` of the *same* reference hull, so
the reference ship always takes the yard's historical pace whatever its size, cost or yard. The result is a property of the
method, not of the nations. A pool that is 18 for the United Kingdom and for Portugal would also make the pressure check depend
on how many projects a nation runs, not on how much yard it owns.

## Decision

The numeric pool stays **out of scope** (spec #138, Out of Scope) and the engine keeps it explicit and inert:
`ACCELERATION_POOL_UNDEFINED_UNITS = 0` in `packages/phase-engine/src/economyPhases.ts`, which reproduces the previous always-
saturated behaviour without reading the economic base. Acceptance assertions must not depend on acceleration pressure.

A usable definition needs a work-to-treasury-unit conversion that is not relative to one reference project, for example a
national price of one micro-work unit derived from the cost model (`componentCostPerWorkMicro`, `treasuryUnitMicro`) applied to
the yard's absolute capacity in micro-work, and owned by the budget-pressure work. Re-run this spike against that definition
before pinning anything.
