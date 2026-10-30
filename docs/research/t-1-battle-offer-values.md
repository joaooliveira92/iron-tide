# T-1 battle offers — value grounding (G1-G7)

Status: new research note, created 2026-10-21 by T-1 ticket 01 (issue #110, spec #109,
requirement R2). It grounds the gated battle-offer values in `docs/research/` style: every
value is either a verbatim manual quotation with page and units, or marked **UNSOURCED**.
It extends [`rtw3-manual-baseline.md`](rtw3-manual-baseline.md) and
[`rtw3-prestige-values.md`](rtw3-prestige-values.md) and does not rewrite them. It chooses no
value and fixes no behaviour: decision requests 0028 to 0034 return each unsourced value to
the owner (ADR-0210, ADR-0223, ADR-0226, ADR-0239 precedent).

## Source and method

- Source: `docs/Rule the Waves 3 Manual EBOOK.pdf` (authority order 3, ADR-0210). Text
  extracted page by page with `pypdf` into a temp directory outside the repository (not
  tracked). Citations are the manual's printed page number, which equals the PDF page index.
- Pages re-read in full: pp.62, 63, 64, 67, 76, 77, 99. A text search of all 148 pages found
  these passages for the terms below and no others that bear on a battle-offer value:
  "decline" (pp.13, 66, 67; pp.13 and 66 are unrelated: colony income, taking possessions),
  "estimate" (p.67 only; pp.73, 74, 105, 112 are "underestimate", "estimated time",
  "estimates data" for aircraft), "support force" / "friendly AI" (pp.67, 99), "victory point"
  (pp.62, 67, 77, 90, 99), "several" (no battle-offer use beyond p.67), "refuse", "accept
  battle", "reasonable chance", "force estimate" (p.67 only). No page supplies a number for
  any G1-G7 value.
- Repo sources consulted: spec #109, map #96 and decision tickets #97-#108 (as summarised in
  the spec), ADR-0210, ADR-0213, ADR-0222, ADR-0223, ADR-0225, ADR-0226, ADR-0239,
  `docs/research/rtw3-prestige-values.md`, decision requests 0003, 0006, 0007, 0012, and the
  code seams `packages/combat/src/generation/` (mission registry, acceptance classes,
  `ALLIED_MAX_STRENGTH_BP = 5_000`) and `packages/combat/src/strength.ts` (fixed-point fleet
  strength). No newer, lawfully reachable higher-trust source (a later manual, developer
  design note, or save format document) was found; the NWS forum and general web search were
  not re-run beyond what `rtw3-prestige-values.md` already records.
- Units are stated only where the manual states them. The manual states **no** units, numbers
  or probabilities for any value in this note.

## Quoted evidence (verbatim)

Line breaks are joined.

- **p.67:** "When a state of war is in effect, there will be a chance of some kind of naval
  action every turn." Missions: "Fleet battle", "Cruiser battle", "Coastal raid", "Convoy
  attack/defence".
- **p.67:** "You will be presented with a screen with a force estimate of enemy strength,
  where you have the option to accept or decline battle. Declining a battle will cost victory
  points, and may cost prestige after several declined battles. There is a chance that the
  enemy will decline battle if they are feeling that they cannot send out a force with
  reasonable chances of victory."
- **p.67:** "The ships at your disposal will be randomly selected from the ships in the area
  according to the size and type of battle, though your permanent division structure will be
  taken into account."
- **p.67:** "Sometimes there will be an additional friendly AI controlled support force
  present. This can both be a blessing and a source of problems. Sometimes the support force
  will save your skin, sometimes it can charge ahead and be involved in battles you would
  want to avoid."
- **p.99:** "Note that many battles have friendly forces that are not under player control.
  This is not affected by the realism setting." (Preceded by: Rear Admiral's mode "Victory
  points will be reduced by 10%", Captain's mode "by 20%": realism reductions of battle
  victory points, owned by T-2.)
- **p.77:** "Battles and other events will gain victory points."
- **p.76:** "When the invasion takes place, you will have to fight a battle where you escort an
  invasion force of transports to the beaches." (Fought, not offered.)
- **p.62:** "Prestige loss is in most cases proportional, which means that if you have high
  prestige, you will lose more of it on an event that results in prestige loss."
- **p.64:** "In wartime, it will reduce the risk that your ships will be facing unexpected
  battles that cannot be avoided." Also p.64 "ENEMY SHIPS": "The information you can see
  about ships belonging to other nations is restricted. ... For completed ships you can see
  the ship type, displacement, number and calibre of guns or missile launchers, and speed,
  although the official numbers may be misleading." (Context for G1 only; says nothing about
  the battle estimate screen.)
- Out of the authority order (listed only as read-only evidence, from
  `rtw3-prestige-values.md`): Steam "Update v01.00.37" (2024-02-26): "Victory Point losses for
  declining battles distant from your home port have been greatly reduced." Steam "The
  Admiral Update" (2023-11-29): "With an intelligence coup you can even decline battle
  without the normal victory point penalty." Neither gives a number.

## Provenance table

Classes: **STRUCTURE ONLY** = the manual states the quantity or choice exists and what it
depends on, but no number or model; **UNSOURCED** = the manual is silent ("not supplied").
Only a **SOURCED** value (exact quotation, page, units) can be authored as manual-grounded;
there are none.

| Gate | Value | Manual evidence | Class | Status |
| --- | --- | --- | --- | --- |
| G1 | Estimate model: exact, banded or perturbed; granularity or error; whether composition is shown | p.67: "a force estimate of enemy strength"; "estimate" implies imprecision but the manual gives no model, error or granularity, and does not say whether ships or classes are listed. p.64 (intelligence) does not describe this screen. | STRUCTURE ONLY (an estimate exists); model UNSOURCED | UNSOURCED: decision 0028 |
| G2 | Victory-point cost of declining; per-mission and home-port-distance modifiers | p.67: "Declining a battle will cost victory points". No amount, unit or modifier. Distance reduction exists only in a patch note outside the authority order, with no number. | STRUCTURE ONLY (a cost exists); magnitude and modifiers UNSOURCED | UNSOURCED: decision 0029 |
| G3 | Whether a decline credits the opponent's war score; shape | Not supplied. p.67 says only the decliner "will cost victory points". | UNSOURCED | UNSOURCED: decision 0030 |
| G4 | Meaning of "several": threshold, counter scope (war, nation, campaign), reset or decay | p.67: "after several declined battles". No number, scope or reset. | STRUCTURE ONLY (a count threshold exists); threshold, scope, reset UNSOURCED | UNSOURCED: decision 0031 |
| G5 | Declined-battle prestige rule kind and amount | p.67: "may cost prestige". p.62: "Prestige loss is in most cases proportional". The word "may" and "in most cases" do not fix the kind (proportional or fixed), amount, or whether it repeats per decline past the threshold. ADR-0239 did not list declined battles as a prestige source or decide an amount. | STRUCTURE ONLY (a prestige cost exists); kind and amount UNSOURCED | UNSOURCED: decision 0032 |
| G6 | Enemy-decline comparison, threshold, probability, cost to the enemy | p.67: "There is a chance that the enemy will decline battle if they are feeling that they cannot send out a force with reasonable chances of victory." Shape is a force-balance predicate plus a chance; no comparison, threshold, probability or enemy cost. | STRUCTURE ONLY; all numbers UNSOURCED | UNSOURCED: decision 0033 |
| G7 | Support-force presence chance; composition beyond the 50% cap; own-AI divisions versus allies | p.67: "Sometimes there will be an additional friendly AI controlled support force present"; p.99: "many battles have friendly forces that are not under player control". No chance, composition or source rule. The 50% cap is repo code (`ALLIED_MAX_STRENGTH_BP`), not manual. | STRUCTURE ONLY ("sometimes"); chance, composition, source UNSOURCED | UNSOURCED: decision 0034 |

## Sourced values

None. No G1-G7 value has a quotation that supplies it.

## Unsourced values and decision requests

Each is returned to the owner individually (tightly coupled sub-values grouped, because one
cannot be answered without the other). None is presented as sourced fact, none is bundled.

| Decision | Covers | Minimum owner response |
| --- | --- | --- |
| 0028 | G1 estimate model, granularity, composition shown | Choose an option and, if A or C, the model kind and its parameters with provenance |
| 0029 | G2 VP cost and modifiers | Choose an option and, if A or C, the per-mission amount and any modifier rule |
| 0030 | G3 opponent credit | Choose none, mirror or fraction, and the fraction |
| 0031 | G4 "several": threshold, scope, reset | Choose threshold, scope and reset |
| 0032 | G5 prestige rule kind and amount (within the S-2 shape) | Choose option and, if A or C, kind and amount |
| 0033 | G6 enemy-decline comparison, threshold, probability, cost | Choose option and the four sub-values together |
| 0034 | G7 support presence chance, composition, own-AI question | Choose option and the three sub-values |

Open observations (non-blocking, not decision requests, per spec #109): how many offers per
month beyond the repository's one accepted battle per area; ownership of coastal raids;
whether the decline cost amount is shown to the player (owner option, spec Out of Scope).

## Value shape for later tickets (inputs and units only, no numbers)

For tickets #111 (ruleset section) and #112-#118. Every field is optional as a whole section
(absent = dormant, R1); nothing below carries a default. All quantities are branded safe
integers; basis points (bp) are integers in a stated closed range; rounding is explicit.

- **Estimate model (G1).** Kind: one of `EXACT`, `BANDED`, `PERTURBED` (extensible tagged
  union). Input: the enemy manifest's authoritative fixed-point fleet strength (the integer
  of `packages/combat/src/strength.ts`). Output: a non-negative integer in the same strength
  units. `BANDED` carries a band width (integer strength units or bp of true strength);
  `PERTURBED` carries a symmetric error bound in bp and draws from a recorded
  domain-separated stream keyed by battle and side; a rounding mode; a boolean for whether
  composition (class counts) is shown. Bounds: error bound bp in 0..10000.
- **Decline VP (G2).** A non-negative integer of war-score points (the scale clamped at
  +/-100 with surrender at 80) per acceptance-class-eligible mission, keyed by mission type;
  an optional modifier rule keyed by a distance measure (unit and measure to be defined by the
  owner answer; kinds: none, or a reduction in bp of the base amount); rounding mode;
  applied to the decliner through the existing war-score seam.
- **Opponent credit (G3).** Tagged union: `NONE`, `MIRROR`, or `FRACTION_BP` with bp in
  0..10000 of the decline VP; result integer with explicit rounding.
- **"Several" (G4).** Threshold: integer count >= 1; scope: one of `WAR`, `NATION`,
  `CAMPAIGN`; reset: one of `NONE`, `ON_WAR_END`, or a decay (integer count removed per a
  stated number of months). Counter unit: declined battles, integer, monotonic within its
  reset rule.
- **Prestige rule (G5).** One per-source rule entry in the S-2 value-set shape (spec #74):
  kind among those the S-2 shape defines (proportional in bp of current prestige, or fixed
  integer points), amount in that kind's units, and a repeat rule (once at the threshold, or
  on each further decline). Optional; absent means counter and event only (R10).
- **Enemy decline (G6).** A force-balance predicate over two integers (the enemy's strength
  and the player's estimated or true strength, in strength units): a comparison kind, a
  threshold as a ratio in bp (>= 0, no upper bound beyond safe integer), a probability in bp
  0..10000 drawn only when the predicate holds, and an optional enemy cost expressed as a VP
  integer (absent = none). The draw is recorded (R11).
- **Support force (G7).** Presence chance in bp 0..10000 (drawn only when allied candidates
  exist); composition: share of the existing cap in bp 0..5000 (the repo cap
  `ALLIED_MAX_STRENGTH_BP`) selected by the existing candidate ordering; a source kind
  (`ALLIED_ONLY`, or additionally `OWN_AI_DIVISIONS`).

## What this note does not do

It authors no ruleset, content, code, ADR or value. Authoring the unsourced values stops here
(AGENTS.md stop condition); the dormant mechanics (#111-#117) proceed against labelled
fixture-class values that never reach production, and #118 stays blocked on the owner
answers. An ADR-0213 `balance_adjustment` appears only as an owner option inside each
decision request.
