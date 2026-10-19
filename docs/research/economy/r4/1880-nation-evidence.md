# R4: 1880 historical evidence per nation (source-criticised)

Status: research note for GitHub issue #127 (child of economy map #123), created 2026-10-17.
Planning/evidence only: no production content, code, or ADR is changed by this note.
Scope: the ten playable nations of `content/production/1880` (ADR-0214: uk, germany, usa,
japan, france, italy, russia, austria_hungary, spain, qing) plus Portugal, which is
`isPlayable: false` in `countries.yaml` but is named by the owner brief. Dates are 1880
unless a row says otherwise; later-period material is labelled and never used as a start value.

## 1. Sources, method, and trust grading

| Id | Source | Kind | Trust | How read |
|---|---|---|---|---|
| S1 | *The Statesman's Year-Book ... 1881* (Frederick Martin ed., Macmillan, 1881; archive.org id `statesmansyearbo1881londuoft`) | Contemporary compendium, "rev. after official returns" | High for budgets/fleet lists as officially published in 1880-81; it is itself secondary to ministry budgets, and it mixes budget years | Full text `..._djvu.txt` downloaded to a scratch dir and searched; printed page numbers are the book's own (from running headers) |
| S2 | Hansard, Commons, 8 Mar 1880, W. H. Smith (First Lord) presenting the Navy Estimates, `https://api.parliament.uk/historic-hansard/commons/1880/mar/08/departmental-statement` | Primary (parliamentary record) | Highest | Page fetched; only the first 100,000 of 183,479 characters were read |
| S3 | Bolt & van Zanden, Maddison Project Database 2023, via Our World in Data CSV `gdp-per-capita-maddison-project-database` (int-$ 2011 prices) | Scholarly reconstruction | Medium (modelled; several 1880 values are interpolated; no Japan/China 1880 value exists in the series) | CSV downloaded and read |
| S4 | Mulhall, *Dictionary of Statistics* (1884 ed.; archive.org `dictionarystati00mulhgoog`), pig-iron table | Contemporary compilation | Low-medium: the OCR is badly damaged (digit 2 reads as 9, 1 as x). Only the five-column 1880 pig-iron row whose parts sum to its printed total is used | Row reconstructed and sum-checked in section 4 |
| S5 | B. A. Elman, "Naval Warfare and the Refraction of China's Self-Strengthening Reforms into Scientific and Technological Failure, 1865-1895" (Modern Asian Studies 38:2, 2004), `https://www.princeton.edu/~elman/documents/Naval_Warfare_and_the_Refraction_of_China's_Self-Strengthening_Reforms.pdf` | Scholarly article | High for structure; much of its funding evidence is 1885-94 (later period) | Text extracted with `pypdf`; page tags are PDF page indices |
| S6 | Repo: `content/production/1880/{economies,countries}.yaml`, `packages/campaign/src/nationCompilation.ts`, `packages/phase-engine/src/economyPhases.ts`, `packages/campaign-engine/src/projection.ts`, `balance.yaml` (`treasuryUnitMicro`) | First-party | Authoritative for what the engine does | Read directly |

Not obtained (stated so nothing is silently assumed): Austrian-Hungarian, Spanish and Qing
naval appropriations for 1880; any Japanese figure for 1880 itself (S1 stops at FY1877-78);
Hansard lines beyond character 100,000; Kennedy/Mitchell tables (not openly readable here).
A web search for Kennedy-attributed tonnage (theworldwars.net) returned a secondary table
that could not be checked against the book, so it is not used.

Page numbers are the Year-Book's own, read from the nearest running header, and can be off by one or two pages; Elman page tags are PDF indices.

Conversion note: S1 prints its own sterling equivalents. Implied rates: 25 francs, 25 lire,
25 pesetas, 20 marks, 7 roubles (paper), 5 dollars and 5 yen to the pound. One campaign
treasury unit is GBP 10,000 (`balance.yaml` `treasuryUnitMicro`, S6), so GBP 1 million = 100 units.

## 2. Engine facts that decide how evidence can be used (S6)

1. `economies.yaml` gives per nation `treasury`, `income`, `expenses`. Compilation copies them
   (`nationCompilation.ts:223-243`) but hard-codes `baseResources: 0` and
   `navalAppropriationRateBp: 2000` (20 %) for every nation. `countries.yaml`
   `gdpTier` / `budgetLevel` / `industrialBase` are narrative strings and are not read into any number.
2. The monthly revenue phase (`economyPhases.ts` `runMonthlyRevenuePhase`) pays
   `baseResources * rateBp / 10000 / 12`; with `baseResources = 0` revenue is 0 for all nations in
   production data. The construction cap is `baseResources / 12 / 100` (`computeConstructionCap`),
   also 0, and does not read yards or ports.
3. The player-facing projection and opening briefing use a different path:
   `scaleValue(income, navalAppropriationRateBp)` per month (`projection.ts:166`,
   `opening-briefing.ts:197`), i.e. authored `income x 20 %` per month. `designStudies.ts:170`
   reads `treasury - expenses`. So `income` is live only in projections and `expenses` only there.
4. The N-2 brief lists "Portugal/Netherlands negative treasury" as a known S-1 baseline defect
   (`.ai/briefs/n-2-1880-content-completion.md`, Out of scope).

Consequence for R4: the unit and period of `income` are undefined by the repo. Section 5 tests one
hypothesis against the evidence: authored `income` is a monthly naval-appropriation figure in
GBP 10,000 units, so 12 x `income` should approximate an annual naval vote.

## 3. Fiscal evidence per nation (all from S1 unless stated)

Budget years differ by nation and are shown. "Navy" is the naval vote as printed; for France and
Portugal the ministry is "Marine and Colonies", so colonial cost is inside the figure and cannot be separated.

| Nation | Budget year | Revenue (GBP m) | Navy vote (GBP m) | Navy share of expenditure | Army/war vote (GBP m) | Page |
|---|---|---|---|---|---|---|
| UK | 1880-81 estimate | 81.56 | 10.49 (10,492,935; 1879-80 10,586,903; plus a 150,000 supplementary) | 12.9 % of 81.49 | 15.54 (+1.10 India home charges) | 229-230 |
| France | 1880 | 127.14 (3,178,480,098 fr) | 8.51 (212,784,275 fr, Marine and Colonies) | 7.0 % of 122.02 | 22.72 (567,984,444 fr) | 61-62 |
| Germany (Reich) | 1879-80 estimate | 26.54 (Reich only; states keep direct taxes) | about 2.28 (derived, see note) | 8.4 % | 16.06 ordinary + 2.16 extraordinary | 98-100 |
| Russia | 1879 estimate | 89.85 (628,965,708 rbl) | 3.74 (26,195,582 rbl; 1878 25,119,611) | 4.2 % of 628.6 m rbl | 25.9 (181,566,088 rbl) | 372-378 |
| Italy | 1878 estimate (latest itemised) | 57.02 (1,425,583,965 lire) | 1.77 (44,351,411 lire) | 3.1 % of 1,412.7 m lire | 8.12 (202,923,379 lire) | 309 |
| USA | FY ending June 1880 (actual) | 66.71 ($333,526,610) | 2.71 ($13,536,985; FY1881 est. $15.0 m) | 5.1 % of $267.6 m | 7.62 ($38,116,916, "Army and harbours") | 585 |
| Austria-Hungary | 1880 estimate | 60.59 combined (Cisleithania 38.28 + Hungary 22.31) | not itemised in S1 | n/a | not itemised | 14-17 |
| Spain | 1879-80 budget | 31.14 (778,478,388 pts) | not legible in S1 (OCR column loss) | n/a | n/a | 409 |
| Japan | FY1877-78 (latest in S1) | 10.25 | 0.64 (643,500; 1876-77 709,940) | 6.3 % of 10.25 | 1.17 (War) | 703-704 |
| Qing | "recent years" | about 25 (an estimate; S1: "only known by estimates") | not given; army about 15 | n/a | about 15 | 664-665 |
| Portugal | 1880-81 estimate | 6.37 incl. 0.54 loans | 0.359 (Marine and Colonies) | 4.8 % of 7.51 | 0.963 | 348-349 |

Derivations, so the arithmetic is auditable:
- Germany navy: S1 prints total ordinary expenditure 419,022,949 mark but the "Imperial Navy" ordinary
  cell is missing from the OCR. Subtracting the other printed ordinary items (Chancery 5,187,791;
  Reichstag 351,580; Foreign 6,335,925; Army 321,184,910; and the eight listed cells 122,780;
  260,750; 8,482,500; 460,79x; 1,230,540; 17,217,736; 33,015,879; 171,760) leaves about 25,000,008 mark
  (the units digit of 460,79x is unread). Adding the extraordinary navy item 20,614,010 mark gives
  about 45.6 m mark = GBP 2.28 m. Treat as +/- 0.01 m arithmetic but verify against the Reichshaushalt
  before pinning.
- UK debt charge 28,000,000 of 81.49 m (34 %); France "Public debt and dotations" 1,239,161,900 fr of
  3,050,624,818 fr (41 %); Russia debt service 156,577,526 rbl of 628.58 m (25 %, 1879). These are the
  gross-to-disposable evidence for the owner's France/Britain question.
- UK ratios use S2 as a cross-check: Smith states ordinary 1879-80 spending of "nearly 10,550,000"
  and "a slight decrease, and only a slight decrease" for 1880-81, 58,800 men and boys voted, and about
  11,587 tons of hull to be built (12,073 in the year closing). S2 gave no 1880-81 total in the portion read.

Fleet snapshots (S1): France 59 ironclads, 266,662 hp, 2,854 guns, end 1880 (p. 71-72);
Germany 22 ironclads incl. 3 unfinished, 59 other steamers (p. 100-101); Russia 30 ironclads
(28 Baltic, 2 Black Sea), 223 steamers, 188,120 hp, end 1880 (p. 378+); Italy 18 ironclads incl.
*Italia* and *Lepanto* unfinished, end 1880 (p. 313-314); Austria-Hungary 14 ironclads, 37 other
steamers, 5,771 sailors, harbours Pola and Trieste, end 1879 (p. 19-20); Spain 10 ironclads, 73
screw steamers, end 1878 (p. 412-413); USA 61 cruising ships, 20 monitors, 2 torpedo boats, with 5
monitors building, 10 navy yards (p. 590+); Japan 1 ironclad frigate, 2 ironclad corvettes, 2 wooden
corvettes (end June 1878, p. 706); Qing 8 English-built 400-450 t ironclad gunboats of 9 kn (4 in 1877, 4 in
1879), described by S1 as for coast defence (p. 665); Portugal 24 steamers (9 corvettes, 8 sloops, 7
gunboats), the 1,497 t ironclad corvette *Vasco da Gama*, 3,493 sailors and marines, end 1879 (p. 351).

## 4. Industry and income evidence

Maddison GDP per capita (S3, int-$ 2011): UK 5,997; USA 6,256; France 3,379; Austria 3,314; Germany
3,174; Italy 2,796; Spain 2,517; Portugal 1,510; Russia 671 (all 1880). Japan and China have no 1880
value (1870/1890: Japan 1,580/1,854; China 945/964). Source 3 is modelled; the ranking is more reliable than the levels.
Notable: the USA is not "below the leading European powers" on income per head.

Pig iron, 1880, Mulhall (S4, damaged OCR; the five parts sum to the printed 18,140,000 t): UK 7.75 m t;
USA 3.84 m; Germany 2.73 m; France 1.73 m; all others 2.09 m. 1870 USA 1.67 m, UK 5.96 m (same table,
same OCR caveat): USA 2.3 x and UK 1.3 x over the decade. Per-country minors (Austria, Russia, Spain)
are legible only as approximate 0.45-0.47 m t (Austria, Russia) and 0.16 m t (Spain) and are not relied on.

## 5. Test of the repo's authored economy (S6) against the evidence

Hypothesis H-income: authored `income` is a monthly naval figure in GBP 10,000 units. Then 12 x income
(GBP m) should approximate the annual naval vote.

| Nation | Authored income (units/month) | 12 x income (GBP m) | Evidence naval vote (GBP m) | Ratio |
|---|---|---|---|---|
| UK | 100 | 12.0 | 10.49 | 1.14 |
| France | 68 | 8.16 | 8.51 | 0.96 |
| USA | 26 | 3.12 | 2.71 | 1.15 |
| Portugal | 3 | 0.36 | 0.359 | 1.00 |
| Germany | 30 | 3.6 | 2.28 | 1.58 |
| Russia | 55 | 6.6 | 3.74 | 1.76 |
| Japan | 12 | 1.44 | 0.64 (FY1877-78) | 2.25 |
| Italy | 38 | 4.56 | 1.77 (1878) | 2.58 |
| Austria-Hungary, Spain, Qing | 22, 16, 9 | 2.64, 1.92, 1.08 | no evidence in sources read | n/a |

Reading: the UK, France, USA and Portugal rows fit H-income closely; Germany, Russia, Japan and
Italy are authored 1.6-2.6 times above the best 1880 evidence. The same `income` figures do not fit a
total-revenue reading (e.g. France revenue is 156 % of the UK's, authored income is 68 %). H-income is
a pattern in the data, not a repo statement: nothing in S6 documents the period or unit. If it is
the intent, the hard-coded 20 % appropriation rate would discount an already-naval figure
(UK 100 x 20 % = 20 units = GBP 0.2 m per month = GBP 2.4 m per year, one quarter of the 1880 vote).
That is a decision for the ADR, not resolved here. Treasuries (UK 1,000 units = GBP 10 m, about one
UK naval vote) have no 1880 source: no sourced opening cash balance was found for any nation.

## 6. Verdicts on the owner's identity hypotheses

Legend: SUPPORTED / REFINED / REJECTED-for-1880 / UNVERIFIED (no 1880 evidence found).

**Great Britain.** Wealth and naval scale: SUPPORTED (largest revenue among the Powers except France; largest
naval vote 10.49 m, three times the next sourced; 58,800 men voted). "~340,000": UNVERIFIED. No figure of
that size appears in S1 or S2 as a treasury, appropriation, monthly or annual amount; treat it as
unsourced. Do not infer its unit. "High fixed obligations": REFINED. The 1880-81 naval vote is itemised to include dockyards
and yards "at home and abroad", coastguard, medical and victualling establishments (S1 p. 230), so overseas
presence is inside the vote rather than a separate expense; the Treasury view was an easy surplus
(supplementary budget left 381,000 GBP surplus, S1 p. 229) and a "slight decrease" in naval cost (S2).
"Wealthy yet budget-pressured under the same accounting": consistent with the data only through debt charge
(34 % of expenditure) and the lack of any 1880 rival-driven rise; the naval-dominance response (two-power
standard, 1889 Naval Defence Act per `countries.yaml`) is LATER-period evidence, not an 1880 start value or formula input.

**United States.** Valid 1880 start: revenue 66.7 m (82 % of UK), naval vote only 2.71 m (26 % of UK),
navy 5.1 % of expenditure while 73.97 m dollars of surplus retired debt (S1 p. 585-586). "Below leading
European powers": REFINED. True of the navy, false of the economy (per-capita income above the UK in S3).
"~115,000": UNVERIFIED and, as the owner notes, a 1890 figure; no 1880 support. Growth form: pig iron 2.3 x
in 1870-80 supports strong growth but yields no bound; bounds on compounding and the benchmark are a later
growth-system decision. The binding feature at 1880 is political (Naval Appropriation Bill of 1876 cut the
enlisted force, S1 p. 590+), not resource scarcity.

**France.** Strength: SUPPORTED (largest revenue, 59 ironclads). "Constrained": SUPPORTED by the debt service share
(41 % of expenditure) and a war vote 2.7 x the naval one. "~200,000": UNVERIFIED. Colonial/distributed burden:
cannot be separated from naval cost because the ministry is "Marine and Colonies" (Algeria is a separate service,
27.5 m francs); authored `expenses` (26) are not an evidenced colonial figure. Gross-to-disposable differs from
Britain through debt service share (41 % vs 34 %) and army weight, which is evidence, not a scaling choice.

**Germany.** "Efficient industrial growth": SUPPORTED mildly (pig iron 2.73 m t, second in Europe; income per head
below France and UK). "Compact modern fleet": SUPPORTED (22 ironclads, 3 unfinished; naval expenditure about 8.4 %
of the Reich budget with a large extraordinary component, 20.6 m of 45.6 m mark, i.e. lump funding rather than a
low steady rate). "Fewer colonial obligations": consistent with S1 listing no German overseas possessions in the
passages read, but the passage was not specifically checked; treat as UNVERIFIED here. Does current content
over-grant 1880 Germany? On the H-income test authored income (30) is 1.6 times the best evidence (2.28 m
vs 3.6 m): the fleet is real but the money is somewhat generous. Reich revenue (26.5 m) is not a national
revenue; do not use it as a base resource.

**Japan.** "Small base": SUPPORTED (revenue 10.25 m, 12.6 % of the UK; per-capita income not available for 1880).
"High naval prioritisation vs total resources": REJECTED-for-1880 on the evidence read. The naval share was 6.3 %
of expenditure against 11.4 % for the army (FY1877-78), comparable to France (7.0 %) and above the USA (5.1 %), and
the fleet was 3 ironclads plus 2 corvettes. A search snippet states Japanese military spending was 19 % of government
expenditure in 1880 and rising to 31 % by 1890 (unfetched secondary, lead only). The 1882 expansion program
is later evidence of prioritisation. "Do not invent strategic-risk effects": none found or needed.

**Russia.** Large base: SUPPORTED in aggregate (revenue 89.85 m; 110 % of UK) but weakest per-head income in the set
(671 int-$). "Restricted/unreliable naval funding, land competition": SUPPORTED. Navy 4.2 % of expenditure,
war 28.9 %, war:navy 6.9 : 1 (UK 1.5 : 1, France 2.7 : 1, Italy 4.6 : 1). Debt service 25 %. The rouble was an
inconvertible paper currency with a "prospect of the resumption of specie payments" (S1 p. 377), which is the
documentary basis for volatility; a magnitude of volatility is not sourced. Soviet-era material excluded.

**Italy.** "Mid-to-low budget, regional concentration": REFINED. Revenue 57.0 m is the fourth largest of the sourced
set but naval vote is only 1.77 m (3.1 %), against 18 ironclads including the two largest ships under construction
(*Italia*, *Lepanto*, 14,000 t, 100-ton guns, S1 p. 313-314). "Fewer global obligations": consistent (no colonial
vote line at this date in the passages read; unchecked). Fiscal state: deficits every year from 1861 to 1877, a
small surplus in the 1878 estimate and an estimated 32.4 m lire deficit in 1879 (S1 p. 308-309), so the
state is chronically but mildly stressed, not "intentionally solvent". Authored income (38) is 2.6 times
the 1878 evidence; the Italian row is the largest H-income outlier.

**Austria-Hungary.** "Restricted finances": REFINED. Combined revenue 60.6 m is larger than Italy's, but debt interest
alone took 11.29 m of the Cisleithan 41.18 m expenditure (27 %), with a floating debt of about 67 m and a 0.80 m
Bosnia occupation charge (S1 p. 14-17). Naval vote not obtained. "Limited naval-industrial base / Adriatic defensive
fleet": the fleet (14 ironclads, two ports, Pola and Trieste; new ironclads built at the Stabilimento Tecnico, Trieste, S1 p. 19-20)
is SUPPORTED; pig iron about 0.47 m t (legibility caveat). Yards and ports, not the treasury, are the sourced
capacity. In the engine the construction cap ignores yards and ports (section 2 point 2), so the cap formula
cannot express this identity at all, regardless of data.

**Spain.** "Very weak economy": REFINED. Revenue 31.1 m (comparable to Qing estimate, below Italy) and income per
head 2,517 (below Italy's 2,796, above Portugal and Russia), so "very weak" is not supported in relative terms;
the state was fiscally distressed (budget expenditure 32.3 m exceeded revenue 31.1 m; the Minister of Finance had
declared the State "on the verge of bankruptcy" in 1871-72, S1 p. 409). "Slow shipbuilding / small cost-effective vessels":
UNVERIFIED for 1880; the fleet read (10 ironclads, 73 screw steamers including 18 one-gun gunboats and 35
colonial gunboats at Cuba and Puerto Rico, S1 p. 412-413) shows many small ships but the cause is not sourced. Any
"must use small vessels" rule must emerge from costs, not be encoded.

**Qing.** Use Qing-era evidence only. "Large aggregate resources, weak effective naval funding": SUPPORTED on
structure. Estimated receipts about 25 m with the army costing about 15 m and customs the only published item
(12.48 m haikwan taels, 3.745 m GBP, 1878, S1 p. 664-665). Naval funding came from customs duties and likin
(provincial inter-provincial trade tax) attached to particular yards, not a central naval vote (S5; Fuzhou's
planned 600,000 taels a year operating cost met only in part, 400,000 taels raised from Fujian customs, with a further
50,000 a month, "perpetual financial bind", S5 p. 15-16; compound engines not built until 1877 "because of the lack of
funds"). Fragmentation: regional leaders (Zeng, Li, Zuo, Zhang) ran separate arsenals (S5). Obligations: the army dominates
spending (S1). Technology: the fleet in 1880 is eight imported gunboats (S1). Volatility: no 1880 magnitude. The post-1885
Navy Board vs Beiyang funding competition and the Summer Palace diversion debate (S5, concluding pages) are LATER-period
evidence. Distinguishing from Spain: Qing is regionally funded and import-dependent, Spain is a unitary budget with
domestic yards. The sources give no quantity for either.

**Portugal.** Not playable in current content. Tier: poor (revenue 6.37 m, income per head 1,510, lowest of the set bar Russia). Opening
solvency: NOT solvent on the 1880-81 budget (expenditure 7.511 m against 6.366 m revenue including 0.542 m loans;
estimated deficit 1.145 m = 15 % of expenditure; S1 p. 349). Naval resource: the Marine and Colonies vote, 0.359 m
(36 units a year). Fleet: 24 steamers and one 1,497 t ironclad corvette (S1 p. 351). Is "affords a sloop" valid? Not
established: no sloop cost was sourced for 1880, and the budget evidence makes a sustained build programme an unsupported assumption.
Failure causes in the engine, in order of evidence: (a) compiler default `baseResources = 0`, so no revenue from the
revenue phase for anyone; (b) unit/period mismatch: authored income 3 per month versus an annual vote of 36 units (H-income
fits, so "income" is not an annual treasury figure); (c) projection applies 20 % to an already-naval income, shrinking 3 to
0.6 units a month, below authored expenses of 2; (d) treasury 40 units (about 1.1 years of the Marine and Colonies vote)
is not a sourced balance. Treasury cash flow and construction capacity are not separable from (a)-(c). The content
claim that the 1880 programme is funded by London loans is supported only generally by the loan line (0.542 m) in S1.

## 7. Cross-cutting findings for the ADR

1. No source read gives an 1880 opening cash balance for any navy: all `treasury` values are balance choices.
2. The evidence supports a *ranking* of annual naval votes (UK >> France > Russia > Germany ~ USA > Italy > Japan ~ Portugal)
   but not Austria-Hungary, Spain or Qing, for which three sourced numbers are still missing.
3. Burden evidence that is documented rather than inferred: debt service share (UK 34 %, France 41 %, Russia 25 %,
   A-H Cisleithan 27 %), war:navy ratio (UK 1.5, France 2.7, Italy 4.6, Russia 6.9), and
   ministry bundling ("Marine and Colonies" in France and Portugal).
4. The repo cannot express yard-based capacity: `computeConstructionCap` depends only on `baseResources`.
5. Hypothesis numbers in the owner brief (340,000; 200,000; 115,000) have no match in any source read.
6. Later-period facts kept out of start values: 1889 Naval Defence Act, 1890 US figure, 1882 Japanese programme,
   post-1885 Qing funding, Soviet conditions.

## 8. Open items (each a bounded follow-up)

- Austria-Hungary, Spain and Qing 1880 naval appropriations: Austrian Delegations common-budget Marine item
  (Sondhaus, *The Naval Policy of Austria-Hungary*, Purdue UP 1994 holds it); Spanish "Presupuesto de Marina 1879-80"; Chinese
  Maritime Customs/Board of Revenue records.
- Japan 1880 naval vote (Meiji fiscal-year tables).
- Germany navy ordinary cell: confirm 25.0 m mark from the Reichshaushalt 1879-80.
- Hansard S2 remainder (characters 100,000+) for a stated 1880-81 total and for any "other Powers" comparison by Reed.
- UK 1880 pig iron, shipbuilding output and merchant tonnage from a legible source to evidence yard capacity.
