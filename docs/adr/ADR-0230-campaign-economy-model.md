# ADR-0230: Campaign economy model — one appropriation, one ledger, one set of calculators

## Status

Accepted (2026-10-18). Records the locked model of the wayfinder map
[#123](https://github.com/joaooliveira92/iron-tide/issues/123) (decisions G1–G9,
tickets #124–#137) and the spec [#138](https://github.com/joaooliveira92/iron-tide/issues/138).
Supersedes [decision request 0014](../../.ai/decision-requests/0014-n-3-ten-year-run-treasury-baseline.md)
(Option A, the insolvency allowlist) and absorbs
[#95](https://github.com/joaooliveira92/iron-tide/issues/95) (Option C).

## Context

The player-facing budget, the content compiler and the month executor were three
disagreeing economies. The compiler set every nation's economic base to zero, so no
treasury ever received revenue and all fourteen nations ran out of money inside two
years. The authored monthly appropriation was shown on screen and never credited.
The projection left out fixed obligations and treated cumulative construction
payments as monthly. Authored research was charged on screen and never paid, because
the research phase resolved six stub technologies instead of the pack catalogue. The
construction limit was an accidental treasury divisor (`floor(floor(base / 12) / 100)`)
that was zero for every nation and ignored the sourced dock and yard data. A
nation-name allowlist and a "the decade is insolvent" tolerance hid all of it in the
gates. Golden hashes prove determinism, not correctness.

## Decision

### 1. Terms and units

One treasury unit (TU) is £10,000 (ADR-0216). "Budget" is retired as a bare word;
see `packages/campaign/GLOSSARY.md`. Authored `income` is the **monthly gross naval
appropriation** at the 2000 bp start rate; `expenses` are **fixed monthly
obligations**.

### 2. Classification of every value

| Class | Values |
| --- | --- |
| Authored balance input | `income`, `expenses`, `treasury`, the annual `researchBudget`, dock sizes, national multipliers |
| Derived start state | `baseResources`, the monthly research spend, the `standingResearchBudget` seed, seeded-project packages and `capacityUnits`, the research catalogue |
| Runtime stock | treasury, `baseResources` |
| Runtime flow | revenue, obligation, maintenance, research, construction draw, preservation |
| Configuration | start rate 2000 bp, rate range 500–5000 bp, research cap 1200 bp, research conversion 10000 bp, `shipyardCapacityMultipleBp` |
| Extension point (no value yet) | annual growth (300–500 bp band), volatility, colony income, start-rate override, a base/rate split |
| Display only | the projection fields, descriptive identity enums |

### 3. Equations (integer only, one rounding point each)

- Base (once, at compile): `ceil(income × 120000 / startRateBp)`, 60 × income at 2000 bp.
- Revenue (monthly): `floor(base × rateBp / 120000)`. Equal to the old chained floors;
  at the start rate it equals `income` exactly. The largest validated base is
  `floor(MAX_SAFE_INTEGER / 5000)`; overflow is the diagnostic `ECONOMY_BASE_OVERFLOW`.
- Research: the annual authored allocation is paid as a standing spend of
  `floor(annual / 12)`, capped at `floor(12% × monthly revenue)`.
- Ledger identity, in engine phase order, on **paid** amounts:
  `closing = opening + revenue − construction − preservation − maintenance − obligation − research`.
  Every outflow entry records `requested`, `paid` and `shortfall`.

### 4. Authority

Content authors the inputs; the compiler derives the start state once; the engine owns
monthly accounting; every projection calls the same pure calculators in
`@bluewave/campaign` (`economy.ts`, `economyOutlook.ts`, `researchEligibility.ts`); the
renderer computes nothing. Nothing branches on a nation's name or position.

### 5. Deficit policy

A shortfall is a legal, recorded, non-carried state. The treasury clamps at zero. The
error `NEGATIVE_TREASURY_OBLIGATION` becomes the warning `OUTFLOW_SHORTFALL` for
obligations, maintenance, research and preservation alike. Payment priority is phase
order: construction draws only from funds beyond the obligation reserve, then
maintenance, obligations, research. Arrears and consequences (morale, unrest) are an
extension point owned by the budget-pressure work.

| Code | Severity |
| --- | --- |
| `ECONOMY_ROW_MISSING`, `ECONOMY_VALUE_INVALID`, `ECONOMY_BASE_OVERFLOW`, `RESEARCH_ABOVE_CAP`, `SEEDED_PROJECT_WITHOUT_CAPACITY`, `ECONOMY_UNIFORM_DEFICIT` | error |
| `STRUCTURAL_DEFICIT`, `OUTFLOW_SHORTFALL`, `RESEARCH_UNSPENT` | warning |
| `RESEARCH_BELOW_RESOLUTION`, `NO_ELIGIBLE_RESEARCH_FIELD` | info |

`SetBudgetAllocation` enforces the same research cap at runtime (`RESEARCH_ABOVE_CAP`),
so the cap is a rule of the engine and not only of the compiler.

### 6. Construction capacity

Capacity is **throughput** (treasury units a month per production line, per project)
plus the **tonnage concurrency cap** (3 × the sourced national dock). It comes from
ship-building content and is never derived from the economic base. The treasury-unit
cap and its divisor are deleted. A project the campaign starts with on the slips has no
parts loadout, so the order-time planner cannot price it: it is materialised at compile
time by `seededConstructionPlan` (`@bluewave/ship-design`), which keeps the planner's
package chain (hull, launch, fit-out, trials, acceptance), sizes it from the construction
balance's own shares and paces every line at the historical keel-to-commissioning time of
the displacement. The project carries its own `capacityUnits`; the national build speed
is applied at funding from its `buildTimeMultiplierBp`. The acceleration-pressure pool
(the capacity-pressure check on accelerated projects) stays explicitly undefined (`ACCELERATION_POOL_UNDEFINED_UNITS`): the
spike in `docs/research/economy/acceleration-pool/` showed the candidate definition carries
no national information, so the numeric pool is not pinned.

### 7. Research

The research phase reads the compiled catalogue from `world.technologies`, carried in the
snapshot. A technology is available from its authored `availabilityMonth`, else from
January of its `year` (ADR-0229 keeps `year` as the designer unlock year; the research
phase now reads the same field as the earliest month a nation may start it). A budget no
field can take is not drawn and is reported (`NO_ELIGIBLE_RESEARCH_FIELD`); points beyond a
technology's cost are reported (`RESEARCH_UNSPENT`).

### 8. Projections

`economyOutlook` settles the month ahead in the engine's own order and returns revenue,
obligations, war-aware maintenance, planned research and its cap, the construction upper
bound, the net before construction, the shortfall, the month-end treasury, the runway and
one status band (integer comparisons against revenue: healthy at 25%, narrow at 0, deficit
down to −10%, critical below). The status strip, Treasury screen, opening briefing and
priorities read it; the month ledger shows a reconciliation line and flags each shortfall.

## Invariants

- The ledger identity closes on paid amounts every month; the treasury never goes negative.
- `revenue(start) == income` for every nation.
- Research never exceeds the cap or the authored annual share; no float in the authoritative
  economy; identical inputs give identical hashes.
- Relabelling or reordering nations changes no outcome (metamorphic gates).
- The projection's revenue, obligations, maintenance and research equal the first executed
  month's ledger `requested` lines; planned construction is an upper bound (differential gates).

## Consequences

- Golden hashes move by design; the re-pin reports old value, new value and cause
  (`golden/hashes.json`, the commit body). The compatibility version is 3.1.0: every new
  field is optional, so a 3.0.0 snapshot still decodes, but a 3.0.0 save is refused at the
  gate (ADR-0113 §5; no released save exists) because replaying it under a different
  economy would silently change its outcomes. The offline migration tool re-stamps
  3.0.0, 2.0.0 and 1.2.0 development fixtures without recomputing a base or a catalogue.
- Japan, the Netherlands, Portugal, Qing and Brazil derive zero monthly research (unit
  resolution). Only Portugal starts in structural deficit (net −1 a month, first shortfall at
  month 41). Qing starts solvent, but completing its seeded Dingyuan commissions a hull whose
  maintenance turns the net negative; that deficit is emergent and recorded.
- The 340k / 200k / 115k magnitudes and "Portugal affords a sloop" are not oracles.
- Halted-project preservation needs the ship-building balance, so the outlook leaves it out
  and the ledger records it.

## Alternatives rejected

A monthly `researchBudget`; `income` as an annual figure or a 20% share (14 of 14 nations
insolvent in R3); a negative treasury; an arrears stock; economy-derived construction
capacity; per-nation branches or allowlists.
