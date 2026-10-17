# U-1 canonical values: units, money, options, and locale in the RTW3 manual

Status: new research note, created 2026-10-16 for the U-1 "Canonical values" sprint.
Companion to `docs/research/rtw3-manual-baseline.md`; it does not restate that note's
general mechanics and cites only the U-1-relevant passages (units, money, options,
locale). Per ADR-0202 the manual's values are display facts, not canonical storage.

## 1. Source and method

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf` (the RTW3 game manual, 148 pages).
- Method: page-by-page text extraction with `pypdf` 6.14.2 (same tool/version as the
  baseline note); the extraction is a working copy under a temp dir, not a tracked
  artifact. Page numbers below are the manual's printed page numbers, which match the
  PDF page index in these ranges (baseline note, "Source and method").
- Cross-check of the code's current canonical conventions (not from the manual):
  `packages/campaign/src/designUnits.ts` (kg, µm, µm/s; ADR-0037) and
  `content/production/1880/ship-building/balance.yaml:778-780` (`treasuryUnitMicro`,
  one treasury unit = GBP 10,000).

## 2. Budget and money in the manual

Every money passage is generic: the manual labels amounts "budget", "money", "funds",
or "surplus" and never attaches a currency symbol or unit to any figure.

- p.12 — "You will have a yearly naval budget at your disposition"; base resources
  "increase steadily at about 3-5% a year as a result of economic growth." Prestige
  "can to some extent be seen as a currency" — a simile for prestige, not money.
- p.13 — budget also gets an addition from colonies; colonial income "will decrease
  over time"; "Your yearly budget will be divided into monthly payments to the navy";
  the player "can run up a surplus and save money for future expenses." Naval-budget
  *share* rises in high tension (a percentage, not an amount).
- p.19 — "The budgets given to the different nations are somewhat compressed ... and
  not totally historical"; "If you want to play with more historical budgets, there is
  an option for that in the 1900 campaign start." (The 1900 start is out of scope;
  sole start is 1880 per ADR-0201.)
- p.21 — legacy-fleet building gives "an amount of money as your starting funds";
  under-construction ships start "about 50% complete" and "you only pay 5% of the cost
  for work already completed" — both figures relative, no currency unit.
- p.62 — "The amount of money spent for naval and military purposes is the most
  important factor" — again generic, no unit.

Costs elsewhere are expressed as *relative percentages*, never absolute money: repair
"about 2 times" active maintenance (p.51); wartime maintenance "rise[s] sharply"
(p.52); special training "30%", "20%", "20%", "20%" increases to maintenance (p.53);
legacy work "5%" (p.21). The manual gives no absolute price list and no unit symbol.

## 3. Measurement units and options

- p.18 (Measurements) — verbatim: "Measurements in the game are given in imperial
  measurement units. Gun calibres and armour thicknesses are in inches, ranges are in
  yards, bomb weights in pounds. These measurements were chosen because they are
  commonly used in naval history works, and should be familiar to the majority of
  naval warfare enthusiasts." Note "pounds" here is *weight*, not currency.
- No metric option is described. A search of all 148 pages found no metric/kilogram/
  kilometre/tonne display discussion; the only "metric" substring is "asymmetric" (p.30).
- p.19 (Options) — the listed options are research speed (<100% slows research), varied
  technologies (none/some/considerable), a specific option to slow air development, and
  historical budgets. No unit, currency, language, or locale option is described. The
  contents list "Options 19" with no measurement or currency subsection (contents pp.3-6).

## 4. Currency / display

- The manual never names or displays a national currency. Full-text scan: `£`, `$`,
  `€`, `¥`, and the words francs/marks/lire/roubles/rubles/yen all return zero hits.
  The apparent hits for "franc"/"pound"/"rouble" are word fragments ("France",
  "impounded" p.33, "trouble" p.58/143).
- p.12 and p.61 both use "currency" only metaphorically for *prestige*: "Prestige can
  be seen as a currency, which can be spent to affect various events."
- The closest the manual comes to a historical-money concept is the 1900-only
  "historical budgets" option (p.19), which varies budget *values*, not currency units,
  and is outside the 1880 scope.
- Conclusion: the manual is silent on displaying national currencies (pounds, francs,
  marks, lire, rubles, yen). It neither offers nor forbids such a mode.

## 5. What the manual does NOT supply (relevant to U-1)

- No internal representation: no fixed-point, integer, or precision rule for money or
  any quantity. Canonical storage (integer treasury units; kg/µm/µm/s) is an engine
  decision (ADR-0202, ADR-0037), not a manual fact.
- No rounding or number-formatting rule; costs appear only as relative percentages
  (pp.21, 51-53).
- No unit-conversion table for the imperial preset and no metric alternative (p.18).
- No national currency symbols, decimal/grouping conventions, or exchange-rate tables;
  no per-nation money configuration (pp.12-13, 19, 61-62).
- No locale/language model: the manual is English-only and never separates UI language
  from number/date locale (no such option on p.19 or in the contents pp.3-6).
- No "pounds sterling" vs "pounds weight" disambiguation — the one "pounds" is weight
  (p.18), so the manual cannot ground any monetary pound.

## 6. How this grounds sprint U-1

U-1's acceptance criteria map to the manual as follows; where the manual is silent the
grounding must come from the ADRs, not the manual.

- **Canonical unit table** — the manual fixes the *default display preset* only:
  imperial — inches (calibre/armour), yards (range), pounds (bomb weight) — "because
  they are commonly used in naval history works" (p.18). It does not specify canonical
  storage; kg, µm and µm/s come from `designUnits.ts`/ADR-0037 and ADR-0202. U-1 should
  cite p.18 for the `measurementPreset` default and its rationale, never as the storage
  spec.
- **Fixed-precision money** — manual gives no representation; ground in ADR-0202 and the
  existing integer treasury convention (`balance.yaml:778-780`: one treasury unit =
  GBP 10,000; `treasuryUnitMicro` = 10^10 micro-pounds, i.e. 10^6 micro per £). This is
  code/ADR grounding, explicitly NOT a manual figure.
- **Rounding / number-format boundaries** — manual is silent (costs are relative %,
  pp.21, 51-53). U-1 defines rounding and the format boundary from ADR-0202/ADR-0203
  (conversion only at the presentation boundary).
- **Currency display modes** — manual offers none; Naval Credits / Budget Points /
  National Historical are project decisions (ADR-0206/0207/0211), with custom currency
  excluded (ADR-0208). The manual's "historical budgets" (p.19) is a 1900-only budget
  option, out of 1880 scope, and must not be read as a currency mode.
- **Language vs locale** — manual is silent; the separation of UI language from
  formatting locale is ADR-0209, not a manual fact.

## Deferred

- **National Historical currency values (per nation/period): the manual cannot ground
  them.** ADR-0211 requires a validated per-nation configuration (symbol, position,
  decimals, grouping, scale, period, source) before National Historical is selectable,
  and flags release readiness for the nine nations. That data needs an owner and
  primary historical sources (national finance/statistics works), not this manual. Not
  resolved here.
- **No decision-request is needed for the rest**: the manual's silence on storage,
  rounding, and locale is already covered by accepted ADRs (0202/0203/0206/0207/
  0208/0209/0211), so it is a documented boundary, not an open decision.
