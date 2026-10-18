# Re-pin table: the 1880 economy model (#138, ADR-0230)

Every value the economy model changes, with its unit, reason and effect on identity. Units are treasury units (TU, £10,000)
unless stated. Authored `income`, `expenses` and `treasury` do **not** change; only derived and runtime values move.

| Value | Before | After | Unit | Reason | Identity effect |
| --- | --- | --- | --- | --- | --- |
| `baseResources` | 0 for every nation | `ceil(income × 120000 / 2000)` = 60 × income | TU a year | the compiler credited no revenue, so all 14 treasuries emptied | none: `income` is the same authored figure |
| Monthly revenue | 0 | `floor(base × rate / 120000)` = `income` at the start rate | TU a month | the authored appropriation is now credited | none |
| `researchBudget` (runtime) | the authored annual figure, paid once and against a stub catalogue | `floor(annual / 12)`, a standing monthly spend | TU a month | the annual allocation is paid monthly; the stub catalogue is replaced | research share 5.0–11.1% of annual appropriation is unchanged |
| `standingResearchBudget` | unset | the monthly spend | TU a month | seeds the standing budget | none |
| `annualResearchAllocation` | not kept | the authored annual figure | TU a year | display only | none |
| Research catalogue | six stub technologies | the pack's 84 technologies in `world.technologies` | n/a | paid research now advances real technologies | none |
| Construction cap | `floor(floor(base / 12) / 100)` | deleted | TU a month | accidental; zero for every nation before this change | none |
| Seeded project throughput | single figure, unbounded by any yard | packages and `capacityUnits` from the historical build time | TU a month a line | capacity comes from ship-building content | none |
| Compatibility version | 3.0.0 | 3.1.0 | n/a | authoritative outcomes move | n/a |

## Start state by nation

| Nation | Income | Obligations | Treasury | Base | Annual research | Monthly research | Research cap | Net before construction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| austria_hungary | 22 | 9 | 240 | 1320 | 20 | 1 | 2 | 6 |
| brazil | 5 | 2 | 60 | 300 | 4 | 0 | 0 | 2 |
| france | 68 | 26 | 700 | 4080 | 55 | 4 | 8 | 26 |
| germany | 30 | 12 | 320 | 1800 | 30 | 2 | 3 | 10 |
| italy | 38 | 14 | 400 | 2280 | 30 | 2 | 4 | 13 |
| japan | 12 | 5 | 130 | 720 | 10 | 0 | 1 | 5 |
| netherlands | 7 | 3 | 80 | 420 | 6 | 0 | 0 | 0 |
| ottoman_empire | 16 | 7 | 180 | 960 | 12 | 1 | 1 | 5 |
| portugal | 3 | 2 | 40 | 180 | 4 | 0 | 0 | -1 |
| qing | 9 | 4 | 100 | 540 | 8 | 0 | 1 | 1 |
| russia | 55 | 21 | 550 | 3300 | 40 | 3 | 6 | 23 |
| spain | 16 | 7 | 180 | 960 | 12 | 1 | 1 | 5 |
| uk | 100 | 38 | 1000 | 6000 | 60 | 5 | 12 | 41 |
| usa | 26 | 10 | 280 | 1560 | 20 | 1 | 3 | 13 |

Japan, the Netherlands, Portugal, Qing and Brazil derive zero monthly research: their annual allocation is under 12 TU, below
the one-TU monthly resolution (`RESEARCH_BELOW_RESOLUTION`, informational). Only Portugal starts in structural deficit.

## Owner candidates (flagged, not applied)

Sourced income that differs from the authored figure (Italy, Russia, Germany, Japan), and the duplicated Spain and Ottoman
Empire rows, are balance questions for the owner. This change applies none of them (spec #138, Out of Scope).

## Golden hashes

`golden/hashes.json` moved with an understood cause: the compiled start state carries a derived base, the research catalogue and
compatibility 3.1.0; construction is no longer capped by the base; outflow ledger entries record requested and shortfall. The old
and new values are in the commit body that re-pinned them.
