# R3: Executable scenarios for GB / France / Portugal and all-nation failure causes

Issue #126 under map #123. Planning/evidence only: no tracked production file was modified.
Baseline `dev` fc23c6f. Builds on R1 (`research/economy-r1`, lineage by code reading) and R2
(`research/economy-r2`, magnitudes unsourced). Unlike R1, **the shipped 1880 pack was compiled and run**.

Labels: **[M]** measured by running production code, **[V]** verified in source, **[H]** hypothesis, **[U]** unresolved.

## 1. Method (exact commands)

```
cd /Users/joao/dev/iron-tide && pnpm worktrees new research-economy-r3
cd .worktrees/research-economy-r3 && git branch -m research/economy-r3
pnpm install --frozen-lockfile && pnpm exec vp run -r build        # dist/ and node_modules are git-ignored
bash docs/research/economy/r3/scripts/run-all.sh                    # regenerates everything below
```

- `scripts/lib.mjs` compiles the pack with the same helper the N-3 gate uses
  (`cross-process-test/dist/production-pack.js: compileProductionCampaign`), then steps the real
  `MonthExecutor` command-free with the gate's seed (`ten-year-progression-1880`), reading the financial ledger
  and the real `buildPlayerProjection` / `buildOpeningBriefingProjection` each month. Raw YAML is read through the
  repo's own `parseYamlSafe`. Interpretation variants mutate only the in-memory snapshot.
- Determinism [M]: re-running the baseline reproduces `run-I0_current.json` byte-for-byte (sha256 `a3234acc...f93686`).
- Raw `data/run-*.json` (8 x 1.7 MB, 1,680 nation-months each) are regenerable and **not committed**; CSVs are.
- Not simulated: player commands, AI procurement beyond what the executor does by default (it posted no ledger
  entry in any run), foreign contracts, wars (none active), growth, events. Engine options (`shipBuilding`) are unset, as in the gate.

### Interpretations tested (`INTERPRETATIONS` in `lib.mjs`)

The compiler hardcodes `baseResources=0`, rate 2000 bp. Authored `income` is the only candidate source of scale. Each
interpretation sets `baseResources` from authored income at rate 2000:

| Id | Meaning of authored `income` | base | Engine monthly revenue |
|---|---|---|---|
| I0 current | ignored (shipped) | 0 | 0 |
| I1 | monthly gross, UI shows 20% of it | 12 x income | 0.2 x income |
| I2 | monthly naval appropriation, credited in full | 60 x income | income |
| I3 | annual naval appropriation | 5 x income | income / 12 |
| `*s` variants | same, plus standing research seeded from `researchBudget` | | |

I1 is the only variant where engine and current UI projection agree on revenue. The `*s` variants have an identical
treasury path to their base (section 4, finding F1), so they are not tabulated separately.

## 2. Decision request 0014 reproduced [M]

`data/first-negative-reproduction.csv`: all 14 nations match 0014's E1 table exactly, both first month and count
(portugal 11/110, netherlands 12/109, qing 13/108, austria_hungary 17/104, germany 18/103, italy 18/103, france 19/102,
japan 19/102, ottoman_empire 19/102, russia 19/102, spain 19/102, uk 19/102, brazil 21/100, usa 24/97).

Cause: no inflow exists [M]. Over 120 months the ledger holds only `OBLIGATION` and `MAINTENANCE_EXPENDITURE`. Treasury falls
linearly by `expenses + maintenance`. First negative = first month treasury (after maintenance) < expenses; the treasury
hits 0 one month earlier for 5 nations (portugal 10, austria_hungary 16, ottoman_empire 18, spain 18, brazil 20), so the
diagnostic lags real exhaustion by 0 to 1 month.

R1 correction: R1 did not simulate maintenance; it is 17% to 57% of the monthly drain (`nation-groups.csv`).

## 3. Worked months: Great Britain, France, Portugal (`data/gb-fr-pt-12-months.csv`, 12 months x 4 interpretations)

Raw authored -> compiled (`data/raw-to-start-state.csv`): treasury/income/expenses are copied verbatim;
`baseResources`, rate, maintenance are compiler constants; authored `researchBudget` copies to `research.researchBudget`.
GB 1000/100/38, FR 700/68/26, PT 40/3/2; research 60/55/4; ships 4/3/1; maintenance month 1: 16/12/2.

Twelve-month totals and boundaries (all treasury units; `exact` is the unrounded annual figure):

| Nation / interp | base | rev credited 12m (exact) | expenses 12m | maint 12m | cap | close m12 | projected chain error 12m |
|---|---|---|---|---|---|---|---|
| GB I0 | 0 | 0 (0) | 456 | 192 | 0 | 352 | 24 |
| GB I1 | 1200 | 240 (240) | 456 | 192 | 1 | 580 | 318 |
| GB I2 | 6000 | 1200 (1200) | 456 | 216 | 5 | 1488 | 1484 |
| GB I3 | 500 | 96 (100) | 456 | 192 | 0 | 448 | 120 |
| FR I0 | 0 | 0 | 312 | 144 | 0 | 244 | 192 |
| FR I1 | 816 | 156 (163.2) | 312 | 144 | 0 | 400 | 348 |
| FR I2 | 4080 | 816 (816) | 312 | 144 | 3 | 1024 | 1170 |
| FR I3 | 340 | 60 (68) | 312 | 144 | 0 | 304 | 252 |
| PT I0 | 0 | 0 | 24 | 24 | 0 | 0 | 32 |
| PT I1 | 36 | **0 (7.2)** | 24 | 24 | 0 | 0 | 32 |
| PT I2 | 180 | 36 (36) | 24 | 24 | 0 | 28 | 60 |
| PT I3 | 15 | **0 (3.0)** | 24 | 24 | 0 | 0 | 32 |

Rounding path at each boundary [V+M]: revenue = `floor(floor(base*rate/10000)/12)` (`economyPhases.ts:71-76`); cap =
`floor(floor(base/12)/100)` (`:61-64`); projection = `floor(income*rate/10000)` (`fleetSize.ts:61-71`).
Engine ledger reconciles to the closing treasury in every row (`recon_matches_close` true for 144/144 rows, allowing the
zero clamp).

## 4. Findings

**F1. Authored research is never paid in the shipped pack [M], contradicting R1 finding 5.** Month 1 emits
`NO_ELIGIBLE_RESEARCH_FIELD` (info) for all 14 nations. `resolveResearchPhase` finds eligible techs only in a stub
`TECH_DEFINITIONS` (`phase-engine/src/research.ts:430`, ids like `basic_hull`), while the pack uses ids such as
`hc_wrought_iron_hull`. The `continue` at the empty-field check skips both the debit and the `researchBudget` reset
(`:282`), so the authored value (60 for GB) stays on the nation forever and is never debited (zero `RESEARCH_EXPENDITURE`
rows in 8 x 120 months). Yet the projection charges it every month. Any economy model that counts research as an
expense is currently untestable end to end; treated here as a **hidden coupling**: research spend depends on a stub catalogue.
If authored research were paid monthly, no nation is sustainable even under I2 (net -5 to -26 per month, `nation-classification.csv`
`net_recurring_if_research_paid_monthly`): the authored `researchBudget` exceeds the post-expense surplus everywhere, so it only works as a one-shot or a share of something else **[H]**.

**F2. Cause classification (`data/nation-classification.csv`).**

| Interpretation | Outcome (120 months) | Primary cause |
|---|---|---|
| I0 current | 14/14 fail (11..24) | missing compiler mapping (`baseResources=0` so revenue 0); contributing: opening treasury covers only 10 to 23 months of `expenses+maintenance` |
| I1 | 14/14 fail (11..41) | 13 x excessive mandatory expenses (revenue 20% of income < expenses+maintenance); PT: revenue **rounds to 0** (exact 0.6) |
| I2 | 13 solvent, **only Portugal fails (month 41)** | PT: income 3 < expenses 2 + maintenance 2. Netherlands net 0, Qing +1 (knife-edge) |
| I3 | 14/14 fail (11..29) | 10 x excessive mandatory expenses; 4 (Brazil, Netherlands, PT, Qing) revenue **rounds to 0** (exact 0.25..0.75) |

No nation is a "deliberate deficit" (no authored marker exists), none "unsupported authored value" except Portugal
(expenses 67% of income, research 133%; others 37 to 44%). "Construction constraint" holds for 8 nations with projects at
start under I0/I3 (cap 0, projects never fund; `construction-progress.csv`) and for Qing under I2. Unresolved: none for the
14 under I0; the choice of interpretation is the open owner decision (R4/R5 territory), not a data gap.

**F3. Projection never matches the engine [M].** `projection-drift.csv`, `nation-groups.csv`: the opening briefing shows
`status=critical` for all 14 nations (`projectedSurplus` GB -56, FR -54, PT -6) because it omits fixed `expenses`, charges
unpaid research, uses `income` not base, and subtracts cumulative `paidWork` as if monthly (GB I2: projection -56 in
month 1, -102 in month 12, while realised delta is +41 to +46). Under I2 the projection sign is wrong for 13 of 14 nations.
Portugal's projected allocation is 0 because `floor(3*0.2)=0`.

**F4. Construction cap is detached from economy scale [M].** `cap=floor(base/12/100)` needs base >= 1200 for cap 1
(`thresholds.csv`), a scale taken from test fixtures (120,000). With income-derived bases the cap is 0 to 5; under I2
GB finishes its remaining 40 work units in 8 months, USA needs 90 months (cap 1), Qing never (cap 0). The cap is
independent of dock/shipyard data, which exists separately in `ship-building/balance.yaml` (R1 section 3).

**F5. Rounding.** The chained floors are mathematically a single floor, and a scan of base 0..20000 at rates 500/2000/5000
found 0 divergences, so there is no chained-floor discontinuity [M]. The real discontinuities are threshold effects:
revenue is 0 until base >= 60 at 2000 bp (240 at 500 bp), cap is 0 until base 1200; small nations fall below them under
I1/I3 (`rounding-boundaries.csv`).

**F6. Hidden coupling and silent behaviour [M].** (a) The obligation and research ledger entries record the full debit
even when treasury is clamped to 0: 120-month ledger overstatement of paid expense is 5480 (GB), 3860 (FR), 440 (PT)
(`nation-groups.csv` `forgiven_debt_...`), i.e. debt is forgiven. (b) The maintenance clamp is silent: with `expenses=0`,
treasury 5, maintenance 16 closes at 0 with no diagnostic (`boundary-cases.csv`). (c) `NEGATIVE_TREASURY_OBLIGATION` fires
on the obligation step only. (d) Maintenance is fleet-driven and constant over 120 months (readiness evolution did not change
it), so it differentiates nations more than authored expenses do.

**F7. Divergent groups (`nation-groups.csv`, runway = treasury/(expenses+maintenance)).** Portugal 10.0 and Netherlands 11.4,
Qing 12.5 form a short-runway group; Austria-Hungary 16.0, Italy 17.4, Germany 17.8, Spain/Ottoman 18.0 (identical economies,
authored duplicates), France 18.4, UK 18.5, Japan 18.6, Russia 19.0, Brazil 20.0; USA 23.3 is the outlier (maintenance only 17% of
drain, 2 ships). GB and France differ only by scale: same expenses/income (38% vs 38%), runways 18.5 vs 18.4. The brief's
GB-vs-France burden difference is **not encoded** [M]; income/drain is 1.85 vs 1.79 under I2. Netherlands and Qing carry
maintenance >= expenses (57%, 50%), i.e. their burden is fleet, not obligation.

**F8. Boundary cases (`data/boundary-cases.csv`, GB, one month each).** Engine accepts any rate: 0, 1, 499, 5001, 10000,
100000 all credit revenue (the 500..5000 bound is enforced only in `SetBudgetAllocation` validation); negative rate gives 0;
fractional rate/base are accepted and floored silently. `base * rate` overflow throws `SafeInt multiplication overflow`
above `floor((2^53-1)/rate)` = 4,503,599,627,370 at 2000 bp (the month aborts with an exception, not a diagnostic).
Treasury at `MAX_SAFE_INTEGER` throws. Negative treasury is rejected at opening validation (`NEGATIVE_TREASURY`,
month `success=false`). Missing `expenses`, `treasury` or `research.researchBudget` throws; missing `income`,
`baseResources`, rate or `maintenanceCost` are tolerated by the engine but missing `income` throws in the projection
(`scaleValue ... got NaN`). The compiler masks these with silent defaults (500/100/50).
Revenue ladder at 2000 bp: base 59 -> 0, 60 -> 1, 119 -> 1, 120 -> 2.

**F9. Brief magnitudes.** ~340,000 / ~200,000 / ~115,000 remain unsourced (R2). Authored ratio UK:FR:USA is 100:68:26 vs the
brief's 340:200:115 (100:59:34); no tested interpretation can be validated against them. Playable vs processed:
`isPlayable` true for 10 nations; Portugal, Netherlands, Brazil, Ottoman Empire are AI-only but economically simulated.
"Affords a sloop" for Portugal is untestable: PT has no construction project, 1 ship, and no sloop price source was
used here **[U]**; at treasury 40 and drain 4 it has 10 months of runway under I0/I1/I3 and 41 under I2.

## 5. Handoff for downstream tickets (#129, #130)

1. The 0014 insolvency is fully explained by the compiler zero plus fixed drains; no nation-specific defect exists.
2. Of the interpretations tried, only I2 (authored `income` is the monthly appropriation, i.e. engine revenue = income) leaves 13
   nations solvent without altering expenses, and it leaves Portugal structurally insolvent (a possible intentional
   identity, owner call). I1 matches the current UI projection but makes every nation insolvent.
3. Any chosen interpretation must also settle: research payment (F1), cap scale (F4), sub-unit rounding of small revenues (F5),
   the projection equation (F3) and ledger vs treasury overstatement (F6). All change hashes (golden re-pin, AGENTS stop condition).

## Files

`scripts/`: `lib.mjs`, `run-months.mjs`, `analyze.mjs`, `boundary-cases.mjs`, `run-all.sh`.
`data/`: `first-negative-reproduction.csv`, `raw-to-start-state.csv`, `gb-fr-pt-12-months.csv`, `nation-classification.csv`,
`nation-groups.csv`, `projection-drift.csv`, `rounding-boundaries.csv`, `construction-progress.csv`, `boundary-cases.csv`,
`thresholds.csv`, `summary.json`.
