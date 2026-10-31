# W-1 trade protection, raiders and merchant losses — value grounding

Status: recovered research note, created 2026-10-31 by research issue #405
(parent map #404, decision issues #406 to #409). The issue's original note was left on the
throwaway branch `research/w-1-trade-warfare` and never merged; that branch no longer exists
locally or on `origin`. This note re-derives the findings from the same primary source. It
extends [`rtw3-manual-baseline.md`](rtw3-manual-baseline.md),
[`rtw3-prestige-values.md`](rtw3-prestige-values.md) and
[`s-5-presence-and-base-limits.md`](s-5-presence-and-base-limits.md), and does not rewrite
them. It chooses no new behaviour: it separates what the manual states from what the locked
decisions supplied as engineering or balance parameters.

## Source and method

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf` (authority order 3, ADR-0210). Text
  extracted page by page with `pypdf` 6.14.2 (148 pages) into a temp directory outside the
  repository (not tracked). Citations are the manual's **printed page number**, which is the
  PDF page index + 1; the printed header was checked on every quoted page.
- Pages re-read in full for this note: pp.34, 35, 36, 41, 44, 47, 48, 50, 59, 60, 61, 62,
  67, 69, 70, 71, 72, 73, 77, 119, 129, 130, 133, 138. The section is pp.70 to 72; the
  neighbouring pages are included because they own inputs or consequences (submarine
  strategy, range and engine reliability, blockade, prestige and unrest).
- Text search of all 148 pages for "trade protection", "raider", "merchant", "shipping",
  "convoy", "Q-ship", "disguise", "intern", "breakdown", "fuel", "unrest", "prestige",
  "short range", "4,000" and "4000" found no further W-1 passage; the `4000` hits on pp.104,
  105 and 132 are unrelated air and ship values. No page supplies a trade-protection formula,
  a quota unit, an interception probability, a fuel or breakdown probability, a damage
  threshold, a merchant loss rate, a revenue multiplier or a prestige amount.
- Repo sources consulted: map #404 and decisions #405 to #409; `RULES.md` scope and values
  (every authored value cites a source or is labelled `BALANCE_TARGET`/`PROVISIONAL`); the
  decision records' references to ADR-0252 (PROVISIONAL balance targets) and ADR-0213
  (balance adjustments). Code seams checked: `packages/combat/src/generation/mission.ts`
  registers `RAIDER_INTERCEPTION` as a mission kind, with no raider state machine;
  `packages/phase-engine/src/` has no trade-warfare phase and no merchant-tonnage pool. No
  production or engine value is changed by this note.
- Units are stated only where the manual states them. The manual gives knots (8), a
  percentage (110%), two national multipliers (1.2, 0.7) and a prestige threshold (16). It
  gives no tonnage, probability, distance, other duration or money amount for W-1.

## Quoted evidence (verbatim)

Line breaks are joined. Ellipses mark omitted words only.

### Trade protection (pp.70 to 71)

- **p.70:** "When war breaks out each nation will be required to keep a number of ships on
  Trade protection duty. The number of ships required will be proportional to the fleet size
  and your economy, and modified by the strength of the enemy submarine force."
- **p.71:** "Ships on Trade protection are counted in one global pool, and their exact
  location is not important for fulfilling the overall requirement."
- **p.71:** "Ships assigned to trade protection will not normally be available for fleet
  operations. However, in non-home areas, any ship present might be used in battle."
- **p.71:** "DD and KE assigned to trade protection will be on ASW patrols or assigned as
  convoy escorts."
- **p.71:** "Cruisers assigned to trade protection will patrol against enemy raiders and
  provide heavy convoy escort."
- **p.71:** "If you do not satisfy the Trade protection requirement, there will be a larger
  chance of enemy submarines sinking merchant ships and your prestige may suffer. Stronger
  patrols than required will hamper the operations of enemy submarines and increase the
  chance of sinking them. Also, the crew quality of patrolling ships will have an effect, so
  while it is tempting to put your worst crews on obsolete ships on ASW patrol, it might not
  be an ideal solution."
- **p.71:** "Ships on Trade protection may be present in defensive coastal battles in the
  area where they are deployed, but will otherwise have a low chance of being involved in
  battles."
- **p.71:** "AMCs can be used on trade protection patrols and if you have invented Q-ships,
  they can surprise and sink enemy submarines."
- **p.73:** "For the purposes of submarine attacks on merchant shipping, the numbers of ASW
  capable ships assigned to trade protection in the area the submarine operates will be used
  as a modifier. After attacking, there is a chance that the sub will be attacked by trade
  protection vessels. A random vessel in the area is selected, and its ASW rating is used as
  the basis for the attack."

### Raiders (pp.71 to 72)

- **p.71:** "During war, you can send out ships as raiders to prey on enemy shipping. Raiders
  cannot be short range ships and are more effective if they have long range and relatively
  high speed. Generally, cruisers are ideal for this mission."
- **p.71:** "Raiders run a risk of being intercepted by enemy trade route patrols and brought
  to battle. Note that a raider winning a battle but suffering significant damage might be
  forced to scuttle itself or seek internment in a neutral port."
- **p.71:** "There is a slight risk that raiders run out of fuel, especially if not long range
  or of large size, or suffer a mechanical breakdown. This can force them to be interned in
  neutral countries until the war is over."
- **p.71:** "AMCs can be effective as raiders, despite relatively low speed, due to their
  ability to disguise themselves as normal merchantmen. A speed of at least 8 knots is
  required."
- **p.72:** "Large fast AMCs (fuel hungry liners) are however prone to running out of fuel.
  An AMC raider has a chance of deceiving and surprising an enemy intercepting ship, with the
  interception battle starting at short range and the intercepting ship surprised."
- **p.72:** "If you are blockaded, ships deployed as raiders may be engaged by enemy ships
  while breaking out to the trade routes."
- **p.72:** "Raiders have no effect if you are blockading the enemy (enemy merchant shipping
  is assumed to have been reduced to a minimum by the blockade)."
- **p.41:** "Engine breakdowns can affect your ships during battle, but also during strategic
  turns. Reliable engines are especially important for ships deployed as raiders."
- **p.119:** "In the strategic turns, ships equipped with floatplanes or helicopters will be
  more effective as raiders. They will also be more effective at hunting raiders."

### Merchant losses and their consequences (pp.34, 36, 62)

- **p.34:** "Submarines will have an effect in the strategic turns, when they will attack
  enemy merchant shipping. They will also occasionally torpedo warships. The effectiveness
  of submarines will depend of the number of enemy ships on trade protection and or the
  number of destroyers relative to heavy ships on the fleet (see ASW warfare and Trade
  protection)."
- **p.36:** "Unrestricted means your submarines will carry out unrestricted submarine warfare
  against enemy merchant shipping at the expense of operations in support of the fleet. This
  will increase sinkings of enemy merchant shipping and may cause starvation and higher
  unrest level for the enemy. However, it will also anger neutral nations and risk bringing
  in additional enemies against you."
- **p.36:** "Submarines will have a sharply reduced effect on enemy merchant shipping if you
  are blockading the enemy (enemy merchant shipping is assumed to have been reduced to a
  minimum by the blockade)."
- **p.62:** "The unrest level is raised by: High military spending, Long wars, Being under
  blockade, Cramped accommodation in ships, Defeats, Events." Merchant losses are not listed
  among the drivers. The same page lists "War breaking out", "Social programmes", "Victories"
  and "Lower military spending" as lowering unrest.
- **p.62:** "Prestige loss is in most cases proportional, which means that if you have high
  prestige, you will lose more of it on an event that results in prestige loss." And: "If your
  prestige goes too low (16 or below), you run a risk of being sacked, thus losing the game."

### Adjacent rules that W-1 must not silently reuse

- **p.70:** "To blockade a nation, you must have 110% of the enemy's naval strength in the
  build area of the enemy nation. ... Britain has its blockade strength multiplied by 1.2 ...
  Russia has its blockade strength multiplied by 0.7." And: "A blockaded nation will not be
  able to move ships out of its build area, except as raiders, which are subject to possible
  interception as they break through the blockade."
- **p.69:** "There is a basic chance of 80% for a surprise attack to take place." This is the
  first-turn surprise attack, not a raider or AMC surprise; the two must not share a value.
- **p.77:** "Nations without access to oil run a risk of suffering fuel shortages in wartime.
  ... In a turn with fuel shortage, there is a risk that ships will have ordered strategic
  moves cancelled or that they will be unable to take part in a battle. ... Ships using coal
  fuel will never be affected by fuel shortages." This is a national fuel shortage, distinct
  from a raider exhausting its own bunkers on p.71.
- **p.48:** range and status codes: `L = Long range`, `S = Short range`, `R = Raider`,
  `TP = Trade protection`. `S` is a ship-design range class; it is not a battle distance.

## Provenance table

Classes: **SOURCED** = the manual states the rule, threshold or number (quotation, page,
units); **SOURCED (qualitative)** = the manual states the rule but no number; **STRUCTURE
ONLY** = the manual states that the quantity exists and what it depends on, but gives no
number or model; **UNSOURCED** = the manual is silent. Only SOURCED facts may be authored as
manual-grounded. Every STRUCTURE ONLY or UNSOURCED row must be either carried as a deliberate
balance parameter labelled `PROVISIONAL`/`BALANCE_TARGET`, or left dormant.

| #   | W-1 value                                                                | Class                    | Manual evidence (page, units)                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Requirement exists, activated when war breaks out                        | SOURCED                  | p.70: "When war breaks out each nation will be required to keep a number of ships on Trade protection duty." No number.                                                                                                                                    |
| 2   | Quota inputs: fleet size, economy, enemy submarine strength              | STRUCTURE ONLY           | p.70: "proportional to the fleet size and your economy, and modified by the strength of the enemy submarine force." Direction only; no coefficient, no definition of fleet size or economy, no submarine measure.                                          |
| 3   | Quota formula, coefficients and unit                                     | UNSOURCED (not supplied) | The manual's unit is "a number of ships" (p.70), not tonnage. It supplies no equation, no additive or multiplicative form, and no floor or cap.                                                                                                            |
| 4   | Global pool; location irrelevant                                         | SOURCED                  | p.71: "counted in one global pool, and their exact location is not important for fulfilling the overall requirement." No number.                                                                                                                           |
| 5   | Fleet-operation availability                                             | STRUCTURE ONLY           | p.71: "will not normally be available for fleet operations. However, in non-home areas, any ship present might be used in battle." "Normally" and "might" fix no probability or availability rule.                                                         |
| 6   | DD and KE contribution and role                                          | SOURCED (qualitative)    | p.71: "DD and KE assigned to trade protection will be on ASW patrols or assigned as convoy escorts." No counting weight.                                                                                                                                   |
| 7   | Cruiser contribution and role                                            | SOURCED (qualitative)    | p.71: "Cruisers assigned to trade protection will patrol against enemy raiders and provide heavy convoy escort." The manual does not split CL from CA.                                                                                                     |
| 8   | AMC contribution; Q-ship submarine surprise                              | SOURCED (conditional)    | p.71: "AMCs can be used on trade protection patrols and if you have invented Q-ships, they can surprise and sink enemy submarines." The Q-ship effect requires the technology; no probability.                                                             |
| 9   | Exact contributing class set and counting basis                          | STRUCTURE ONLY           | The manual names DD, KE, cruisers and AMCs. It does not say whether every cruiser counts equally, whether a ship counts by hull or by tonnage, or whether only active ships count.                                                                         |
| 10  | Shortfall effect on merchant sinkings                                    | STRUCTURE ONLY           | p.71: "there will be a larger chance of enemy submarines sinking merchant ships". Direction only; no multiplier, rate or threshold.                                                                                                                        |
| 11  | Shortfall effect on prestige                                             | STRUCTURE ONLY           | p.71: "your prestige may suffer". p.62: loss "is in most cases proportional". No amount, cadence or proportional base.                                                                                                                                     |
| 12  | Surplus effect on enemy submarines                                       | STRUCTURE ONLY           | p.71: "Stronger patrols than required will hamper the operations of enemy submarines and increase the chance of sinking them." Direction only.                                                                                                             |
| 13  | Crew-quality effect on patrol effectiveness                              | STRUCTURE ONLY           | p.71: "the crew quality of patrolling ships will have an effect". Direction only; no scale or coefficient.                                                                                                                                                 |
| 14  | Trade-protection ships in coastal battles                                | SOURCED (qualitative)    | p.71: "may be present in defensive coastal battles in the area where they are deployed, but will otherwise have a low chance of being involved in battles." "Low chance" is not a number.                                                                  |
| 15  | ASW ships as a submarine-attack modifier; random defender's ASW rating   | SOURCED (qualitative)    | p.73: "the numbers of ASW capable ships assigned to trade protection in the area the submarine operates will be used as a modifier"; "A random vessel in the area is selected, and its ASW rating is used as the basis for the attack." No modifier value. |
| 16  | Raider range eligibility: no short-range ships                           | SOURCED                  | p.71: "Raiders cannot be short range ships". `S` is defined on p.48. No other range restriction.                                                                                                                                                           |
| 17  | Raider effectiveness: long range and relatively high speed               | STRUCTURE ONLY           | p.71: "more effective if they have long range and relatively high speed". No speed threshold for raiders generally, no effect size.                                                                                                                        |
| 18  | Cruisers are ideal raiders                                               | SOURCED (qualitative)    | p.71: "Generally, cruisers are ideal for this mission." No class limit.                                                                                                                                                                                    |
| 19  | Interception by trade-route patrols                                      | STRUCTURE ONLY           | p.71: "Raiders run a risk of being intercepted by enemy trade route patrols and brought to battle." Risk exists; no probability, patrol density or detection rule.                                                                                         |
| 20  | Scuttle or internment after significant damage                           | STRUCTURE ONLY           | p.71: "a raider winning a battle but suffering significant damage might be forced to scuttle itself or seek internment in a neutral port." No damage threshold, no choice rule, no duration for internment after damage.                                   |
| 21  | Fuel exhaustion risk and conditions                                      | STRUCTURE ONLY           | p.71: "a slight risk that raiders run out of fuel, especially if not long range or of large size". p.72: "Large fast AMCs (fuel hungry liners) are however prone to running out of fuel." No probability, fuel capacity or range-band mapping.             |
| 22  | Machinery breakdown risk                                                 | STRUCTURE ONLY           | p.71: "or suffer a mechanical breakdown"; p.41: "Reliable engines are especially important for ships deployed as raiders." No probability, reliability mapping or repair rule.                                                                             |
| 23  | Internment until peace                                                   | SOURCED                  | p.71: "can force them to be interned in neutral countries until the war is over." Duration is the war. No port choice, cost or release mechanics.                                                                                                          |
| 24  | AMC disguise and 8-knot minimum                                          | SOURCED                  | p.71: "ability to disguise themselves as normal merchantmen. A speed of at least 8 knots is required." Unit: knots. The 8-knot floor is stated for AMC raiders only.                                                                                       |
| 25  | AMC deception and surprise at short range                                | SOURCED (existence only) | p.72: "An AMC raider has a chance of deceiving and surprising an enemy intercepting ship, with the interception battle starting at short range and the intercepting ship surprised." No probability; "short range" is undefined as a battle distance.      |
| 26  | Blockaded raider breakout                                                | SOURCED                  | p.72: "If you are blockaded, ships deployed as raiders may be engaged by enemy ships while breaking out to the trade routes." p.70 adds that breakout raiders are "subject to possible interception". No probability.                                      |
| 27  | Raiders ineffective when the raider's own nation blockades the enemy     | SOURCED                  | p.72: "Raiders have no effect if you are blockading the enemy (enemy merchant shipping is assumed to have been reduced to a minimum by the blockade)." This is the reverse of the map summary "if the enemy is blockaded".                                 |
| 28  | Floatplanes and helicopters improve raiding and raider hunting           | SOURCED (qualitative)    | p.119: "ships equipped with floatplanes or helicopters will be more effective as raiders. They will also be more effective at hunting raiders." No modifier.                                                                                               |
| 29  | Submarines attack merchant shipping in strategic turns                   | SOURCED                  | p.34: "Submarines will have an effect in the strategic turns, when they will attack enemy merchant shipping." No loss rate.                                                                                                                                |
| 30  | Unrestricted submarine warfare increases sinkings, starvation and unrest | STRUCTURE ONLY           | p.36: "will increase sinkings ... and may cause starvation and higher unrest level for the enemy." Direction only; no amount, threshold or timing.                                                                                                         |
| 31  | Blockade sharply reduces submarine effect on merchant shipping           | SOURCED (qualitative)    | p.36: "sharply reduced effect ... if you are blockading the enemy". "Sharply" is not a number.                                                                                                                                                             |
| 32  | Merchant tonnage pool as authoritative state                             | UNSOURCED (not supplied) | The manual never mentions a merchant tonnage pool, a national merchant marine total, or a pool that losses deduct from. It describes effects (sinkings, starvation, unrest), not a modelled stock.                                                         |
| 33  | Trade revenue proportional to surviving merchant tonnage                 | UNSOURCED (not supplied) | No page links merchant losses to trade revenue, tax base or budget. p.13 discusses budget growth, colonial income and budget share, not merchant losses.                                                                                                   |
| 34  | Merchant-loss threshold that raises unrest                               | UNSOURCED (not supplied) | p.62's unrest drivers do not include merchant losses; p.36 gives only "may cause ... higher unrest" for unrestricted warfare, with no threshold, cadence or amount.                                                                                        |
| 35  | Prestige penalty cadence for a trade-protection shortfall                | UNSOURCED (not supplied) | p.71 says "may suffer"; p.62 says loss is "in most cases proportional". No per-month rate, repeat rule or shortfall ratio.                                                                                                                                 |

## What the manual actually fixes (the complete list)

Only these W-1 facts are manual-grounded:

1. Trade protection is a **global pool**, required **when war breaks out**, sized
   **proportionally to fleet size and economy** and **modified by enemy submarine strength**
   (p.70), with **location irrelevant** (p.71).
2. **DD, KE and cruisers** assigned to trade protection have the roles quoted above; **AMCs**
   may join, and **Q-ships** can surprise submarines (p.71).
3. A **shortfall** increases merchant sinkings and **may** cost prestige; a **surplus** hampers
   enemy submarines and increases their loss chance; **crew quality matters** (p.71).
4. Trade-protection ships are **normally unavailable** for fleet operations, may appear in
   **defensive coastal battles**, and otherwise have a **low** battle chance (p.71).
5. **ASW ships on trade protection** modify submarine attacks on merchant shipping, and a
   **random vessel's ASW rating** is the basis for a counter-attack (p.73).
6. **Raiders cannot be short range**; long range and relatively high speed help; cruisers are
   ideal (p.71).
7. Raiders risk **interception**, and a winner with **significant damage** may **scuttle or
   intern** (p.71).
8. Raiders risk **fuel exhaustion** (especially if not long range or not large) and
   **mechanical breakdown**, which can **intern them until peace** (p.71); large fast AMC
   liners are especially fuel-prone (p.72).
9. **AMC raiders** need **at least 8 knots** and can **disguise**, **deceive** and **surprise**
   an interceptor at **short range** (pp.71 to 72).
10. A **blockaded** nation may still send raiders out, subject to interception while breaking
    out (pp.70, 72).
11. Raiders have **no effect when their own nation is blockading the enemy** (p.72).
12. **Floatplanes and helicopters** improve raiding and raider hunting (p.119).

No rule in W-1 carries a formula, a probability, a tonnage, a distance, a duration other than
"until the war is over", or a money amount.

## PROVISIONAL register (parameters the decisions supplied)

These are the values in decisions #406 to #409 that the manual does **not** supply. Each must
be carried as a deliberate balance parameter labelled `PROVISIONAL` (or `BALANCE_TARGET`),
never presented as manual-sourced. The third column records the manual status; the fourth
records the specific reading that needs an owner-visible label.

| Decision | Parameter as decided                                                                         | Manual status                       | Why it is PROVISIONAL / what to fix                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #406     | Quota `= (activeFleetTonnage / 10) + (baseEconomicIncome * 20) + (opposingSubmarines * 250)` | UNSOURCED                           | No formula or coefficients (row 3). The three terms also have different dimensions (tonnage, income, count); the function needs a single unit before it can be implemented as integers. |
| #406     | Quota and contributions measured in **tonnage**                                              | UNSOURCED                           | The manual says "a number of ships" (p.70), not tonnage. A tonnage basis is a Bluewave reading and must be labelled as one.                                                             |
| #406     | Contributing classes **DD, KE, CL, CA, AMC**                                                 | Partly SOURCED, set UNSOURCED       | DD/KE/cruisers/AMC are named; the CL/CA split and equal counting are engineering. The manual gives no counting weight per class.                                                        |
| #406     | Shortfall ratio `(quota - assigned) / quota`                                                 | UNSOURCED                           | The manual gives a direction only (row 10); no ratio or dose-response.                                                                                                                  |
| #406     | Prestige penalty for shortfall                                                               | STRUCTURE ONLY                      | "may suffer" (row 11); amount, cadence and proportionality are absent.                                                                                                                  |
| #407     | All raiders require `speed >= 8 knots`                                                       | UNSOURCED (over-read)               | The manual's 8-knot floor is for **AMC raiders only** (row 24). A universal raider floor is a Bluewave reading and must be labelled.                                                    |
| #407     | Fuel-exhaustion base rates **1% long, 4% medium, 6% fast liner**                             | UNSOURCED                           | "Slight risk", "especially if not long range or of large size" (row 21). The ordering is plausible but the numbers are balance.                                                         |
| #407     | Breakdown base **2%**, scaled by engine reliability                                          | UNSOURCED                           | "Slight risk" and "reliable engines are especially important" (row 22). No probability or scale.                                                                                        |
| #407     | Interned until peace, excluded from fleet, no maintenance cost                               | Duration SOURCED; details UNSOURCED | p.71 gives "until the war is over". Excluded-from-fleet and no-maintenance are engineering readings; the manual does not state them.                                                    |
| #408     | Interception odds from escort density versus raider speed                                    | UNSOURCED                           | Risk exists (row 19); no density, speed or probability model.                                                                                                                           |
| #408     | AMC battle starts at **4,000 m** with the interceptor **surprised** for **120 s**            | UNSOURCED                           | p.72 says "short range" and "surprised", not a distance or a delay. The 4,000 m and 120 s are engineering values. "Short range" on p.48 is a hull range class, not a battle range.      |
| #408     | Scuttle/intern threshold **>70% structural damage or engine failure**                        | UNSOURCED                           | p.71 says "significant damage" (row 20); no percentage.                                                                                                                                 |
| #409     | `nation.economy.merchantTonnagePool` and deduction per sinking                               | UNSOURCED                           | No merchant stock exists in the manual (row 32). The pool, its initial size and its loss unit are Bluewave design.                                                                      |
| #409     | `revenueMultiplier = currentMerchantTonnage / initialMerchantTonnage`                        | UNSOURCED                           | No revenue link in the manual (row 33).                                                                                                                                                 |
| #409     | Prestige **-1 per 2 months** for an unaddressed shortfall                                    | UNSOURCED                           | p.71 "may suffer"; p.62 gives only proportional loss. No rate.                                                                                                                          |
| #409     | Unrest **+1 per quarter** when losses exceed **10%**                                         | UNSOURCED                           | p.62 does not list merchant losses; p.36 gives only "may cause ... higher unrest" for unrestricted warfare. Threshold, cadence and amount are all balance.                              |

If the owner waives RTW3 fidelity under ADR-0213, these values remain admissible, but each
must be labelled `BALANCE_TARGET` or `PROVISIONAL` with the decision reference. They must not
be described as manual-grounded in content, code, or a later research note.

## Readings the decisions should correct before implementation

1. **Direction of the blockade rule.** Issue #404's decision summary says raiders are
   ineffective "if the enemy is blockaded". The manual says the opposite: raiders have no
   effect "if **you are blockading the enemy**" (p.72). A nation that is itself blockaded can
   still send raiders out, subject to breakout interception (pp.70, 72). The implementation
   predicate must be `raiderNationIsBlockadingEnemy`, not `enemyIsBlockaded`.
2. **Quota unit.** "A number of ships" (p.70) is a count, not a tonnage. If the design keeps a
   tonnage pool for contribution, the conversion and the unit of the quota must be stated;
   mixing tonnage and ship counts is the kind of unit drift `RULES.md` forbids.
3. **8-knot floor.** Apply it to AMCs only unless the owner deliberately extends it. A general
   raider minimum is an unsourced rule change, not a reading of p.71.
4. **Short range versus battle range.** The p.72 "short range" is a qualifier on the
   interception battle; the p.48 "short range" is a ship-design range class. A 4,000 m start
   is a reasonable engineering choice, but it must not be cited to p.72.
5. **Merchant losses are not a stock in the manual.** The manual models effects on sinkings,
   starvation and unrest, not a national merchant-tonnage pool or a revenue ratio. A pool is a
   design choice; the note records it as such.
6. **No generic "trade loss" unrest driver.** p.62 lists blockade, long wars, defeats and
   events, not merchant sinkings. A direct loss-to-unrest rule is a balance addition; the
   manual's only bridge is the p.36 "starvation" sentence for unrestricted warfare.
7. **Two fuel rules.** National fuel shortage (p.77: oil access, longer war, blockade, coal
   immunity) is a separate mechanic from a raider exhausting its own bunkers (p.71). W-1 must
   not reuse the p.77 risk for raider attrition.

## Recommendations

- Author only the twelve grounded facts above as manual-sourced. Keep every formula,
  probability, threshold and pool in the PROVISIONAL register until the owner records it as a
  balance decision.
- Before coding the quota, choose one unit (ship count or tonnage) and one arithmetic domain
  for all three inputs. The current expression cannot be implemented as written in a
  dimensionally coherent integer type.
- Correct the blockade predicate in the map/decision record; it is currently inverted relative
  to p.72.
- Keep the p.69 80% surprise-attack chance out of W-1; AMC surprise is a separate, unsourced
  probability.
- Do not reuse the p.70 blockade multipliers (1.2 and 0.7) as raider or trade-protection
  modifiers; they belong to blockade strength only.
- If a later ticket needs a decision request, group the quota unit/formula, the shortfall
  dose-response and the merchant-pool model separately: they fail independently.
