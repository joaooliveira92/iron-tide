# S-5 presence, foreign stations and base limits — value grounding

Status: new research note, created 2026-10-20 by S-5 ticket 01 (issue #75, spec #73,
requirement R14). It grounds the gated S-5 values in `docs/research/` style: every value
is either a verbatim manual quotation with page and units, or marked **UNSOURCED**. It
extends [`rtw3-manual-baseline.md`](rtw3-manual-baseline.md) and
[`s-1-readiness-and-maintenance.md`](s-1-readiness-and-maintenance.md) and does not rewrite
them. It chooses no value and fixes no behaviour: decision requests 0016 to 0023 return
each unsourced value to the owner (ADR-0210, ADR-0223, ADR-0226 precedent).

## Source and method

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf` (authority order 3, ADR-0210). Text
  extracted page by page with `pypdf` 6.14.2 (148 pages) into a temp directory outside the
  repository (not tracked). Citations are the manual's **printed page number** (PDF page
  index + 1), as in the S-1 note.
- Pages re-read in full for this note: pp.13, 42, 45, 46, 47, 48, 62, 70, 128, 129, 130, 138. A text search of all 148 pages for "base value", "base capacity", "bases",
  "foreign station", "colonial", "revolt", "home area", "home water", "garrison" found only
  the further passages quoted below (pp.49, 50, 59, 71, 5/6 contents); no page gives a
  number for any value in this note's table.
- Repo sources consulted: spec #73, ticket #75, decisions #58 to #72 (as summarised in the
  spec), ADR-0213, ADR-0223, ADR-0226, ADR-0239, ADR-0240, decision requests 0007 and 0012.
- Units are stated only where the manual states them. The manual states **no** units for
  tonnage required, base value, possession value or any penalty; it uses "tonnage",
  "displacement" and "1.5 times" only.

## Quoted evidence (verbatim)

Each quotation is reproduced exactly from the extraction; line breaks are joined.

- **p.13:** "The world is divided into areas. In each area there are a number of possessions
  that can be controlled by one of the player nations, or be neutral. Possessions have naval
  bases and can have coastal artillery or other defences. The base values and
  fortifications of possessions can be improved by the player." And: "Each possession has a
  value that is used when calculating the budget effect of acquiring or losing
  possessions."
- **p.42:** "Equipping a ship for colonial service takes up a proportion of displacement,
  which simulates increased marine contingent, storage spaces and other facilities useful
  for extended service on foreign stations." And: "Cramped accommodation saves weight, but
  will affect crew quality negatively if ships are outside of home waters."
- **p.45:** "Ships are deployed in an area, either a home area or on a foreign station. The
  number of ships that can be deployed in an area is dependent on the base value of the
  area. The number can be exceeded, but this may cause ships to suffer from maintenance
  problems and reduced crew quality. If a nation has no bases in an area, only a very
  limited number of ships can be deployed, representing single cruisers and the like that
  coal at bases of friendly or neutral nations." And: "Base limits are checked at the end of
  the turn. That means that you can move a fleet into an area where you have insufficient
  bases and fight a battle before the ships start to suffer from lack of bases."
- **p.46:** "Nations are required to have a minimum naval presence in each area where they
  have possessions. This is expressed as a tonnage required in each area, and is dependent
  on the number and value of the possessions owned by the nation. Only active ships or
  ships on foreign stations status (see below) count for the purpose of calculating the
  naval presence in an area. If the required number is not met, player prestige may suffer
  and it might even lead to revolts in the affected areas." / "Ships equipped for colonial
  service count as 1.5 times their tonnage on foreign stations." / "Ships with cramped
  accommodation and ships with short range are less useful on foreign stations and will
  count as less than their actual displacement for the purpose of fulfilling this
  requirement." / "During wartime, the deployment requirements at foreign stations are not
  enforced if you are under blockade."
- **p.47:** "Fulfilling the requirements for ships at foreign stations can be done either
  manually by moving ships to the relevant areas, or by simply assigning them to Foreign
  Station status, whereupon the AI will move the ship to a suitable area."
- **p.48:** "L = Long range / S = Short range / c = Equipped for colonial service / a =
  Cramped accommodation"; "FS = On foreign station"; "* after the status means the ship
  needs maintenance and should return to an area with sufficient base capacity."
- **p.49:** "Short range ships cannot move strategically during wartime except between
  adjacent home areas (e.g. North American East Coast and Caribbean for the USA)."
- **p.50:** "If a nation is blockaded, ships are not allowed to move out of the home port
  unless as raiders."
- **p.59:** "Global naval power: Nation must keep at least 10% of tonnage on foreign stations,
  cannot have cramped crew quarters." (a national characteristic; see the note under row 1)
- **p.62:** "Prestige loss is in most cases proportional, which means that if you have high
  prestige, you will lose more of it on an event that results in prestige loss." /
  "A high unrest level will lead to strikes and demands for lowered military budget, and in
  wartime can lead to revolution and defeat. Revolution is less likely in liberal
  democracies." Unrest is raised by "Cramped accommodation in ships" and "Being under
  blockade" among others.
- **p.70:** "To blockade a nation, you must have 110% of the enemy's naval strength in the
  build area of the enemy nation." / "A blockaded nation will not be able to move ships out
  of its build area, except as raiders" / "Russia, which has home area in Baltic Sea, can be
  blockaded from Northern Europe".
- **pp.128 to 130, 138:** p.128 and p.129 (Q&A, player notes) add nothing on S-5 values
  beyond design advice. p.129: "If you have a nation with widespread colonies ... you might
  consider a colonial cruiser. This would be equipped for colonial service". p.130: "we can
  live with cramped accommodation and short range, as it will only be operating in home
  waters"; "the colonial gunboat. This will be a corvette with 1500 tons displacement or so,
  equipped for colonial service. This makes it good for fulfilling obligations to have
  tonnage on foreign stations, freeing up cruisers." (1500 tons is a design hint for a
  gunboat's displacement, **not** a colonial-service proportion or a requirement value.)
  p.138: "F: foreign stations" is the hotkey in the ship-in-service tab.

## Provenance table

Class: **SOURCED** = the manual states the value (exact quotation, page, units);
**STRUCTURE ONLY** = the manual states that the quantity exists and what it depends on, but
no number; **UNSOURCED** = the manual is silent ("not supplied"). Only the first class can
be authored as a manual-grounded value. Every row marked STRUCTURE ONLY or UNSOURCED
returns to the owner (last column).

| #   | Gated value                                                                 | Class                    | Manual evidence (page, units)                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Return            |
| --- | --------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Tonnage required per area, as a function of number and value of possessions | STRUCTURE ONLY           | p.46: "expressed as a tonnage required in each area, and is dependent on the number and value of the possessions owned by the nation". Unit: tonnage (the p.46 context counts ships by displacement). No formula, coefficient, per-possession value, floor or cap is supplied. The only numeric neighbour is p.59, "at least 10% of tonnage on foreign stations" for the Global naval power characteristic: a fraction of a fleet, for one characteristic, not a per-area function. | 0016              |
| 2   | Possession value (an input to row 1)                                        | STRUCTURE ONLY           | p.13: "Each possession has a value that is used when calculating the budget effect of acquiring or losing possessions." Whether that same value feeds the presence requirement is not stated; no possession values are supplied. The repo's `possessions.yaml` carries no value field.                                                                                                                                                                                              | 0016              |
| 3   | Base value source                                                           | STRUCTURE ONLY           | p.13: "Possessions have naval bases"; "The base values and fortifications of possessions can be improved by the player." p.45: limit "is dependent on the base value of the area". The manual does not say how an area's base value is built from its possessions' or ports' bases. Repo candidate input, not a manual mapping: `content/production/1880/ports.yaml` `level` (integer 1 to 10, `PortSchema`).                                                                       | 0017              |
| 4   | Base value to ship-count limit mapping                                      | UNSOURCED (not supplied) | p.45 states only that the number deployable "is dependent on the base value of the area". No mapping, table or unit of count (ships vs tonnage) is given; "number of ships" is the manual's wording.                                                                                                                                                                                                                                                                                | 0017              |
| 5   | No-base limit                                                               | STRUCTURE ONLY           | p.45: "only a very limited number of ships can be deployed, representing single cruisers and the like". "Very limited" and "single cruisers" give no integer.                                                                                                                                                                                                                                                                                                                       | 0017              |
| 6   | Which readiness states occupy a base slot                                   | UNSOURCED (not supplied) | p.45 says "ships ... deployed in an area" and p.48 shows `*` beside the status of a ship; neither says whether reserve, mothballed, working-up or repair ships count against the limit.                                                                                                                                                                                                                                                                                             | 0018              |
| 7   | Over-base maintenance effect                                                | STRUCTURE ONLY           | p.45: "may cause ships to suffer from maintenance problems"; p.48: `*` "needs maintenance". Direction only; no multiplier, no charge, no unit. S-1 exposes maintenance as basis-point multipliers (ADR-0223) but no manual value feeds them.                                                                                                                                                                                                                                        | 0019              |
| 8   | Over-base crew-quality effect                                               | STRUCTURE ONLY           | p.45: "reduced crew quality". Direction only; no amount, rate or floor. The manual names no crew-quality scale (S-1 note).                                                                                                                                                                                                                                                                                                                                                          | 0019              |
| 9   | Timing of the base check                                                    | SOURCED                  | p.45: "Base limits are checked at the end of the turn" (end of the monthly turn, after battles). Quotation in the evidence list; no number.                                                                                                                                                                                                                                                                                                                                         | none              |
| 10  | Cramped and short-range counting fraction                                   | STRUCTURE ONLY           | p.46: such ships "will count as less than their actual displacement". Direction only: the fraction is less than 1; no value, and no statement whether cramped and short-range combine.                                                                                                                                                                                                                                                                                              | 0020              |
| 11  | Colonial-service tonnage multiplier                                         | SOURCED                  | p.46: "Ships equipped for colonial service count as 1.5 times their tonnage on foreign stations." Unit: multiplier on tonnage, applied on foreign stations only. Value 1.5 (= 3/2) is stated by the manual.                                                                                                                                                                                                                                                                         | none              |
| 12  | Colonial-service displacement proportion                                    | STRUCTURE ONLY           | p.42: "takes up a proportion of displacement". No fraction is given. The p.130 "1500 tons or so" is a gunboat size hint only.                                                                                                                                                                                                                                                                                                                                                       | 0021              |
| 13  | What counts toward presence                                                 | SOURCED                  | p.46: "Only active ships or ships on foreign stations status ... count". No number.                                                                                                                                                                                                                                                                                                                                                                                                 | none              |
| 14  | Blockade exemption (existence and condition)                                | SOURCED                  | p.46: "During wartime, the deployment requirements at foreign stations are not enforced if you are under blockade." p.70 gives the blockade rule (110% of the enemy's weighted strength in the build area; Britain x1.2, Russia x0.7). The exemption names "deployment requirements at foreign stations" (areas of possessions); it is not stated whether it also covers the home area (row 16).                                                                                    | 0022 (scope only) |
| 15  | Home-area requirement exists                                                | UNSOURCED (not supplied) | p.46 requires presence "in each area where they have possessions". The manual never says whether the home area, which usually contains possessions, is excluded (p.45 distinguishes "a home area" from "a foreign station"; p.59 says "foreign stations" for the 10% rule).                                                                                                                                                                                                         | 0022              |
| 16  | Exemption of a home requirement                                             | UNSOURCED (not supplied) | Follows from row 15. p.50 and p.70 say a blockaded nation cannot move ships out of its home or build area, which bears on the plausibility of the exemption but states no rule.                                                                                                                                                                                                                                                                                                     | 0022              |
| 17  | Prestige-loss magnitude for a presence shortfall                            | STRUCTURE ONLY           | p.46: "player prestige may suffer". p.62: loss "is in most cases proportional". The proportion is not supplied; ADR-0239 chose its own balance values for battle and funds losses and expressly excluded presence ("trade, presence and officer costs (later ...)").                                                                                                                                                                                                                | 0023              |
| 18  | Revolt-pressure magnitude                                                   | STRUCTURE ONLY           | p.46: "it might even lead to revolts in the affected areas". p.62 lists unrest drivers; presence shortfall is **not** among them, and no magnitude exists.                                                                                                                                                                                                                                                                                                                          | 0023              |
| 19  | Revolt trigger                                                              | UNSOURCED (not supplied) | p.46 says "might" (non-deterministic) and "in the affected areas" (per area). No threshold, probability, duration or definition of a revolt in an area is given. p.62 describes revolution of the nation, a different event.                                                                                                                                                                                                                                                        | 0023              |

Spec #73 names one more engineering reading, "which area is suitable" for FS routing (p.47, "a
suitable area"). Decision G (#69) already treats this as an engineering reading; the manual
gives no definition and none is returned here.

## Values the manual supplies (the complete list)

Only these S-5 facts carry a manual number or rule and may be authored as grounded:

1. Colonial-service ships on foreign stations count **1.5 times their tonnage** (p.46).
2. Only **active** ships or ships **on foreign stations** count toward presence (p.46).
3. Base limits are checked at **end of turn**, after battles (p.45).
4. Requirements are **not enforced in wartime under blockade** (p.46).

Everything else is structure without a number, or silent. In particular the manual supplies
no tonnage-required formula, base-limit mapping, no-base integer, occupying states,
over-base magnitudes, cramped/short-range fraction, displacement proportion, home-area rule,
prestige or revolt magnitude or revolt trigger.

## Value shape for later tickets (inputs and units only, no numbers)

For tickets 78, 79, 82 and 85, the single optional ruleset section (R11) needs these
parameters. Shapes only; no value is implied.

- **Tonnage required** (per nation and presence area): inputs are the count of the nation's
  possessions in the area (integer count) and each possession's value (a content-supplied
  non-negative integer, unit undefined by the manual; no such field exists today). Output
  is a tonnage in the same integer displacement unit as ship tonnage. The function's shape
  (additive per possession, scaled, floored, capped) is the open item.
- **Base value** (per nation and area): input is the base level of the nation's ports or
  possessions in the area (integer; repo candidate is port `level`, 1 to 10). Output is a
  non-negative integer **ship count** (the manual's wording is "number of ships").
- **No-base limit**: one non-negative integer ship count.
- **Base-slot occupancy**: a set over the five S-1 readiness states (boolean membership).
- **Over-base consequences**: a maintenance adder in basis points of the S-1 rate (integer
  bp, per month, per over-limit ship) and a crew-quality reduction in the S-1 integer crew
  scale (0 to 100, per month, per over-limit ship). Both are applied through the S-1
  constants seam.
- **Counting fraction** for cramped and for short-range: integer basis points of tonnage,
  strictly below 10_000; whether the two combine (multiply, minimum, or either) is open.
- **Colonial-service multiplier**: the sourced 3/2, exact rational, applied to tonnage.
- **Colonial-service displacement proportion**: integer basis points of design
  displacement.
- **Home-area flag**: boolean, whether the home area carries a requirement; and a boolean,
  whether the blockade exemption covers it.
- **Penalty parameters**: prestige-loss request magnitude as integer basis points of current
  prestige (the manual says proportional) or an integer count; revolt-pressure request as
  an integer magnitude in S-3's unrest unit; revolt trigger as a typed condition owned by
  S-3 (threshold on a per-area counter or a probability in basis points). S-5 only emits
  requests (R8).
- **Provenance** per value (R14): `manual` with page, or `balance_adjustment` (ADR-0213)
  with owner reference. Absent section means dormant (R11).

## Recommendations

- Author only the four manual-supplied rules above as grounded; keep every other value
  dormant until the owner answers its decision request.
- Do not reuse prestige or unrest numbers from ADR-0239 or ADR-0240 for presence: both
  decisions exclude presence, and reuse would present a different mechanic's balance value
  as sourced.
- Do not read the p.59 "10% of tonnage on foreign stations" as the general requirement
  formula; it is a per-characteristic floor for one national characteristic and is silent on
  areas.
- If the owner waives RTW3 fidelity under ADR-0213, each admitted value must be labelled
  `balance_adjustment` and never `manual`; that is an owner option in the decision
  requests, not an adopted position.

## Unsourced values and decision requests

| Request                                                                                        | Values returned                                                              |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [0016](../../.ai/decision-requests/0016-s-5-presence-tonnage-required-formula.md)              | Tonnage-required function and possession value (rows 1, 2)                   |
| [0017](../../.ai/decision-requests/0017-s-5-base-value-limit-mapping-and-no-base-limit.md)     | Base value source, limit mapping, no-base limit (rows 3 to 5)                |
| [0018](../../.ai/decision-requests/0018-s-5-base-slot-occupying-readiness-states.md)           | Readiness states occupying a base slot (row 6)                               |
| [0019](../../.ai/decision-requests/0019-s-5-over-base-maintenance-and-crew-quality-effects.md) | Over-base maintenance and crew-quality effects (rows 7, 8)                   |
| [0020](../../.ai/decision-requests/0020-s-5-cramped-and-short-range-counting-fraction.md)      | Cramped and short-range fraction (row 10)                                    |
| [0021](../../.ai/decision-requests/0021-s-5-colonial-service-displacement-proportion.md)       | Colonial-service displacement proportion (row 12)                            |
| [0022](../../.ai/decision-requests/0022-s-5-home-area-requirement-and-blockade-exemption.md)   | Home-area requirement and its blockade exemption (rows 15, 16; row 14 scope) |
| [0023](../../.ai/decision-requests/0023-s-5-presence-penalty-magnitudes-and-revolt-trigger.md) | Prestige, revolt-pressure magnitudes and revolt trigger (rows 17 to 19)      |

Eight requests, since the p.46 penalty group and the home-area group are each tightly
coupled; rows 17 to 19 cannot be chosen independently (S-3 owns revolts).
