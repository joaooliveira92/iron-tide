# R1: Economy lineage, units and evidence inventory

Issue: #124 (parent map #123). Planning/evidence only: no tracked production file was modified. Method: read-only repository search of the `research/economy-r1` worktree (based on `dev` at fc23c6f). No production run was executed (the worktree has no `node_modules`), so every runtime statement below is derived by code reading and is labelled accordingly.

Label key: **[V]** verified in source (file:line), **[A]** assumption, **[H]** hypothesis, **[U]** uncertainty / unresolved.

Companion artifacts in this directory:
- `units-terminology-matrix.csv`: unit, time basis, stock/flow, gross/net, authored/derived per quantity.
- `equation-comparison.csv`: authored vs compiler vs runtime vs projection vs UI, with numbered disagreement points D1-D11.
- `nations-economy-matrix.csv`: all 14 nations, authored values and derived ratios.
- `consumers.csv`: every repo reference to `baseResources`, `income`, `expenses`, `researchBudget` (production source, content, and tests/fixtures).

## 1. Headline findings

1. **[V] `baseResources` is hardcoded to 0 for every nation** at compile time (`packages/campaign/src/nationCompilation.ts:242`). It is not authored anywhere in `content/production/1880/*.yaml`. Consequences in the engine: monthly revenue is skipped (`packages/phase-engine/src/economyPhases.ts:71-78`, `continue` when revenue <= 0) and the construction cap is 0 (`economyPhases.ts:61-64`), so ordinary appropriation funds nothing (`economyPhases.ts:293` breaks on cap <= 0) and acceleration pressure has zero capacity (`:212`).
2. **[V] Authored `income` is never credited to treasury.** `grep -w income` over `packages/phase-engine/src` hits only `snapshotClone.ts:329` (field list). It is read only by three projections (`packages/campaign-engine/src/projection.ts:165-167`, `opening-briefing.ts:196-198`, `priorities.ts:126-128`) which compute `floor(income * navalAppropriationRateBp / 10000)` with the hardcoded rate 2000 (20% of income) and no division by 12.
3. **[V] Treasury has no inflow in the production pack.** Treasury outflows are `expenses` (every month, `economyPhases.ts:591-621`), ship maintenance (`:517-548`), research (month 1 only, see 5), and commanded construction (`commands.ts:323-329`). Inflows found: monthly revenue (0 here), interruption deltas (`interruption.ts:155`), foreign-contract builder credits (`foreign*` modules, not traced in depth) **[U]**. This is the mechanism behind decision request 0014 and #95 (insolvent decade, `.ai/decision-requests/0014-n-3-ten-year-run-treasury-baseline.md:E1`). **[A]** The exact first-negative months (11..24) also depend on maintenance and AI spending that were not simulated here.
4. **[V] The projection UI (status strip, Treasury, briefing, priorities) and the engine use different equations** (see `equation-comparison.csv` D1-D11). The projection omits `expenses` entirely, subtracts cumulative `paidWork` as if monthly, and uses `income` where the engine uses `baseResources`.
5. **[V] Authored `researchBudget` is a first-month spend, not a standing monthly budget.** The research phase resets `researchBudget` to `standingResearchBudget ?? 0` (`packages/phase-engine/src/research.ts:282`); `standingResearchBudget` is only set by the `SetBudgetAllocation` command (`phase-engine/src/commands.ts:216-217`) and never by the compiler (`nationCompilation.ts:159`). A command-free run pays research once.
6. **[V] Descriptive economy enums are dead for gameplay.** `gdpTier`, `industrialization`, `economy.industrialBase`, `navalAppropriation.budgetLevel` (`packages/content-schema/src/nation.ts:210-236`, `:278-297`) have no reader outside schema/compiler validation (`git grep` of packages/apps excluding content-schema: no hits). National identity in `countries.yaml` therefore does not drive any number.
7. **[V] research.yaml covers all 14 nations; economies.yaml covers all 14.** Missing-nation fallbacks exist and are silent: economy defaults treasury 500 / income 100 / expenses 50 (`nationCompilation.ts:222-233`), research default budget 0 (`:102-110`). No diagnostic is raised for a nation absent from economies.yaml. **[U]** whether the content-compiler cross-reference validator catches it (`validate.ts:174` only validates each file's own schema) .
8. **[V] The owner-brief figures "~340,000 / ~200,000 / ~115,000" occur nowhere in economy content or docs.** Repo-wide search finds `~200,000` only as Italy's peacetime army size (`content/production/1880/countries.yaml:679`), Ottoman army (`:1246`) and Brazil National Guard (`:1602`). No file carries 340,000 or 115,000 as an economic value. **[H]** They may be annual budget-scale numbers consistent with the test fixtures' `baseResources` magnitude (UK 120,000 in `packages/phase-engine/test/month.test.ts:18`, `economy.test.ts:104`), but unit and year are unsupported; treat as unsourced. **[V]** Therefore they cannot be validated or rejected from repo evidence alone.

## 2. Lineage (content to UI)

| Stage | Symbol | file:line |
|---|---|---|
| Content | `economies.yaml` `{nationId, treasury, income, expenses}` | `content/production/1880/economies.yaml:1-14` |
| Content | `research.yaml` `researchBudget, currentProjectTechId, fieldPriorities, technologies` | `content/production/1880/research.yaml` (14 nations) |
| Content | `countries.yaml` descriptive `baseResources{gdpTier,...}`, `navalAppropriation.budgetLevel`, `economy.industrialBase` | `content/production/1880/countries.yaml` per nation |
| Pack manifest | economies / research / ports listed | `content/production/1880/pack.json` |
| Schema | `CampaignEconomySchema` (nonNegativeInt, no unit) | `packages/content-schema/src/campaign.ts:64-70` |
| Schema | `CampaignResearchSchema` | `packages/content-schema/src/campaign.ts:99-107` |
| Schema | descriptive nation economy schemas | `packages/content-schema/src/nation.ts:210-297` |
| Validation | economies validated by schema + idField | `packages/content-compiler/src/stages/validate.ts:174` |
| Normalize | sorted by nationId | `packages/content-compiler/src/stages/normalize.ts:99` |
| Campaign compile | `buildNationStates`: copies treasury/income/expenses; defaults; hardcodes baseResources 0, rate 2000, maintenance 0 | `packages/campaign/src/nationCompilation.ts:186-253` |
| Campaign compile | `buildResearch` | `nationCompilation.ts:97-163` |
| State type | `NationState` | `packages/campaign/src/state.ts:462-476`, `ResearchState` `:72-82` |
| Bounds | rate 500..5000 bp, research 0..1000 | `packages/campaign/src/budgetConstants.ts:3-7`, `packages/commands/src/payloadValidation.ts:415-450` |
| Command | `SetBudgetAllocation` | `phase-engine/src/commands.ts:199-223` |
| Runtime | phase order: monthly_revenue, command_collection, ai_planning, ai_procurement, appropriation, maintenance, obligation, construction_processing, resolve_diplomacy, resolve_research... | `packages/phase-engine/src/month.ts:112-175` |
| Runtime | revenue, cap, appropriation, maintenance, obligation | `phase-engine/src/economyPhases.ts:61-117, 161-515, 517-584, 586-638` |
| Runtime | research spend | `phase-engine/src/research.ts:93-310` |
| Diagnostics | `NEGATIVE_TREASURY_OBLIGATION` (error), `NEGATIVE_TREASURY` (validation) | `economyPhases.ts:596-602`, `validationPhases.ts:16-19, 74-77` |
| Ledger | categories NAVAL_APPROPRIATION, APPROPRIATION, CONSTRUCTION_BUDGET, CONSTRUCTION_PRESERVATION, MAINTENANCE_EXPENDITURE, OBLIGATION, RESEARCH_EXPENDITURE | `economyPhases.ts:95,393,409,557,616`; `commands.ts:348`; `research.ts:307` |
| Persistence | snapshot field list (income, expenses, baseResources, rate, maintenance, research incl. standing) | `phase-engine/src/snapshotClone.ts:186-187, 327-333`; persistence/src has no economy-specific code (generic snapshot serialization) **[U: not traced]** |
| Projection | `buildPlayerProjection` | `packages/campaign-engine/src/projection.ts:145-244` |
| Projection | opening briefing / priorities | `campaign-engine/src/opening-briefing.ts:175-258`, `priorities.ts:105-210` |
| Month report | treasury section from ledger categories | `apps/desktop/src/main/commands/turnTransaction.ts:237-296`, `commitMonth/reportEntry.ts:149-177` |
| UI | status strip budget rows | `apps/desktop/src/renderer/shell/status-strip-state.ts:136-165` |
| UI | Treasury summary and budget bar | `renderer/screens/treasury/treasury-summary.ts:20-39`, `budget-bar.ts`, `BudgetPolicyPanel.tsx` |
| UI | Month ledger | `renderer/screens/overview/components/MonthReportTreasurySection.tsx` |
| UI | Research screen | `renderer/screens/research/research-allocation.ts`, `research-view-model.ts` |

## 3. Dead, ignored, hardcoded, duplicated, conflicting

- **Hardcoded [V]:** `baseResources=0`, `navalAppropriationRateBp=2000`, `maintenanceCost=0` (`nationCompilation.ts:242-244`); fallback economy 500/100/50 (`:222-224`); research conversion 1:1 (`research.ts:16`); `/12` and `/100` constants in revenue and cap (`economyPhases.ts:63,76`).
- **Dead [V]:** `income` in engine; all descriptive enums (gdpTier, industrialization, industrialBase, budgetLevel); `armyNavyBalance`/`military` descriptive fields are also unread by economy code **[A: only economy greps were run]**.
- **Duplicated [V]:** appropriation formula in three projections (projection.ts, opening-briefing.ts, priorities.ts) each calling `scaleValue(income, rateBp)`; maintenance computed by two functions (engine `shipMonthlyMaintenanceCost` with war flag vs campaign-engine `shipMaintenanceCost`); research split recomputed in the renderer (`research-allocation.ts:9-49`).
- **Conflicting [V]:** D1-D11 in `equation-comparison.csv`. Also `constructionSpend` is documented as cumulative (`projection.ts:15-23`) yet subtracted in a monthly surplus (`:183-184`); status strip footnote admits "the revenue source is not yet confirmed" (`status-strip-state.ts:142`).
- **Two "capacity" concepts [V]:** treasury-unit cap from `baseResources` (`economyPhases.ts:61-64`) vs dock/mass capacity from ship-building balance (`apps/desktop/src/main/construction/economy.ts:40-45`; `content/production/1880/ship-building/balance.yaml:473` `shipyardCapacityMultipleBp: 30000`; `treasuryUnitMicro` `:780`). Port `level` (88 ports, `ports.yaml`) feeds only `shipyardCapacity` display (`projection.ts:164`) **[V]** and is described as a stand-in (`status-strip-state.ts:128`).
- **Test/production scale gap [V]:** tests use `baseResources` 120,000 (revenue 2,000/month, cap 100) with treasury ~500-1,000 (`month.test.ts:306-317`, `economy.test.ts:104-106`), 38 fixtures use `baseResources: 0`. Production revenue is 0. The green economy tests therefore never exercise production values. Test expectation `month.test.ts:449-455` ("No base resources => no revenue => no appropriation") codifies the production zero case as a unit behaviour.

## 4. The `priorities.ts` comment (full context)

`packages/campaign-engine/src/priorities.ts:105-115`:

> Pure priorities projection — 6 of 8 doc types (spec §7). Cut with recorded reasons (never re-added): `obsolete_active_class` — no obsolescence score, no design→tech mapping. `construction_stalled` — per-project month-over-month delta not persisted. `construction_near_completion` is adapted to the work-ratio proxy (`completedWork / totalWork >= 0.9`) since `computeConstructionCap` / months-to-completion is underivable (compiler hardcodes baseResources 0).

[V] This is the in-code acknowledgement that the compiler zero is known and worked around, not fixed.

## 5. Original text of #95 and decision request 0014

Issue #95 ("Economy: command-free decade is insolvent for all fourteen nations (N-3 follow-up)", open, label `enhancement`) states: the 120-month command-free run records `NEGATIVE_TREASURY_OBLIGATION` for all fourteen nations starting with Portugal (month 11), Netherlands (12), Qing (13), each repeating for ~97-110 months; owner decision 0014-A accepted it as baseline; desired outcome: "An unattended decade either stays solvent under the shipped economy/AI, or the game documents and surfaces the insolvency as a deliberate rule rather than a diagnostic. Any behavioural fix needs its own fidelity decision and golden/save re-pin." Fetched with `gh issue view 95`.

Decision request 0014: `.ai/decision-requests/0014-n-3-ten-year-run-treasury-baseline.md` (resolved 2026-10-17, Option A accepted + Option C as #95). Per-nation month counts: E1 table lines 30-45 (portugal 110 first 11; netherlands 109/12; qing 108/13; austria_hungary 104/17; germany 103/18; france 102/19; italy 103/18; japan 102/19; ottoman_empire 102/19; russia 102/19; spain 102/19; uk 102/19; brazil 100/21; usa 97/24). The record states "the run never changes content, the pack, the ruleset or the economy" and offers no cause analysis; **this research supplies a candidate cause (findings 1-3)**.

## 6. Test, fixture and golden inventory

- Full reference list: `consumers.csv` (about 400 test/fixture rows). Economy-relevant test files include `packages/phase-engine/test/{economy,month,research-design,integration,halt-delay,construction-acceleration,foreign-construction,foreign-war-settlement}.test.ts`, `packages/campaign-engine/test/{projection-economy,priorities,projection,opening-briefing,research-screen-projection}.test.ts`, `packages/campaign/test/campaign.test.ts`, `packages/content-compiler/test/{campaignCollections,schemaCoverage}.test.ts`, `packages/persistence/test/*roundtrip*.test.ts`, `apps/desktop/src/main/commands/{budgetCommands,commitMonth}.test.ts`, `apps/desktop/src/renderer/screens/treasury/*.test.ts(x)`, `apps/desktop/src/renderer/shell/{status-strip-state,StatusStrip}.test.ts(x)`.
- Production-pack economy gates: `packages/cross-process-test/test/ten-nation-smoke.test.ts:180-188` (allowlists portugal and netherlands `NEGATIVE_TREASURY_OBLIGATION`), `ten-year-run.test.ts:87-94` (tolerates only that code for all nations).
- Goldens: `golden/hashes.json` (content/bundle/initial/closing snapshot, ledger hashes). Any change to compiler defaults, economies.yaml, or economy phases changes the initial/closing snapshot and ledger hashes; re-pin per `docs/agents/golden-repinning.md`. **[A]** no economy-specific golden beyond these.
- Not an economy golden: `packages/ship-visual/test/golden/*`.

## 7. National identity hypotheses vs evidence (1880 only)

Authored values (see `nations-economy-matrix.csv`): income/expenses ratio is 37-44% for 13 nations (Portugal 67%), research budget is 60-133% of income. **[V]** The authored economies are nearly the same shape scaled by size: expenses/income 37-44% everywhere, treasury about 25-30 months of expenses everywhere (Portugal 20, Brazil 30). **[H]** Because `income` is unused and the descriptive tier fields are dead, no national difference can currently express as behaviour; the only live differentiators are `treasury`, `expenses`, `researchBudget`, ports, fleet. Per nation (hypotheses, not decisions):

| Nation | Brief claim | Evidence from repo | Status |
|---|---|---|---|
| Great Britain | wealthy but budget-pressured; ~340,000 | treasury 1000 / income 100 / expenses 38 (`economies.yaml:1`); tier great_power, world_leading, budgetLevel moderate (`countries.yaml:48-54`); 20 ports, level sum 138 (`ports.yaml`); expenses ratio identical to France (38%), so "global obligation" burden is not distinguished **[V]**; 340,000 unsourced **[U]** | partly supported (scale), burden differentiation unsupported |
| United States | below Europe at start; 115,000 is 1890 | tier great_power, world_leading (`countries.yaml:292-295`) conflicts with brief "below leading European powers" **[V]**; economy 280/26/10 ranks 6th by income (UK, France, Russia, Italy, Germany, then USA) **[V]**; 115,000 absent **[V]** | contested: tier label overstates vs brief; numeric rank is below |
| France | strong but constrained; ~200,000 | 700/68/26; expenses ratio 38% equals UK **[V]**; `~200,000` appears only as Italy's army **[V]** | colonial burden not encoded in expenses beyond a uniform ratio |
| Germany | compact, efficient, less colonial | 320/30/12 (40%); tier great_power but industrialization `industrial` (not world_leading); budgetLevel low (`countries.yaml:175-180`) **[V]**; research 30 = 100% of income, high vs peers **[V]** | no field expresses "concentration" |
| Japan | small base, high priority | tier minor_power, pre_industrial, very_low (`:408-413`); 130/12/5; research 83% of income, the same band as peers **[V]**; one rate field `navalAppropriationRateBp` is global default 2000 for all, so base x rate cannot distinguish high priority per nation without authoring it **[V]** | base-vs-priority split needs a per-nation rate or separate field **[H]** |
| Russia | large base, restricted naval funding | tier great_power developing_industrial vast_unintegrated; 550/55/21; income and naval budget are not separate quantities in current data (income is gross, rate default is uniform) **[V]** | cannot separate income from naval budget today |
| Italy | mid-low, regional | 400/38/14; tier great_power developing_industrial; Italy treasury and income exceed Germany's in absolute terms (400 vs 320; 38 vs 30) **[V]** which conflicts with "mid-to-low budget" | contested by data |
| Austria-Hungary | limited naval-industrial base | 240/22/9; budgetLevel low; shipbuilding limit would live in the dock/profile (`ship-building/naval-profiles/austria_hungary.yaml`), not in treasury **[U: profiles not inventoried]**; construction cap formula is baseResources-based and 0 for all, so it currently erases any national difference **[V]** | cap formula cannot express it |
| Spain | very weak economy | tier minor_power, developing_industrial, low; 180/16/7, identical to Ottoman Empire (180/16/7) **[V]**; "must use small vessels" must emerge from economics (brief) but there is no yard-capacity-to-treasury link | Spain == Ottoman numerically (duplicate) |
| Qing | weak effective funding despite large aggregate | tier great_power, pre_industrial, vast_unintegrated, very_low (`countries.yaml:1073-1086`); 100/9/4; income below Spain, Italy etc. **[V]**; same expenses ratio 44% as Spain/Ottoman **[V]** | distinguishable from Spain only by absolute size |
| Portugal | none supplied | 40/3/2 (income 3, expenses 67% of income, research 133% of income, so research alone exceeds income) **[V]**; treasury/expenses 20 months; first negative month 11 (0014 E1) **[V]**; "affords a sloop" depends on ship price vs treasury 40 **[U: sloop prices not inventoried]**; failure category: with revenue 0 it is a cash-flow (no-inflow) condition common to all nations, plus compiler default (baseResources 0) **[V/H]**; unit mismatch not shown for Portugal specifically | acceptance criterion unsupported without a revenue model |

## 8. Open questions for downstream tickets (#126, #128)

1. **[U]** Intended unit and time basis of authored `income` and `expenses` (monthly? annual? treasury units of GBP 10,000 per ADR-0216?). No source states it. If `income` were annual 100 units = GBP 1.0M, UK 1880 naval estimates (about GBP 10M) would make it low by 10x **[H, external knowledge, unverified]**.
2. **[U]** Whether `baseResources` was meant to be derived from `income` (e.g. income x 12 x something) or authored separately. Tests assume 120,000.
3. **[U]** Whether `standingResearchBudget` should be seeded from `researchBudget` at compile.
4. **[U]** RTW3 baseline says budget grows 3-5%/yr, research capped at 12% of budget, naval share rises with tension (`docs/research/rtw3-manual-baseline.md:38-41`); none of this is implemented (research bound is an absolute 1000, `budgetConstants.ts:7`) **[V]**.
5. Any behavioural change re-pins goldens and saves (stop condition per AGENTS.md).
