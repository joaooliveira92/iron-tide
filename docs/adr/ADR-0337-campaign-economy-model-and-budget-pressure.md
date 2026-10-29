# ADR-0337: Campaign economy — one appropriation, one ledger, one set of budget-pressure values

Consolidates: ADR-0230, ADR-0240

Applies to: content, campaign, phase-engine

Rule: Campaign economy is a single integer appropriation-to-ledger model; budget-pressure values are researched then tunable; government type derives from political system via a mandatory ruleset table.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0230
Supersedes: ADR-0240

## Context

The player-facing budget, the content compiler and the month executor were three disagreeing economies. The compiler set every nation's economic base to zero, the projection left out fixed obligations, and authored research was never paid. Separately, the S-3 (budget pressure and unrest) values had no researched source — the manual states only 3–5% growth, a 12% research cap, and qualitative unrest rules (p.62) — and no government-type classification existed. This record consolidates the resulting decisions into one coherent model.

## Rules

### 1. Terms, units and value taxonomy

1. **Treasury unit (TU)** = £10,000. "Budget" is retired as a bare word; see `packages/campaign/GLOSSARY.md`.
2. All economy values belong to exactly one of these classes:
   - **Authored balance input** — `income`, `expenses`, `treasury`, annual `researchBudget`, dock sizes, national multipliers
   - **Derived start state** — `baseResources`, monthly research spend, seeded-project packages and `capacityUnits`, the research catalogue
   - **Runtime stock** — treasury, `baseResources`
   - **Runtime flow** — revenue, obligation, maintenance, research, construction draw, preservation
   - **Configuration** — start rate 2000 bp, rate range 500–5000 bp, research cap 1200 bp, research conversion 10000 bp, shipyard capacity multiple
   - **Extension point** (no value yet) — annual growth (300–500 bp band), volatility, colony income, start-rate override, a base/rate split
   - **Display only** — projection fields, descriptive identity enums

### 2. Equations (integer only, one rounding point each)

1. **Base** (once, at compile): `ceil(income × 120000 / startRateBp)`, ≈60 × income at default rate.
2. **Revenue** (monthly): `floor(base × rateBp / 120000)`. At the start rate it equals `income` exactly.
3. **Research**: `floor(annualResearchBudget / 12)`, capped at `floor(12% × monthly revenue)`. Authored allocation is the annual share; no authorised field is drawn.
4. **Ledger identity** (engine phase order, on paid amounts): `closing = opening + revenue − construction − preservation − maintenance − obligation − research`. Every outflow entry records `requested`, `paid` and `shortfall`.

### 3. Authority boundaries

Content authors the inputs. The compiler derives the start state once. The engine owns monthly accounting. Every projection calls the same pure calculators in `@bluewave/campaign` (`economy.ts`, `economyOutlook.ts`, `researchEligibility.ts`). The renderer computes nothing. Nothing branches on a nation's name or position.

### 4. Deficit policy

A shortfall is a legal, recorded, non-carried state. The treasury clamps at zero. The error `NEGATIVE_TREASURY_OBLIGATION` becomes the warning `OUTFLOW_SHORTFALL` for obligations, maintenance, research and preservation alike. Payment priority is phase order (obligations → maintenance → research → construction draws). Arrears and consequences (morale, unrest, sacking) are an extension point owned by the budget-pressure work.

Diagnostics taxonomy (errors, warnings, info):

| Code | Severity |
| --- | --- |
| `ECONOMY_ROW_MISSING`, `ECONOMY_VALUE_INVALID`, `ECONOMY_BASE_OVERFLOW`, `ZERO_MONTHLY_REVENUE`, `RESEARCH_ABOVE_CAP`, `SEEDED_PROJECT_WITHOUT_CAPACITY`, `ECONOMY_UNIFORM_DEFICIT` | error |
| `STRUCTURAL_DEFICIT`, `OUTFLOW_SHORTFALL`, `RESEARCH_UNSPENT` | warning |
| `RESEARCH_BELOW_RESOLUTION`, `NO_ELIGIBLE_RESEARCH_FIELD` | info |

`ZERO_MONTHLY_REVENUE` is a compile-time check in `buildNationStates`: derived gross monthly revenue at the start rate is exactly 0. It is not zero or negative net (`STRUCTURAL_DEFICIT`) and never fires at runtime. `SetBudgetAllocation` enforces the research cap at runtime (`RESEARCH_ABOVE_CAP`), so the cap is a rule of the engine and not only of the compiler.

### 5. Construction capacity

Capacity is **throughput** (treasury units per production line, per project) plus the **tonnage concurrency cap** (3× the sourced national dock). It comes from ship-building content, never from the economic base. A project started on the slips has no parts loadout; it is materialised at compile time by `seededConstructionPlan` (`@bluewave/ship-design`), which sizes it from the construction balance's own shares and paces every line at the historical keel-to-commissioning time of the displacement. The acceleration-pressure pool stays explicitly undefined (`ACCELERATION_POOL_UNDEFINED_UNITS`).

### 6. Research

The research phase reads the compiled catalogue from `world.technologies` in the snapshot. A technology is available from its authored `availabilityMonth`, else from January of its authored `year` (the same field that governs designer unlock, ADR-0229). A field with no eligible technology takes no draw (`NO_ELIGIBLE_RESEARCH_FIELD`). Points beyond a technology's cost are reported (`RESEARCH_UNSPENT`).

### 7. Projections

`economyOutlook` settles the month ahead in the engine's own phase order and returns revenue, obligations, war-aware maintenance, planned research and its cap, the construction upper bound, the net before construction, the shortfall, month-end treasury, runway, and one status band (healthy > 25% of revenue, narrow > 0, deficit ≥ −10%, critical). The status strip, Treasury screen, opening briefing and priorities read it; the month ledger shows a reconciliation line and flags each shortfall.

### 8. Budget-pressure (S-3) values

All values come from a research-first process: the grounded manual bounds (3–5% growth, 10%/12% research curve, p.62 drivers and brakes) are binding as stated. Every remaining number (unrest scale, seeded 1880 levels, strike/revolution thresholds, driver magnitudes, harsh-peace severity, per-nation growth within the band, possession values and decay, the research-return curve) is a named centralised ruleset constant (ADR-0223 form), recorded as an ADR-0213 `balance_adjustment` with `sourceStatus: BALANCE_TARGET` and a written rationale. The "matches RTW3" constraint is waived for those values only. Values are chosen for playability: unrest is reachable by sustained budget pressure, never by one bad month. If a higher-trust source appears for any item, the grounded value replaces the balance target and this record is amended.

### 9. Government type

A single mandatory ruleset table maps each authored `politicalSystem` to one of the manual's six government types (p.60). No second per-nation content field is added. The only classification that changes revolution odds is _liberal democracy_, which damps revolution. A nation is a liberal democracy only if, in 1880 practice, its executive is answerable to an elected legislature. **Tie-break:** a nation the research cannot place with confidence is _not_ a liberal democracy. Every nation must classify or content compilation fails. The research note justifies each borderline case.

## Invariants

- The ledger identity closes on paid amounts every month; the treasury never goes negative.
- `revenue(start) == income` for every nation at the default rate.
- Research never exceeds the cap or the authored annual share.
- No float in the authoritative economy; identical inputs give identical hashes.
- Relabelling or reordering nations changes no outcome (metamorphic gates).
- The projection's revenue, obligations, maintenance and research equal the first executed month's ledger `requested` lines; planned construction is an upper bound (differential gates).
- Retuning any balance value is a ruleset version change, not a model change.

## Compatibility

The consolidation is additive: no product, state, hash or wire format changes. The superseded originals (ADR-0230, ADR-0240) remain on disk for provenance. Every golden, replay and compatibility version number is unchanged.

## Alternatives rejected (originals)

A monthly `researchBudget`; `income` as an annual figure or a 20% share (14 of 14 nations insolvent in R3); a negative treasury; an arrears stock; economy-derived construction capacity; per-nation branches or allowlists; a second per-nation government-type content field; formal-title-only liberal democracy classification.