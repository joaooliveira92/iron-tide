# R2: Manual pp.12-17 and provenance of the supplied budget magnitudes

Status: research note, 2026-10-17. Issue #125 under map #123. Planning/evidence only.
Extends `docs/research/rtw3-manual-baseline.md`; does not rewrite it.

## Method and source

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf`, the only edition in the repo.
  SHA-256 `36658722907a2dbc35db11baaea250beaeb175fd60eb905e0907e4850d6b3fb6`; 148 pages;
  PDF metadata: Adobe InDesign 18.2, created 2023-04-18. Cover reads only "GAME MANUAL";
  the PDF carries no edition or version string. Publisher/studio credit is not on the pages
  read here (`rtw3-prestige-values.md` cites it as Naval Warfare Simulations / Matrix Games,
  2023; not re-verified in this pass).
- Text extracted with `pypdf` 6.14.2 (pages 11-21, 59-62, 70 read in full; whole document
  searched by regex for budget, capacity, "340", "200,000", "115,000", currency terms).
  Printed page number equals PDF page index (checked on pp.11-18).
- "Most authoritative available edition": no other edition is available. Two stray copies
  (`/Users/joao/dev/bluewave-effect-apps/docs/manual.pdf`, `.../bluewave-compiler copy/docs/manual.pdf`)
  were seen outside this repo and not compared; the in-repo file is the cited one.
- Authority: ADR-0210 ranks the manual 3rd (intent evidence, below ADRs/roadmap).

## 1. Provenance table for the supplied magnitudes

| Magnitude (supplied) | Found in manual? | Found in repo (tracked, any branch)? | Other searched locations | Classification |
| --- | --- | --- | --- | --- |
| GB ~340,000 | No (full-text search: "340" appears nowhere as a budget) | No (`git log --all -S"340,000"` and `-S"340000"` hit only two unrelated commits: an index-on-worktree stash and the initial commit, neither tied to economy content; grep of `content/`, `.ai/`, `docs/`, `packages/*/src`, README/RULES/GLOSSARY empty) | `~/dev/bluewave-compiler copy`, `~/dev/bluewave-effect-apps`, `~/Downloads`: only unrelated hits (ship masses, gun data) | **Unverified. Title, publisher, edition, date, page, unit, period all unknown.** |
| France ~200,000 | No | No economic hit; "200,000" in `content/production/1880/countries.yaml` is army size (lines 679, 1246, 1602) | same | **Unverified** |
| US ~115,000 (1890) | No | No | same | **Unverified** (owner already flags it as 1890, not 1880) |

Result: no source for any of the three magnitudes could be found. Per the issue they are
unverified and must not serve as acceptance oracles. The origin may be an external source
(another game, a wiki, or memory) that was never recorded; asking the owner for it is the only
remaining route (see Blockers).

What the manual does and does not say about magnitudes: it states **no per-nation budget
numbers and no currency unit anywhere** (searched "£", "$", "million", "currency", "per
year", "monthly"). So even if the numbers came from RTW3 game screens, the manual cannot
confirm unit, time basis or year.

Related non-sources, recorded so nobody cites them:
- `~/Downloads/Download the Rule the Waves 3 starting-flow Markdown.md` is an LLM-style design
  suggestion for a clone's start flow (it paraphrases manual p.18/19 and says numbers
  "should be calculated from your own game model"). Secondary, contains no budget magnitudes.
- Repo authored values: `content/production/1880/economies.yaml` (14 nations; e.g. uk
  treasury 1000/income 100/expenses 38; france 700/68/26; usa 280/26/10). Neither the file
  nor `countries.yaml` states a unit, time basis or source for them; ratios are not 340:200:115
  (uk:france income is 100:68 = 1:0.68, not 1:0.59; usa is 26, i.e. 0.26 of uk, not 0.34).
  `countries.yaml` `baseResources` carries only qualitative fields (`gdpTier`,
  `gdpDescription`, `population`, `industrialization...`) with no numeric base.
  So the supplied magnitudes do not appear to be the origin of the authored numbers either
  (inference; no commit message or note links them; single initial commit `43177f4`).

## 2. Manual pp.12-17 statement classification

Classes: **Intent** = how the designers say the system should behave (usable as design
evidence); **Hist** = historical description; **Mech** = another game's (RTW3) specific
mechanics, which Bluewave need not copy; **Obsolete/Out-of-period** = tied to later eras or
features outside the 1880 pack. Quotes are verbatim; page = printed page.

| Page | Statement (verbatim or tight paraphrase) | Class | Bluewave relevance / limits |
| --- | --- | --- | --- |
| 12 | "You will have a yearly naval budget at your disposition. The budget is a function of the base resources of the nation and the proportion of expenditures devoted to the navy. Both of these can vary as an effect of various events in the game." | Intent + Mech | Supports `base x rate` shape and that both factors are variable. No formula, no unit, no period. Annual basis stated. |
| 12 | "The base resources will increase as a result of wars won, and decrease when wars are lost. The base resources will also increase steadily at about 3-5% a year as a result of economic growth." | Mech (rule of RTW3) | Only quantified growth rate in the section; applies in a 1890-1970 game; use as evidence of growth form only (growth parameter), not 1880 value. Uniform for all nations as written. |
| 13 | "Your budget will also get an addition from the colonies and other possessions... income from colonies will decrease over time... might not be profitable by the 1970s." | Mech; the 1970s clause is Obsolete/Out-of-period | Separate additive colonial income term; decline over time. |
| 13 | "The naval budget percentage will vary with various events... will tend to rise in times of high tension and be low in periods of low tension." | Intent + Mech | The rate is the variable one; event/tension-driven. No numbers. |
| 13 | "Your yearly budget will be divided into monthly payments to the navy." | Intent + Mech | Time basis: yearly figure /12 monthly. Matches current `/12` in revenue formula. |
| 13 | "Running out of funds... upset the finance ministry and lower your prestige... fleet morale... unpaid sailors." | Mech | Deficit is permitted but penalised (prestige, morale); supports a general documented deficit rule rather than a hard solvency invariant. |
| 13 | "You can run up a surplus... if you have substantial funds in your coffers for long periods, the Kaiser, Prime Minister or finance ministry might find a use for some of those funds." | Mech | Hoarding is discouraged (stock can be drawn down by the state). Unquantified. |
| 13 | "The budget effect of possessions is relatively limited compared to the rest of income." | Intent | Colonies are a minor term. |
| 13 | Oil access needed to build oil-fuelled ships before 1920 | Obsolete/Out-of-period for 1880 | Not economy. |
| 14-15 | Strategic map, canals, Panama 1914 | Out-of-period / UI | Not economy-relevant. |
| 15 | "as it takes several years to build a battleship, your ships will sometimes be obsolete" | Hist/Intent | Context for research. |
| 16 | "You can define a portion of your budget up to a maximum of 12% as spent on research... on values over 10% there is a diminishing return." | Mech | Research is a share of the budget, capped at 12%; the only numeric research limits in the section. |
| 16 | Priorities high/medium/low are relative; "To prioritize everything is to prioritize nothing" | Mech | Allocation is relative, not additive. |
| 16 | Hull and machinery advances reduce component weights; other fields unlock technologies | Mech | Not budget. |
| 16 | Points in an exhausted field are reallocated, "not wasted" | Mech | Bears on the candidate diagnostics `RESEARCH_BUDGET_UNSPENT`/`NO_ELIGIBLE_RESEARCH_FIELD`: reallocation, not loss, is the stated intent. |
| 17 | Designer's note: focus areas, outcomes not guaranteed; some developments reflect naval conservatism | Intent | Not budget. |

**Not in pp.12-17 at all:** construction capacity. The manual's shipyard capacity text is on
pp.32-33: capacity is "computed as a multiple of the dock size" (a tonnage cap on ships under
construction, submarines count); i.e. in RTW3 it derives from docks, **not** from budget.
Relevant to map ticket on the construction cap (current repo formula divides base resources).
No multiplier value is given. Related: "Efficient"/"Undeveloped shipbuilding industry"
change build time by -10%/+10% (p.59), cost-of-building text on p.30.

### Adjacent statements outside pp.12-17 that bear on the same questions (read in full)

| Page | Statement | Class / use |
| --- | --- | --- |
| 18 | Fleet size setting (small..very large) "determines the size of your budget, and thus the size of your fleet"; large/very large "most closely corresponds to real fleet sizes" | Mech. The budget magnitude in RTW3 is scaled by a player option, so any single RTW3 screen number depends on the fleet-size setting. This alone makes unlabelled RTW3-derived magnitudes ambiguous. |
| 19 | "The budgets given to the different nations are somewhat compressed in their variation and not totally historical, as that would leave some smaller nations unable to compete." Historical budgets option exists "in the 1900 campaign start"; smaller nations then "constantly short on money"; Austria-Hungary/Spain at small fleet "not really recommended" | Intent (explicit): national budgets are deliberately compressed vs history; an uncompressed mode exists only for the 1900 start. Hence RTW3 in-game values are not historical oracles, and not 1880. Supports "do not assume every nation is solvent/uniform" and the Spain/A-H constrained identities. |
| 19 | Nations differ also by research advantages and bonus technologies; Britain has global-naval-power trade-offs | Intent |
| 59 | Characteristics: Efficient/Undeveloped shipbuilding (-10%/+10% build time); Global naval power (10% tonnage on foreign stations, "May get automatic budget raise if any other nation has a similar budget"); Poor education (slight negative research effect); Technology Leader (top research tier) | Mech with direct identity relevance. The only manual text on a naval-dominance budget response: an automatic raise when another nation's budget is similar, flagged as a trait. No magnitude. Does not name which nations carry which trait in these pages. |
| 60 | Government types: Liberal democracy, Limited democracy, Autocratic, Fascist, Communist, Eastern | Mech; Fascist/Communist/Kamikaze are out-of-period for 1880 |
| 61 | Hawkish answers "raise the budget and your prestige"; doveish may lower prestige and/or the naval budget | Mech; event modifier on budget |
| 62 | Unrest raised by high military spending; "Possible unrest in effect acts as a brake on the naval budget" | Intent: the stated bound on appropriation growth. Relevant to "what limits high priority" (Japan) |
| 70 | Trade-protection requirement proportional to "fleet size and your economy" | Mech |

## 3. Per-identity evidence the manual actually supplies

The manual supplies no description of any nation's economy in these pages and no text for
Portugal, USA, Netherlands, Ottoman Empire or Brazil (RTW3 has none of them as playable;
USA appears only as owner of Panama, p.15). Identity descriptions in the brief (GB spreads
thinly, Germany compact modern fleet, etc.) are therefore **not sourced from the manual**;
their provenance is unknown (hypotheses). Manual evidence that touches them: Britain is a
global naval power (pp.19, 59) and blockade x1.2 "dominance in trade and finance" (p.70);
Russia blockade x0.7 (p.70); Austria-Hungary and Spain are minor naval nations with "very
limited resources" at small fleet (p.19); Poor education / Technology Leader / shipbuilding
efficiency traits exist but this note did not extract which nation holds which (not in pp.12-17).

## 4. Findings

1. **No source exists in the repo, its git history, or the manual for GB ~340,000, France
   ~200,000 or US ~115,000.** All three are unverified, provenance unknown, and cannot be
   acceptance oracles. The manual contains no budget magnitudes, no currency and no per-nation
   figures at all.
2. The manual does confirm the structural shape: yearly budget = base resources x navy
   proportion, plus a minor colonial addition; paid monthly (yearly/12); base grows ~3-5%/yr
   and moves with wars; navy proportion moves with tension, events and unrest; research is
   a budget share capped at 12% (diminishing above 10%); running dry is allowed but penalised.
3. The manual explicitly says in-game national budgets are compressed versus history, with a
   historical option only in the 1900 start. RTW3 values are not an 1880 or historical oracle
   even if magnitudes are later traced to RTW3.
4. Construction capacity in the manual comes from dock size (pp.32-33), not from budget.
5. The manual is 1890-1970; it has no 1880 start (ADR-0201). All its text is evidence of
   mechanics/intent, never of 1880 start values.

## Blockers and open items

- **Blocker (provenance):** origin of 340,000 / 200,000 / 115,000 unobtainable from repo or
  manual. Needs the owner to name the source (title, publisher, edition, date, page, unit,
  year) or confirm they are memory/hypothesis. Until then: unverified.
- Not examined: which nations carry which trait in RTW3 (expected in game data or the
  nation select screen, not the manual pages read); other RTW3 editions or patch notes
  (no web search was run; none needed to answer the repo-provenance question).
- Edition/publisher line of the manual is not on the pages inspected; only the creation date
  from PDF metadata is verified here.
