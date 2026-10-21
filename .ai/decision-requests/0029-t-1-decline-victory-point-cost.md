# Decision Request: T-1 decline victory-point cost and modifiers (G2)

## Status

Resolved (2026-10-21) by owner delegation: **Option C**, recorded as
[ADR-0254](../../docs/adr/ADR-0254-t1-battle-offer-values-balance-targets.md). The
value is a labelled `BALANCE_TARGET`; ticket #118 is no longer blocked on it.

## Trigger

R8 reduces the decliner's war score by a ruleset amount, and the manual gives none. Coupled sub-values: the amount per mission and any modifier (for example home-port distance).

## Evidence

- Manual p.67: "Declining a battle will cost victory points".
- Manual p.77: "Battles and other events will gain victory points." Manual p.99 reduces battle victory points by 10% and 20% by realism mode (T-2).
- Steam "Update v01.00.37" (2024-02-26): "Victory Point losses for declining battles distant from your home port have been greatly reduced." Outside the authority order (ADR-0210), no number; recorded in `docs/research/rtw3-prestige-values.md`.
- War score is clamped at +/-100 with surrender at 80 (CONTEXT.md; repo).
- Research note: `docs/research/t-1-battle-offer-values.md` (provenance table, verbatim quotations).
- Spec #109 (R2), ticket #110; map #96 and decision tickets #97-#108.
- Prior art: ADR-0210, ADR-0213, ADR-0223, ADR-0226, ADR-0239; decision requests 0003, 0006, 0007, 0012.

## Why agent judgment is insufficient

The amount decides how often declining is rational and how fast a war is lost; a distance modifier adds a measure the repo does not yet define. Provenance class: STRUCTURE ONLY; magnitude and modifiers UNSOURCED, modifier mentioned only in a non-authoritative patch note. The manual is silent, ADR-0210 forbids inventing values as fact, and spec #109 (R2, G1-G7) returns each such value to the owner individually. This is a gameplay balance number, not a routine local design choice.

## Options

### Option A: Owner supplies the value

- Behavior: the owner provides the VP amount per offered mission (fleet, cruiser), the rounding mode, and whether any home-port-distance or other modifier applies, with its unit and measure with provenance (a manual page, another high-trust source, or a stated design intent).
- Advantages: authoritative and unambiguous.
- Risks: the owner may not hold the original data; the value may not exist in the source game.
- Compatibility impact: none until authored.
- Migration impact: none (no prior state).
- Scope and effort: authoring in ticket #118 plus an ADR if the choice diverges from RTW3.

### Option B: Keep the value dormant

- Behavior: the ruleset section stays absent (or, if partially authored, the compile rejects it) so no production battle-offer behaviour depends on this value; Declining then cannot be enabled in production (a decline needs a cost to be meaningful).
- Advantages: no unsourced value ships; the mechanics stay complete and tested against fixture-class values.
- Risks: the offer flow has no production effect; #118 and #119 stay blocked.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

### Option C: Admit as ADR-0213 `balance_adjustment`

- Behavior: the owner explicitly waives RTW3 fidelity for this value and admits an owner-chosen value as a labelled `balance_adjustment` ruleset constant with a recorded rationale (pattern of ADR-0223 and ADR-0239), never classed as manual. The owner chooses the amounts and states whether the patch-note distance reduction is adopted or ignored.
- Advantages: unblocks #118 while staying honest about provenance.
- Risks: a deliberate divergence from the manual; must be tuned by the balance sweep.
- Compatibility impact: none until authored; authoring moves production behaviour and goldens once, at go-live.
- Migration impact: one golden re-pin at go-live per the golden repinning procedure.
- Scope and effort: an ADR plus authoring in #118.

## Recommendation

Option A if the owner can supply the data; else Option C with the distance modifier decided separately as present or absent. No amount is recommended.

Minimum owner response: Choose an option; for A or C, the VP integer per mission and whether a distance modifier exists (and if so its measure and effect).

## Work safely completed while blocked

The dormant mechanics (tickets #111 to #117) are specified and tested against labelled fixture-class values that never reach the production pack. Nothing is authored in production; #118 stays blocked on this decision.
